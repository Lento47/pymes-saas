import { BadRequestException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import type { PrismaService } from "../common/prisma/prisma.service";
import type { StorageService } from "../common/storage/storage.service";
import type { Response } from "express";

describe("profile photo storage and workspace isolation", () => {
  const userId = "cm00000000000000000000000";
  const workspaceId = "workspace-one";
  let storedUrl: string;
  let objects: Map<string, Buffer>;
  let prisma: { workspaceUser: { findUnique: jest.Mock }; user: { update: jest.Mock } };
  let storage: { upload: jest.Mock; download: jest.Mock; delete: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    storedUrl = `/api/users/${userId}/avatar`;
    objects = new Map();
    prisma = {
      workspaceUser: {
        findUnique: jest.fn(async () => ({
          user: { id: userId, avatar_url: storedUrl },
          role: "VIEWER",
        })),
      },
      user: {
        update: jest.fn(async ({ data }) => {
          storedUrl = data.avatar_url;
        }),
      },
    };
    storage = {
      upload: jest.fn(async (key, data) => {
        objects.set(key, data);
      }),
      download: jest.fn(async (key) => objects.get(key) ?? null),
      delete: jest.fn(async (key) => {
        objects.delete(key);
      }),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  async function photo(format: "png" | "jpeg" | "webp" = "png") {
    const buffer = await sharp({
      create: { width: 900, height: 600, channels: 3, background: "red" },
    })
      .toFormat(format)
      .toBuffer();
    return { buffer, size: buffer.length, mimetype: `image/${format}` } as Express.Multer.File;
  }

  it.each(["png", "jpeg", "webp"] as const)(
    "decodes %s, stores a bounded WebP and retrieves the saved version",
    async (format) => {
      const { avatar_url } = await service.uploadAvatar(userId, await photo(format));
      expect(avatar_url).toMatch(/\/avatar\?v=[a-f0-9-]+$/);
      const result = await service.getAvatar(workspaceId, userId);
      const metadata = await sharp(result.data).metadata();
      expect(metadata).toMatchObject({ format: "webp", width: 512 });
      expect(metadata.height).toBeLessThanOrEqual(512);
      expect(metadata.exif).toBeUndefined();
      expect(result.contentType).toBe("image/webp");
      expect(prisma.workspaceUser.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
        }),
      );
    },
  );

  it("denies nonmembers before accessing any image", async () => {
    prisma.workspaceUser.findUnique.mockResolvedValue(null);
    await expect(service.getAvatar("another-workspace", userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.download).not.toHaveBeenCalled();
  });

  it.each(["png", "webp"])("recovers a legacy extensionless %s photo", async (ext) => {
    objects.set(`avatars/${userId}.${ext}`, Buffer.from("legacy-photo"));
    const result = await service.getAvatar(workspaceId, userId);
    expect(result).toEqual({ data: Buffer.from("legacy-photo"), contentType: `image/${ext}` });
  });

  it("returns not found for absent photos, but propagates storage outages", async () => {
    await expect(service.getAvatar(workspaceId, userId)).rejects.toBeInstanceOf(NotFoundException);
    storage.download.mockRejectedValue(new Error("storage unavailable"));
    await expect(service.getAvatar(workspaceId, userId)).rejects.toThrow("storage unavailable");
  });

  it("rejects invalid bytes and disguised SVG before writing anything", async () => {
    for (const content of [
      "not an image",
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
    ]) {
      const buffer = Buffer.from(content);
      await expect(
        service.uploadAvatar(userId, {
          buffer,
          size: buffer.length,
          mimetype: "image/png",
        } as Express.Multer.File),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects overlarge files and decompressed images above 25 megapixels", async () => {
    const oversized = {
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
      size: 1,
      mimetype: "image/png",
    } as Express.Multer.File;
    await expect(service.uploadAvatar(userId, oversized)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const buffer = await sharp({
      create: { width: 5001, height: 5000, channels: 3, background: "black" },
    })
      .png()
      .toBuffer();
    await expect(
      service.uploadAvatar(userId, {
        buffer,
        size: buffer.length,
        mimetype: "image/png",
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("keeps the old photo if saving the new version to the database fails", async () => {
    objects.set(`avatars/${userId}.jpg`, Buffer.from("previous"));
    prisma.user.update.mockRejectedValue(new Error("database unavailable"));
    await expect(service.uploadAvatar(userId, await photo())).rejects.toThrow(
      "database unavailable",
    );
    expect([...objects.keys()]).toEqual([`avatars/${userId}.jpg`]);
    expect((await service.getAvatar(workspaceId, userId)).data.toString()).toBe("previous");
  });

  it("serves private responses with nosniff through the controller", async () => {
    await service.uploadAvatar(userId, await photo());
    const response = { set: jest.fn(), send: jest.fn() };
    await new UsersController(service).getAvatar(
      workspaceId,
      userId,
      response as unknown as Response,
    );
    expect(response.set).toHaveBeenCalledWith({
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    expect(response.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
