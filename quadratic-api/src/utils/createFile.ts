import { uploadStringAsFileS3 } from '../aws/s3';
import dbClient from '../dbClient';

export async function createFile({
  contents,
  name,
  userId,
  version,
  teamId,
}: {
  contents: string;
  name: string;
  userId: number;
  version: string;
  teamId?: number;
}) {
  // Create file in db
  const dbFile = await dbClient.file.create({
    data: {
      creatorUserId: userId,
      name,
      // Team file or personal file?
      ...(teamId ? { ownerTeamId: teamId } : { ownerUserId: userId }),
    },
    select: {
      id: true,
      uuid: true,
      name: true,
      ownerTeam: true,
    },
  });

  // Upload file contents to S3 and create a checkpoint
  const { uuid, id: fileId } = dbFile;
  const response = await uploadStringAsFileS3(`${uuid}-0.grid`, contents);

  await dbClient.fileCheckpoint.create({
    data: {
      fileId,
      sequenceNumber: 0,
      s3Bucket: response.bucket,
      s3Key: response.key,
      version: version,
    },
  });

  return dbFile;
}
