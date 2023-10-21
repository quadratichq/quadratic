import { NextFunction, Response } from 'express';
import dbClient from '../../../dbClient';
import { Request } from '../../../types/Request';

export const teamMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uuid === undefined) {
    return res.status(400).json({ error: { message: 'Invalid team UUID' } });
  }

  const team = await dbClient.team.findUnique({
    where: {
      uuid: req.params.uuid,
    },
  });

  if (team === null) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  // TODO
  // if (team.deleted) {
  //   return res.status(400).json({ error: { message: 'File has been deleted' } });
  // }

  // TODO make sure they have permission
  // if (team.ownerUserId !== req?.user?.id) {
  //   if (file.public_link_access === 'NOT_SHARED') {
  //     return res.status(403).json({ error: { message: 'Permission denied' } });
  //   }
  // }

  req.team = team;
  next();
};
