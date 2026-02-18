import fs from 'fs';
import path from 'path';
import dbClient from '../dbClient';
import { S3Bucket } from '../storage/s3';
import { uploadFile } from '../storage/storage';

export async function createFile({
  contents,
  name,
  userId,
  version,
  teamId,
  isPrivate,
  jwt,
  folderId,
}: {
  contents?: string;
  name: string;
  userId: number;
  version: string;
  teamId: number;
  isPrivate?: boolean;
  jwt: string;
  folderId?: number;
}) {
  return await dbClient.$transaction(async (transaction) => {
    // Create file in db
    const dbFile = await transaction.file.create({
      data: {
        creatorUserId: userId,
        name,
        ownerTeamId: teamId,
        // Is the file public to the entire team or private to the user creating it?
        ...(isPrivate ? { ownerUserId: userId } : {}),
        ...(folderId ? { folderId } : {}),
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        ownerTeam: true,
      },
    });

    if (!contents) {
      const fileName = './../data/current_blank.grid';
      const realFileName = path.resolve(__dirname, fileName);
      contents = fs.readFileSync(realFileName, 'base64');
    }

    // Upload file contents to S3 and create a checkpoint
    const { uuid, id: fileId } = dbFile;
    const response = await uploadFile(`${uuid}-0.grid`, contents, jwt, S3Bucket.FILES);

    await transaction.fileCheckpoint.create({
      data: {
        fileId,
        sequenceNumber: 0,
        s3Bucket: response.bucket,
        s3Key: response.key,
        version: version,
      },
    });

    return dbFile;
  });
}
