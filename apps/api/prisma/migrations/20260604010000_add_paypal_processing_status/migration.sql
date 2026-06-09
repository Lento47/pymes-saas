-- Add PROCESSING status to PaypalPaymentStatus enum
-- Used to atomically lock an order before calling PayPal capture API,
-- preventing double-capture on concurrent requests.
ALTER TYPE "PaypalPaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
