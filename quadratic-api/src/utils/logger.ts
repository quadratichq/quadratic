import winston from 'winston';
import { NODE_ENV } from '../env-vars';

const env = NODE_ENV || 'development';
const isDevelopment = env === 'development';

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

// Create the logger format for development
const devFormat = winston.format.combine(
  winston.format.simple(),
  winston.format((info) => ({
    ...info,
    level: `[${info.level.toUpperCase()}]`,
    message: typeof info.message === 'string' ? info.message.replace(/\n/g, '\r') : info.message,
  }))(),
  winston.format.colorize({ level: true }),
  winston.format.errors({ stack: true })
);

// Create the logger format for production
const prodFormat = winston.format.combine(winston.format.errors({ stack: true }), winston.format.json());

// Use the appropriate format based on the environment
const format = isDevelopment ? devFormat : prodFormat;

// Define which log levels to use based on environment
const level = () => {
  return isDevelopment ? 'debug' : 'info';
};

// Console transport
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: level(),
    format,
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
