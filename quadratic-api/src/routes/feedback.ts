import express from 'express';
import { validateAccessToken } from '../middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
// import { z } from 'zod';
import rateLimit from 'express-rate-limit';
// import { PrismaClient } from '@prisma/client';
// import { get_user } from '../helpers/get_user';
// import { get_file } from '../helpers/get_file';
// import { get_file_metadata } from '../helpers/read_file';

const files_router = express.Router();
// const prisma = new PrismaClient();

const ai_rate_limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: JWTRequest, response) => {
    return request.auth?.sub || 'anonymous';
  },
});

// const FilesBackupRequestBody = z.object({
//   uuid: z.string(),
//   fileContents: z.any(),
// });

// type FilesBackupRequestBodyType = z.infer<typeof FilesBackupRequestBody>;
files_router.post('/', validateAccessToken, ai_rate_limiter, async (request: JWTRequest, response) => {
  console.log(request);
  response.status(200).json({ message: 'File backup successful.' });

  // const r_json = FilesBackupRequestBody.parse(request.body);

  // const user = await get_user(request);
  // const file = await get_file(user, r_json.uuid);

  // const file_contents = JSON.parse(r_json.fileContents);
  // const file_metadata = get_file_metadata(file_contents);

  // await prisma.qFile.create({
  //   data: {
  //     qUserId: user.id,
  //     uuid: r_json.uuid,
  //     name: file_metadata.name,
  //     contents: file_contents,
  //     created_date: new Date(file_metadata.created),
  //     updated_date: new Date(file_metadata.modified),
  //     version: file_metadata.version,
  //   },
  // });

  response.status(200).json({ message: 'File backup successful.' });
});

export default files_router;
