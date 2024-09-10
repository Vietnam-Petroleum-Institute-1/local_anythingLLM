-- AlterTable
ALTER TABLE `event_logs` MODIFY `metadata` TEXT NULL;

-- AlterTable
ALTER TABLE `workspace_documents` MODIFY `metadata` TEXT NULL;

-- AlterTable
ALTER TABLE `workspaces` MODIFY `openAiPrompt` TEXT NULL;
