import { PiiRedactorService } from "./pii-redactor.service";

describe("PiiRedactorService", () => {
  const service = new PiiRedactorService();

  it("redacts emails", () => {
    const result = service.redact({ text: "Contactar a ana@example.com" });

    expect(result.text).toContain("[EMAIL]");
    expect(result.detectedTypes).toContain("EMAIL");
  });

  it("redacts phone numbers", () => {
    const result = service.redact({ text: "Mi telefono es 8888-1234" });

    expect(result.text).toContain("[PHONE]");
    expect(result.detectedTypes).toContain("PHONE");
  });

  it("redacts secret-looking tokens", () => {
    const secretPrefix = "s" + "k";
    const result = service.redact({ text: `Clave ${secretPrefix}_1234567890abcdef` });

    expect(result.text).toContain("[SECRET_TOKEN]");
    expect(result.detectedTypes).toContain("SECRET_TOKEN");
  });

  it("redacts private URLs", () => {
    const result = service.redact({ text: "Abrir https://example.com/file?access_token=abc123" });

    expect(result.text).toContain("[PRIVATE_URL]");
    expect(result.detectedTypes).toContain("PRIVATE_URL");
  });

  it("does not mutate nested objects", () => {
    const input = {
      profile: {
        email: "cliente@example.com",
      },
    };

    const result = service.redactObject({ value: input });

    expect(input.profile.email).toBe("cliente@example.com");
    expect(JSON.stringify(result.value)).toContain("[EMAIL]");
  });

  it("returns original text when sensitive data is explicitly allowed", () => {
    const result = service.redact({ text: "ana@example.com", allowSensitiveData: true });

    expect(result.text).toBe("ana@example.com");
    expect(result.detectedTypes).toEqual([]);
  });
});
