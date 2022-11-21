import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = express();

app.get('/', async (req, res) => {
  const files = await prisma.qGrid.findMany();

  res.json({
    files: files,
  });
});

app.get('/createFile', async (req, res) => {
  const new_file = await prisma.qGrid.create({
    data: {
      name: 'first file!',
    },
  });

  res.json({
    created: new_file,
  });
});

app.listen(8000);

console.log('Listening on http://localhost:8000');
