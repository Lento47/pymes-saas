import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { S3Client } from "@aws-sdk/client-s3";
import { StorageService } from "./storage.service";

describe("optional storage downloads", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([{ name: "NoSuchKey" }, { Code: "NoSuchKey" }, { $metadata: { httpStatusCode: 404 } }])(
    "allows missing keys only when explicitly requested: %j",
    async (error) => {
      jest.spyOn(S3Client.prototype, "send").mockRejectedValue(error as never);
      const service = new StorageService(new ConfigService());
      await expect(service.download("missing", true)).resolves.toBeNull();
      await expect(service.download("missing")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    },
  );

  it("does not convert access failures into missing objects", async () => {
    jest
      .spyOn(S3Client.prototype, "send")
      .mockRejectedValue({ name: "AccessDenied", $metadata: { httpStatusCode: 403 } } as never);
    await expect(
      new StorageService(new ConfigService()).download("private", true),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
