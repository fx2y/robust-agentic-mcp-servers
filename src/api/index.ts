import Fastify, { FastifyInstance } from 'fastify';
import { IWorkflowManager } from '../core/workflow-manager';
import { ICentralCapabilityStore } from '../core/central-capability-store.interface';
import { ICapabilityEventEmitter } from '../core/capability-events.interface';
import { sessionRoutes } from './session.routes';
import { capabilityRoutes } from './capability.routes';

declare module 'fastify' {
  interface FastifyInstance {
    dependencies: ApiDependencies;
  }
}

export interface ApiDependencies {
  workflowManager: IWorkflowManager;
  centralCapabilityStore: ICentralCapabilityStore;
  capabilityEventEmitter: ICapabilityEventEmitter;
  adminApiKey?: string;
}

export async function createApiServer(dependencies: ApiDependencies): Promise<FastifyInstance> {
  const server = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['kind', 'modifier']
      }
    }
  });

  await server.register(require('@fastify/cors'), {
    origin: true
  });

  server.decorate('dependencies', dependencies);

  await server.register(sessionRoutes, { prefix: '/sessions' });
  await server.register(capabilityRoutes, { prefix: '/capabilities' });

  return server;
}