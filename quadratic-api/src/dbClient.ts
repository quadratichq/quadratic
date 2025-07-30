import { PrismaClient } from '@prisma/client';
import { NODE_ENV } from './env-vars';
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

// Wire up Prisma logging to winston
dbClient.$on('query', (e) => {
  if (NODE_ENV === 'development') {
    prismaLogger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      target: e.target,
    });
  }
});

dbClient.$on('error', (e) => {
  prismaLogger.error('Prisma error', {
    message: e.message,
    target: e.target,
  });
});

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

export default dbClient;
