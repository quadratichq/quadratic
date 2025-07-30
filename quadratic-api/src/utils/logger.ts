import winston from 'winston';
import { NODE_ENV } from '../env-vars';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Create the logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which log levels to use based on environment
const level = () => {
  const env = NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Console transport
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: level(),
    format: winston.format.combine(winston.format.colorize({ all: true }), winston.format.simple()),
  }),
];

// Create the winston logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // exit on handled exceptions
  exitOnError: false,
});

// Prisma logging integration
export const prismaLogger = {
  trace: (message: string, ...args: any[]) => logger.debug(message, { context: 'prisma', args }),
  debug: (message: string, ...args: any[]) => logger.debug(message, { context: 'prisma', args }),
  info: (message: string, ...args: any[]) => logger.info(message, { context: 'prisma', args }),
  warn: (message: string, ...args: any[]) => logger.warn(message, { context: 'prisma', args }),
  error: (message: string, ...args: any[]) => logger.error(message, { context: 'prisma', args }),
};

export default logger;
