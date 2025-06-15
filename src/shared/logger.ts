import pino from 'pino';
import { config } from './config';

const isDevelopment = config.nodeEnv === 'development';

export const logger = pino({
  level: config.logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  base: {
    service: 'agentic-mcp-server',
    env: config.nodeEnv,
  },
});

export function createChildLogger(service: string, context?: Record<string, any>) {
  return logger.child({
    service,
    ...context,
  });
}