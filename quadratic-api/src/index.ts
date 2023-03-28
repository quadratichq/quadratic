import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { validateAccessToken } from './middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
import { z } from 'zod';
import { Configuration, OpenAIApi } from 'openai';
import { AxiosError } from 'axios';
import { RequiredError } from 'openai/dist/base';

const prisma = new PrismaClient();

const app = express();
app.use(express.json());

// set CORS (TODO: this is not configured for production)
const origin = process.env.CORS || 'http://localhost:3000';
app.use(cors({ origin }));

const getUserFromRequest = async (req: JWTRequest) => {
  const user = await prisma.qUser.upsert({
    where: {
      auth0_user_id: req.auth?.sub,
    },
    update: {},
    create: {
      auth0_user_id: req.auth?.sub,
    },
  });
  return user;
};

// set routes
app.get('/', validateAccessToken, async (req: JWTRequest, res: express.Response) => {
  const user = await getUserFromRequest(req);

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
  const user = await getUserFromRequest(req);

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

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const AIMessage = z.object({
  // role can be only "user" or "bot"
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const AIAutoCompleteRequestBody = z.object({
  messages: z.array(AIMessage),
  // optional model to use either "gpt-4" or "gpt-3-turbo"
  model: z.enum(['gpt-4', 'gpt-3-turbo']).optional(),
});

app.post('/ai/autocomplete', validateAccessToken, async (request, response) => {
  // const user = await getUserFromRequest(request);
  // todo rate limit by user

  const r_json = AIAutoCompleteRequestBody.parse(request.body);

  try {
    const result = await openai.createChatCompletion({
      model: r_json.model || 'gpt-4',
      messages: r_json.messages,
    });

    response.json({
      data: result.data,
    });
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
      // console.log(error.response.status);
      // console.log(error.response.data);
    } else {
      response.status(400).json(error.message);
      // console.log(error.message);
    }
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
