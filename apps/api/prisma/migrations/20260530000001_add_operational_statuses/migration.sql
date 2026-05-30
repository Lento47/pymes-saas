-- Add new conversation statuses for AI-assisted inbox
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'IA_ATTENDING';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_HUMAN';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'WAITING_CLIENT';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'SPAM';

-- Add missing task statuses
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add agent testing mode
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'TESTING';
