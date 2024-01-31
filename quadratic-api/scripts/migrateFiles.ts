import { PrismaClient } from '@prisma/client';
import { uploadStringAsFileS3 } from '../src/aws/s3';

const prisma = new PrismaClient();

async function migrateFiles() {
  console.log('Migrating files started.');

  const files_to_migrate = await prisma.file.findMany({
    where: {
      contents: {
        not: null,
      },
    },
  });

  console.log('There are ' + files_to_migrate.length + ' files to migrate.');

  files_to_migrate.forEach(async (file) => {
    console.log('Migrating file ' + file.uuid + '...');

    console.log('Creating file checkpoint...');
    if (file.contents && file.version) {
      const file_contents_string = file.contents.toString('utf-8');
      const response = await uploadStringAsFileS3(`${file.uuid}-0.grid`, file_contents_string);

      await prisma.fileCheckpoint.create({
        data: {
          fileId: file.id,
          sequenceNumber: 0,
          s3Bucket: response.bucket,
          s3Key: response.key,
          version: file.version,
        },
      });

      // set contents to null (mark file as migrated)
      await prisma.file.update({
        where: {
          uuid: file.uuid,
        },
        data: {
          contents: null,
          version: null,
        },
      });

      console.log('File ' + file.uuid + ' migrated.');
    } else {
      console.log('File ' + file.uuid + ' has no contents.');
    }
  });
}

migrateFiles()
  .catch((error) => {
    console.error('Error migrating files:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Disconnected from database.');
    console.log('Finished migrating files.');
  });
