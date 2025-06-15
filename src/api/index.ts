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

  // Admin routes
  server.post('/admin/capabilities', {
    schema: {
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['tool', 'plan'] },
          definition: { type: 'object' }
        },
        required: ['type', 'definition'],
        additionalProperties: false
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' }
          },
          required: ['id', 'status']
        }
      }
    },
    preHandler: async (request, reply) => {
      const authHeader = request.headers.authorization as string;
      const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!dependencies.adminApiKey || apiKey !== dependencies.adminApiKey) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
    }
  }, async (request, reply) => {
    try {
      const { type, definition } = request.body as any;
      const id = 'id' in definition ? definition.id : definition.planId;
      
      if (!id) {
        reply.code(400).send({ error: 'Capability definition must have an id or planId' });
        return;
      }

      await dependencies.centralCapabilityStore.save(id, type, definition);
      
      await dependencies.capabilityEventEmitter.emit({
        type: 'capability.updated',
        id,
        capabilityType: type
      });

      reply.code(201).send({ id, status: 'registered' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to register capability' });
    }
  });

  return server;
}