import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { InvoicesService } from "./invoices.service";

describe("invoice balances across the complete payment history", () => {
  let payments: { id: string; amount: Prisma.Decimal; paid_at: Date }[];
  let invoice: Record<string, any>;
  const read = (query: any) => ({
    ...invoice,
    payments: payments.slice(0, query.include.payments.take ?? payments.length),
  });
  const prisma = {
    contact: { findMany: jest.fn(), count: jest.fn() },
    invoice: { findFirst: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    invoicePayment: { create: jest.fn() },
    workspaceUser: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new InvoicesService(...[
    prisma, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
  ] as unknown as ConstructorParameters<typeof InvoicesService>);

  beforeEach(() => {
    jest.resetAllMocks();
    invoice = { id: "invoice-a", workspace_id: "workspace-a", number: "F-1", amount: new Prisma.Decimal(100), currency: "USD", status: InvoiceStatus.PARTIALLY_PAID, due_date: new Date("2099-01-01") };
    payments = Array.from({ length: 6 }, (_, i) => ({ id: `payment-${i}`, amount: new Prisma.Decimal(10), paid_at: new Date(`2026-09-${20 - i}`) }));
    prisma.invoice.findFirst.mockImplementation(async (query) => query.where.workspace_id === invoice.workspace_id ? read(query) : null);
    prisma.invoice.findUniqueOrThrow.mockImplementation(async (query) => read(query));
    prisma.invoice.findMany.mockImplementation(async (query) => [read(query)]);
    prisma.invoice.count.mockResolvedValue(1);
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: invoice.amount } });
    prisma.invoice.update.mockImplementation(async (query) => { invoice = { ...invoice, ...query.data }; return read(query); });
    prisma.invoicePayment.create.mockImplementation(async ({ data }) => {
      const payment = { ...data, id: "new-payment", amount: new Prisma.Decimal(data.amount) };
      payments.unshift(payment);
      return payment;
    });
    prisma.workspaceUser.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (work) => work(prisma));
  });

  it("returns all six payments and the same correct balance in list and detail", async () => {
    const detail = await service.findOne("workspace-a", "invoice-a");
    const list = await service.findAll("workspace-a", {});
    for (const result of [detail, list.data[0]]) {
      expect(result).toMatchObject({ amount_paid: 60, balance_due: 40, payment_count: 6 });
      expect(result).toEqual(expect.objectContaining({ payments: expect.arrayContaining(payments) }));
    }
  });

  it("rejects a payment that only fits when the oldest payment is omitted", async () => {
    await expect(service.registerPayment("workspace-a", null, "invoice-a", { amount: 45 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.invoicePayment.create).not.toHaveBeenCalled();
  });

  it("settles the correct remaining amount after more than five payments", async () => {
    const result = await service.markPaid("workspace-a", null, "invoice-a");
    expect(result.payment.amount.toNumber()).toBe(40);
    expect(result.invoice).toMatchObject({ amount_paid: 100, balance_due: 0, payment_count: 7, status: InvoiceStatus.PAID });
  });

  it("does not read or register payments across workspaces", async () => {
    await expect(service.registerPayment("workspace-b", null, "invoice-a", { amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid state change before persisting any invoice edits", async () => {
    invoice.status = InvoiceStatus.PAID;
    await expect(service.update("workspace-a", "invoice-a", { status: InvoiceStatus.CANCELLED, description: "Must not persist" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects a currency change or a total below recorded payments before writing", async () => {
    await expect(service.update("workspace-a", "invoice-a", { currency: "CRC" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update("workspace-a", "invoice-a", { amount: 59.99 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("clears optional invoice fields without changing an unchanged due timestamp", async () => {
    await service.update("workspace-a", "invoice-a", { issue_date: null, activity_code: null, sale_condition: null, payment_method: null, description: "" });
    const data = prisma.invoice.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ issue_date: null, activity_code: null, sale_condition: null, payment_method: null, description: "" });
    expect(data).not.toHaveProperty("due_date");
  });

  it("accepts the exact remaining cents without floating-point overpayment errors", async () => {
    invoice.amount = new Prisma.Decimal("0.30");
    payments = [{ id: "first", amount: new Prisma.Decimal("0.10"), paid_at: new Date() }];
    const result = await service.registerPayment("workspace-a", null, "invoice-a", { amount: 0.20 });
    expect(result.invoice).toMatchObject({ amount_paid: 0.30, balance_due: 0, status: InvoiceStatus.PAID });
  });

  it("searches before pagination and keeps the workspace and other filters", async () => {
    await service.findAll("workspace-a", { q: "  Cliente  ", status: InvoiceStatus.SENT, page: 2, limit: 20 });
    const query = prisma.invoice.findMany.mock.calls[0][0];
    expect(query).toMatchObject({ skip: 20, take: 20, where: { workspace_id: "workspace-a", status: InvoiceStatus.SENT, OR: [
      { number: { contains: "Cliente", mode: "insensitive" } },
      { contact: { full_name: { contains: "Cliente", mode: "insensitive" } } },
    ] } });
    expect(prisma.invoice.count).toHaveBeenCalledWith({ where: query.where });
  });
  it("scopes the client picker to the workspace and selects only display fields", async () => {
    prisma.contact.findMany.mockResolvedValue([{ id: "contact-a", full_name: "Ana", company_name: null }]);
    prisma.contact.count.mockResolvedValue(24);
    const result = await service.findContacts("workspace-a", { q: " Ana ", page: 2 });
    expect(result.meta).toEqual({ total: 24, page: 2, pages: 2 });
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { workspace_id: "workspace-a", OR: [{ full_name: { contains: "Ana", mode: "insensitive" } }, { company_name: { contains: "Ana", mode: "insensitive" } }] },
      select: { id: true, full_name: true, company_name: true },
      orderBy: [{ full_name: "asc" }, { id: "asc" }], skip: 20, take: 20,
    });
  });
});
