-- Add IMAGE value to MessageType enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- PostgreSQL 16 (Azure Flexible Server) supports it in transactions.
ALTER TYPE "MessageType" ADD VALUE 'IMAGE';

-- Add seenAt to messages: NULL means unseen/unread.
ALTER TABLE "messages" ADD COLUMN "seenAt" TIMESTAMP(3);
