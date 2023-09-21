import { NextFunction, Response } from 'express';
import dbClient from '../../dbClient';
import { Request } from '../../types/Request';

export const fileMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uuid === undefined) {
    return res.status(400).json({ error: { message: 'Invalid file UUID' } });
  }

  const file = await dbClient.file.findUnique({
    where: {
      uuid: req.params.uuid,
    },
  });

  if (file === null) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  if (file.deleted) {
    return res.status(400).json({ error: { message: 'File has been deleted' } });
  }

  if (file.ownerUserId !== req?.user?.id) {
    if (file.public_link_access === 'NOT_SHARED') {
      return res.status(403).json({ error: { message: 'Permission denied' } });
    }
  }

  req.file = file;
  next();
};
