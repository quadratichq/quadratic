import { PrismaClient } from '@prisma/client';
import { prismaLogger } from './utils/logger';

const dbClient = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// intentially commented out, but leaving here so that it can be turned on for debugging
// dbClient.$on('query', (e) => {
//   if (NODE_ENV === 'development') {
//     prismaLogger.info('Query executed', {
//       query: e.query,
//       params: e.params,
//       duration: `${e.duration}ms`,
//       target: e.target,
//     });
//   }
// });

dbClient.$on('info', (e) => {
  prismaLogger.info('Prisma info', {
    message: e.message,
    target: e.target,
  });
});

dbClient.$on('warn', (e) => {
  prismaLogger.warn('Prisma warning', {
    message: e.message,
    target: e.target,
  });
});

dbClient.$on('error', (e) => {
  prismaLogger.error('Prisma error', {
    message: e.message,
    target: e.target,
  });
});

export default dbClient;
