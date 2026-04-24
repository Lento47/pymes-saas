export function validateJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  if (!/[A-Z]/.test(secret) || !/[0-9]/.test(secret) || !/[!@#$%^&*]/.test(secret)) {
    console.warn(
      '⚠️  JWT_SECRET should contain uppercase letters, numbers, and special characters for better security'
    );
  }

  return secret;
}
