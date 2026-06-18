import pino from 'pino';
import pinoHttpPkg from 'pino-http';
import { env, isProd } from './env.js';

const pinoHttp = (pinoHttpPkg as any).default ?? (pinoHttpPkg as any);

const isServerless = !!process.env.VERCEL;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: !isProd && !isServerless
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      }
    : undefined,
});

export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
});
