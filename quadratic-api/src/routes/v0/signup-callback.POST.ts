import type { Request, Response } from 'express';
import { signupCallback } from '../../auth/auth';

export default [handler];

async function handler(req: Request, res: Response) {
  await signupCallback(req, res);
}
