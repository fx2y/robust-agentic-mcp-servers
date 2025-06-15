import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SessionCore, HistoryEntry } from '../shared/types';
import { CreateSessionRequest, ExecutePlanRequest, ResumeSessionRequest } from './types';
import { ApiDependencies } from './index';

export async function sessionRoutes(fastify: FastifyInstance) {
  const { workflowManager } = fastify.dependencies as ApiDependencies;

  const createSessionSchema = {
    body: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' }
      },
      additionalProperties: false
    },
    response: {
      201: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' }
        },
        required: ['sessionId', 'status', 'createdAt', 'updatedAt']
      }
    }
  };

  const getSessionSchema = {
    params: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' }
      },
      required: ['sessionId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          core: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            },
            required: ['sessionId', 'status', 'createdAt', 'updatedAt']
          },
          context: { type: 'object' },
          history: { type: 'array' }
        },
        required: ['core', 'context', 'history']
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        },
        required: ['error']
      }
    }
  };

  const executePlanSchema = {
    params: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' }
      },
      required: ['sessionId']
    },
    body: {
      type: 'object',
      properties: {
        plan: { type: 'object' },
        initialArgs: { type: 'object' }
      },
      required: ['plan'],
      additionalProperties: false
    },
    response: {
      202: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['sessionId', 'status']
      }
    }
  };

  const resumeSessionSchema = {
    params: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' }
      },
      required: ['sessionId']
    },
    body: {
      type: 'object',
      properties: {
        input: { type: 'object' }
      },
      required: ['input'],
      additionalProperties: false
    },
    response: {
      202: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['sessionId', 'status']
      }
    }
  };

  fastify.post<{ Body: CreateSessionRequest }>('/', {
    schema: createSessionSchema
  }, async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
    try {
      const session = await workflowManager.createSession(request.body.sessionId);
      reply.code(201).send(session);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create session' });
    }
  });

  fastify.get<{ Params: { sessionId: string } }>('/:sessionId', {
    schema: getSessionSchema
  }, async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const session = await workflowManager.getSession(request.params.sessionId);
      if (!session) {
        reply.code(404).send({ error: 'Session not found' });
        return;
      }
      reply.send(session);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to retrieve session' });
    }
  });

  fastify.post<{ Params: { sessionId: string }, Body: ExecutePlanRequest }>('/:sessionId/execute-plan', {
    schema: executePlanSchema
  }, async (request: FastifyRequest<{ Params: { sessionId: string }, Body: ExecutePlanRequest }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const { plan, initialArgs } = request.body;
      
      const result = await workflowManager.executePlan(sessionId, plan, initialArgs);
      reply.code(202).send({ sessionId: result.sessionId, status: result.status });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to execute plan' });
    }
  });

  fastify.post<{ Params: { sessionId: string }, Body: ResumeSessionRequest }>('/:sessionId/resume', {
    schema: resumeSessionSchema
  }, async (request: FastifyRequest<{ Params: { sessionId: string }, Body: ResumeSessionRequest }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const { input } = request.body;
      
      const result = await workflowManager.resumeSession(sessionId, input);
      reply.code(202).send({ sessionId: result.sessionId, status: result.status });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to resume session' });
    }
  });
}