import {
  MAX_UPLOAD_BYTES,
  mobileAdminDraftSchema,
  mobileDraftInput,
  mobileHistorySchema,
  mobileDestinationOptionsSchema,
  mobileDestinationSearchInput,
  mobilePreviewInput,
  mobilePreviewSchema,
  mobilePublishInput,
  mobileRestoreInput,
  uploadCreateInput,
  uploadRefSchema,
} from "@pymeshub/shared";
import type { z } from "zod";
import { trpc } from "./marketplace";

export const mobileAdminApi = {
  destinations: async (input: z.infer<typeof mobileDestinationSearchInput>) =>
    mobileDestinationOptionsSchema.parse(
      await trpc.mobile.destinations.query(
        mobileDestinationSearchInput.parse(input),
      ),
    ),
  draft: async () =>
    mobileAdminDraftSchema.parse(await trpc.mobile.draft.query()),
  save: async (input: z.infer<typeof mobileDraftInput>) =>
    mobileAdminDraftSchema.parse(
      await trpc.mobile.saveDraft.mutate(mobileDraftInput.parse(input)),
    ),
  discard: async (expectedVersion: number) =>
    mobileAdminDraftSchema.parse(
      await trpc.mobile.discardDraft.mutate({ expectedVersion }),
    ),
  publish: async (input: z.infer<typeof mobilePublishInput>) =>
    mobileAdminDraftSchema.parse(
      await trpc.mobile.publish.mutate(mobilePublishInput.parse(input)),
    ),
  restore: async (input: z.infer<typeof mobileRestoreInput>) =>
    mobileAdminDraftSchema.parse(
      await trpc.mobile.restore.mutate(mobileRestoreInput.parse(input)),
    ),
  history: async (before?: number) =>
    mobileHistorySchema.parse(await trpc.mobile.history.query({ before })),
  preview: async (input: z.infer<typeof mobilePreviewInput>) =>
    mobilePreviewSchema.parse(
      await trpc.mobile.preview.query(mobilePreviewInput.parse(input)),
    ),
  upload: async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES)
      throw new Error("La imagen debe pesar como máximo 5 MiB.");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("No pudimos leer la imagen."));
      reader.onerror = () => reject(new Error("No pudimos leer la imagen."));
      reader.readAsDataURL(file);
    });
    const input = uploadCreateInput.parse({
      mimeType: file.type,
      base64: data.slice(data.indexOf(",") + 1),
      purpose: "mobile-content",
    });
    return uploadRefSchema.parse(await trpc.uploads.create.mutate(input));
  },
};
