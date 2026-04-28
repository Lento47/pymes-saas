export interface PasswordResetTokenPayload {
  type: 'password-reset';
  user_id: string;
  /**
   * First 16 chars of the user's current password_hash. After a successful
   * reset, the hash changes so any in-flight token is invalidated without a
   * separate jti table.
   */
  hash_fingerprint: string;
}
