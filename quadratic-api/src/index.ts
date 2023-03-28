import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { validateAccessToken } from './middleware/auth';
import { Request as JWTRequest } from 'express-jwt';

const prisma = new PrismaClient();

const app = express();

// set CORS (TODO: this is not configured for production)
const origin = process.env.CORS || 'http://localhost:3000';
app.use(cors({ origin }));

// set routes
app.get('/', validateAccessToken, async (req: JWTRequest, res: express.Response) => {
  const user = await prisma.qUser.upsert({
    where: {
      auth0_user_id: req.auth?.sub,
    },
    update: {},
    create: {
      auth0_user_id: req.auth?.sub,
    },
  });

  const files = await prisma.qFile.findMany({
    where: {
      user_owner: user,
    },
  });

  res.json({
    files: files,
  });
});

app.get('/createFile', validateAccessToken, async (req: JWTRequest, res: express.Response) => {
  const user = await prisma.qUser.upsert({
    where: {
      auth0_user_id: req.auth?.sub,
    },
    update: {},
    create: {
      auth0_user_id: req.auth?.sub,
    },
  });

  const new_file = await prisma.qFile.create({
    data: {
      name: 'first file!',
      qUserId: user.id,
    },
  });

  res.json({
    created: new_file,
  });
});

app.listen(8000);

console.log('Listening on http://localhost:8000');
