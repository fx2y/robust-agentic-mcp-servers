import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityListing, RegisterCapabilityRequest, DiscoverCapabilitiesRequest } from './types';
import { ApiDependencies } from './index';
import { ToolDefinition } from '../core/tool-definition';
import { AgenticPlan } from '../core/agentic-plan/plan-executor';

export async function capabilityRoutes(fastify: FastifyInstance) {
  const { centralCapabilityStore, capabilityEventEmitter, adminApiKey } = fastify.dependencies as ApiDependencies;

  const authenticationHook = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!adminApiKey || apiKey !== adminApiKey) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  };

  const listCapabilitiesSchema = {
    response: {
      200: {
        type: 'object',
        properties: {
          tools: { type: 'array' },
          plans: { type: 'array' }
        },
        required: ['tools', 'plans']
      }
    }
  };

  const discoverCapabilitiesSchema = {
    body: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query'],
      additionalProperties: false
    },
    response: {
      200: {
        type: 'object',
        properties: {
          tools: { type: 'array' },
          plans: { type: 'array' }
        },
        required: ['tools', 'plans']
      }
    }
  };

  const registerCapabilitySchema = {
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
  };

  fastify.get('/', {
    schema: listCapabilitiesSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const capabilities = await centralCapabilityStore.listAll();
      const listing: CapabilityListing = {
        tools: capabilities.filter(c => c.type === 'tool').map(c => c.definition as ToolDefinition),
        plans: capabilities.filter(c => c.type === 'plan').map(c => c.definition as AgenticPlan)
      };
      reply.send(listing);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to list capabilities' });
    }
  });

  fastify.post<{ Body: DiscoverCapabilitiesRequest }>('/discover', {
    schema: discoverCapabilitiesSchema
  }, async (request: FastifyRequest<{ Body: DiscoverCapabilitiesRequest }>, reply: FastifyReply) => {
    try {
      const { query, limit = 10 } = request.body;
      const capabilities = await centralCapabilityStore.listAll();
      
      const filteredCapabilities = capabilities.filter(cap => {
        const definition = cap.definition;
        const id = 'id' in definition ? definition.id : definition.planId;
        const searchText = `${id || ''} ${definition.description || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      const limitedCapabilities = filteredCapabilities.slice(0, limit);
      const listing: CapabilityListing = {
        tools: limitedCapabilities.filter(c => c.type === 'tool').map(c => c.definition as ToolDefinition),
        plans: limitedCapabilities.filter(c => c.type === 'plan').map(c => c.definition as AgenticPlan)
      };
      
      reply.send(listing);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to discover capabilities' });
    }
  });

  fastify.post<{ Body: RegisterCapabilityRequest }>('/admin/capabilities', {
    schema: registerCapabilitySchema,
    preHandler: authenticationHook
  }, async (request: FastifyRequest<{ Body: RegisterCapabilityRequest }>, reply: FastifyReply) => {
    try {
      const { type, definition } = request.body;
      const id = 'id' in definition ? definition.id : definition.planId;
      
      if (!id) {
        reply.code(400).send({ error: 'Capability definition must have an id or planId' });
        return;
      }

      await centralCapabilityStore.save(id, type, definition);
      
      await capabilityEventEmitter.emit({
        type: 'capability.updated',
        id,
        capabilityType: type
      });

      reply.code(201).send({ id, status: 'registered' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to register capability' });
    }
  });
}