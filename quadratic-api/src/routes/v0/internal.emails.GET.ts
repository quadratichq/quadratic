import { Request, Response } from 'express';
import { templates } from '../../email/templates';

export default [handler];

async function handler(req: Request, res: Response) {
  return res.status(200).json(Object.keys(templates));
}
