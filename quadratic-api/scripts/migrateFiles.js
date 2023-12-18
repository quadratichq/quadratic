const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');

const prisma = new PrismaClient();

async function migrateFiles() {
  const unmigrated_files = await prisma.File.findMany({
    where: {
      contents: {
        not: null,
      },
    },
  });

  console.log('There are ' + unmigrated_files.length + ' files to migrate.');

  unmigrated_files.forEach(async (file) => {
    console.log('Migrating file ' + file.uuid + '...');

    console.log('Creating file checkpoint...');
    // TODO upload to S3
    const fileContents = file.contents;

    // create file checkpoint
    await prisma.fileCheckpoint.create({
      data: {
        file: {
          connect: {
            fileId: file.id,
          },
        },
        data: fileContents,
        version: file.version,
        sequenceNumber: 0,
      },
    });

    // set contents to null (mark file as migrated)
    await prisma.File.update({
      where: {
        uuid: file.uuid,
      },
      data: {
        contents: null,
      },
    });

    console.log('File ' + file.uuid + ' migrated.');
  });
}

migrateFiles()
  .catch((error) => {
    console.error('Error seeding the database:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
