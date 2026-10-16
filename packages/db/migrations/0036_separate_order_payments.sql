ALTER TABLE [order] ADD COLUMN payment_flow_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE [order] ADD COLUMN merchant_payment_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE [order] ADD COLUMN self_delivery_user_id TEXT REFERENCES user(id) ON DELETE RESTRICT;
CREATE TABLE payment_account (
 id TEXT PRIMARY KEY NOT NULL,
 business_id TEXT REFERENCES business(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, recipient_name TEXT NOT NULL, updated_at INTEGER NOT NULL,
 CHECK((business_id IS NOT NULL) != (user_id IS NOT NULL))
);
CREATE UNIQUE INDEX payment_account_business_unique ON payment_account(business_id);
CREATE UNIQUE INDEX payment_account_user_unique ON payment_account(user_id);
CREATE TABLE order_payment (
 id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES [order](id) ON DELETE RESTRICT,
 purpose TEXT NOT NULL CHECK(purpose IN ('MERCHANT_ORDER','COURIER_COLLECTION','MERCHANT_DELIVERY')),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>=0), currency TEXT NOT NULL,
 payer TEXT NOT NULL CHECK(payer IN ('CUSTOMER','COURIER','MERCHANT')),
 payee TEXT NOT NULL CHECK(payee IN ('COURIER','MERCHANT')),
 method TEXT NOT NULL CHECK(method IN ('CASH','SINPE_MOVIL')),
 status TEXT NOT NULL CHECK(status IN ('AWAITING_PAYMENT','AWAITING_VERIFICATION','CONFIRMED','REJECTED','NOT_REQUIRED')),
 payee_name TEXT NOT NULL, sinpe_phone TEXT, current_proof_id TEXT, rejection_reason TEXT,
 version INTEGER NOT NULL DEFAULT 0, confirmed_at INTEGER,
 reviewed_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX order_payment_purpose_unique ON order_payment(order_id,purpose);
CREATE TABLE order_payment_proof (
 id TEXT PRIMARY KEY NOT NULL, payment_id TEXT NOT NULL REFERENCES order_payment(id) ON DELETE RESTRICT,
 uploader_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 key TEXT NOT NULL, mime_type TEXT NOT NULL, sha256 TEXT NOT NULL, reference TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX order_payment_proof_hash_unique ON order_payment_proof(sha256);
CREATE INDEX order_payment_proof_payment_idx ON order_payment_proof(payment_id);
CREATE TRIGGER order_payment_proof_immutable BEFORE UPDATE ON order_payment_proof
BEGIN SELECT RAISE(ABORT,'Payment evidence is immutable'); END;
CREATE TRIGGER order_payment_amount_immutable BEFORE UPDATE OF amount_minor,currency,payer,payee,purpose,order_id ON order_payment
BEGIN SELECT RAISE(ABORT,'Payment obligations are immutable'); END;
CREATE TRIGGER order_payment_not_cancelled BEFORE UPDATE OF status,method,current_proof_id ON order_payment
WHEN EXISTS(SELECT 1 FROM [order] WHERE id=OLD.order_id AND status IN ('CANCELLED','REJECTED'))
BEGIN SELECT RAISE(ABORT,'Order cancelled during payment verification'); END;
