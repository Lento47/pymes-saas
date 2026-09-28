import { z } from "zod";

export const devicePlatformSchema = z.enum(["ios", "android"]);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

export const expoPushTokenSchema = z
	.string()
	.trim()
	.max(256)
	.regex(/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]+\]$/);

export const registerDeviceTokenInput = z.object({
	token: expoPushTokenSchema,
	platform: devicePlatformSchema,
});
export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenInput>;

export const revokeDeviceTokenInput = z.object({ token: expoPushTokenSchema });
export type RevokeDeviceTokenInput = z.infer<typeof revokeDeviceTokenInput>;
