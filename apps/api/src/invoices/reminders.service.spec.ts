import { BadGatewayException, BadRequestException, NotFoundException } from "@nestjs/common";
import { RemindersService } from "./reminders.service";

describe("invoice reminder delivery", () => {
  const prisma = {
    invoice: { findFirst: jest.fn() }, paymentReminder: { findFirst: jest.fn(), update: jest.fn() },
    channel: { findFirst: jest.fn() }, conversation: { findFirst: jest.fn() },
    workspace: { findUnique: jest.fn() }, message: { update: jest.fn() },
  };
  const messages = { send: jest.fn() };
  const whatsapp = { sendInvoiceTemplate: jest.fn() };
  const email = { sendOutbound: jest.fn() };
  const service = new RemindersService(...[prisma, {}, {}, {}, messages, whatsapp, email] as unknown as ConstructorParameters<typeof RemindersService>);
  let invoice: any;
  let channel: any;
  const send = (draft_text = "Saldo pendiente") => service.sendReminder("workspace-a", "invoice-a", { channel_id: "channel-a", draft_text }, { id: "user-a", workspace_id: "workspace-a" } as any);
  beforeEach(() => {
    jest.resetAllMocks();
    invoice = { id: "invoice-a", number: "F-1", status: "OVERDUE", amount: 100, currency: "USD", due_date: new Date("2026-09-01"), payments: Array.from({ length: 6 }, () => ({ amount: 10 })), contact: { id: "contact-a", full_name: "Cliente", email: "client@example.invalid", phone: "+506 8888 8888" } };
    channel = { id: "channel-a", type: "EMAIL", status: "ACTIVE" };
    prisma.invoice.findFirst.mockImplementation(async () => invoice);
    prisma.channel.findFirst.mockImplementation(async () => channel);
    prisma.paymentReminder.findFirst.mockResolvedValue({ id: "reminder-a", draft_text: "Borrador" });
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation-a" });
    prisma.workspace.findUnique.mockResolvedValue({ name: "Negocio" });
    messages.send.mockResolvedValue({ id: "message-a" });
    email.sendOutbound.mockResolvedValue({ id: "email-ack" });
    whatsapp.sendInvoiceTemplate.mockResolvedValue({ message_id: "wa-ack" });
  });
  it("dispatches the reviewed email as escaped HTML and exact plain text before marking sent", async () => {
    await send('Hola <cliente> & "empresa"\nSaldo pendiente');
    expect(email.sendOutbound).toHaveBeenCalledWith(channel, invoice.contact.email, "Recordatorio de pago F-1", "Hola &lt;cliente&gt; &amp; &quot;empresa&quot;<br>Saldo pendiente", 'Hola <cliente> & "empresa"\nSaldo pendiente');
    expect(prisma.message.update).toHaveBeenCalledWith(expect.objectContaining({ data: { external_message_id: "email-ack", delivery_status: "SENT", delivery_error: null } }));
    expect(prisma.paymentReminder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sent_via: "channel-a", sent_at: expect.any(Date) }) }));
    expect(email.sendOutbound.mock.invocationCallOrder[0]).toBeLessThan(prisma.paymentReminder.update.mock.invocationCallOrder[0]);
  });
  it("uses the complete remaining balance in the WhatsApp template", async () => {
    channel.type = "WHATSAPP";
    await send();
    expect(whatsapp.sendInvoiceTemplate).toHaveBeenCalledWith(channel, "50688888888", expect.objectContaining({ amountFormatted: new Intl.NumberFormat("es-CR", { style: "currency", currency: "USD" }).format(40) }));
    expect(email.sendOutbound).not.toHaveBeenCalled();
  });
  it.each(["EMAIL", "WHATSAPP"])("retains the unsent reminder and exposes %s dispatch failures", async type => {
    channel.type = type;
    email.sendOutbound.mockRejectedValue(new Error("private provider details"));
    whatsapp.sendInvoiceTemplate.mockRejectedValue(new Error("private provider details"));
    await expect(send()).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.paymentReminder.update).not.toHaveBeenCalled();
    expect(prisma.message.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ delivery_status: "FAILED" }) }));
  });
  it("does not mark a response without a provider ID as sent", async () => {
    channel.type = "WHATSAPP"; whatsapp.sendInvoiceTemplate.mockResolvedValue({ message_id: "unknown" });
    await expect(send()).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.paymentReminder.update).not.toHaveBeenCalled();
  });
  it.each(["PAID", "CANCELLED", "ZERO_BALANCE"])("rejects %s invoices before messaging", async status => {
    if (status === "ZERO_BALANCE") invoice.payments.push({ amount: 40 }); else invoice.status = status;
    await expect(send()).rejects.toBeInstanceOf(BadRequestException);
    expect(messages.send).not.toHaveBeenCalled();
  });
  it("requires a tenant-scoped invoice and active channel", async () => {
    invoice = null;
    await expect(send()).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "invoice-a", workspace_id: "workspace-a" } }));
    invoice = { status: "OVERDUE", amount: 100, payments: [] }; channel = null;
    await expect(send()).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "channel-a", workspace_id: "workspace-a", status: "ACTIVE" } }));
    expect(messages.send).not.toHaveBeenCalled();
  });
  it("rejects unsupported channels and missing recipients before creating messages", async () => {
    channel.type = "TELEGRAM";
    await expect(send()).rejects.toBeInstanceOf(BadRequestException);
    channel.type = "WHATSAPP"; invoice.contact.phone = "---";
    await expect(send()).rejects.toBeInstanceOf(BadRequestException);
    channel.type = "EMAIL"; invoice.contact.email = null;
    await expect(send()).rejects.toBeInstanceOf(BadRequestException);
    expect(messages.send).not.toHaveBeenCalled();
  });
});
