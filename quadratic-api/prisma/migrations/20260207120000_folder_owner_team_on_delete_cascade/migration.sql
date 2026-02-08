-- AlterTable
-- Change Folder.owner_team_id FK from ON DELETE RESTRICT to ON DELETE CASCADE
-- so that when a team is deleted, its folders are automatically removed.
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_owner_team_id_fkey";
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
