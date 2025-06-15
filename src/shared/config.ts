require('dotenv').config();

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  logLevel: 'info' | 'debug' | 'warn' | 'error' | 'fatal' | 'trace';
  redisUrl: string;
  sandboxServiceUrl: string;
  adminApiKey: string;
}

function validateConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be one of: development, production, test`);
  }

  const port = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${process.env.API_PORT}. Must be a valid port number.`);
  }

  const logLevel = process.env.LOG_LEVEL || 'info';
  if (!['info', 'debug', 'warn', 'error', 'fatal', 'trace'].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be one of: info, debug, warn, error, fatal, trace`);
  }

  // In test environment, provide defaults for optional env vars
  const isTestEnv = nodeEnv === 'test';
  
  const redisUrl = process.env.REDIS_URL || (isTestEnv ? 'redis://test-redis:6379' : undefined);
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
  }

  const sandboxServiceUrl = process.env.SANDBOX_SERVICE_URL || (isTestEnv ? 'http://test-sandbox:8080' : undefined);
  if (!sandboxServiceUrl) {
    throw new Error('SANDBOX_SERVICE_URL environment variable is required');
  }

  const adminApiKey = process.env.ADMIN_API_KEY || (isTestEnv ? 'test-admin-key' : undefined);
  if (!adminApiKey) {
    throw new Error('ADMIN_API_KEY environment variable is required');
  }

  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    port,
    logLevel: logLevel as AppConfig['logLevel'],
    redisUrl,
    sandboxServiceUrl,
    adminApiKey,
  };
}

export const config = validateConfig();