import request from 'supertest';
import { createApiServer } from './index';
import { InMemoryStateStore } from '../core/state/in-memory-state-store';
import { WorkflowManager } from '../core/workflow-manager';
import { ToolExecutor } from '../core/tool-executor';
import { CapabilityRegistry } from '../core/capability-registry';
import { InMemoryCapabilityStore } from '../core/in-memory-capability-store';
import { InMemoryCapabilityEventBus } from '../core/in-memory-capability-event-bus';
import { createChildLogger } from '../shared/logger';

describe.skip('Session API Integration Tests', () => {
  let app: any;
  let workflowManager: WorkflowManager;

  beforeAll(async () => {
    // Create test environment without requiring Redis
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    // Set up in-memory dependencies
    const stateStore = new InMemoryStateStore();
    const centralCapabilityStore = new InMemoryCapabilityStore();
    const capabilityEventBus = new InMemoryCapabilityEventBus();
    const capabilityRegistry = new CapabilityRegistry(centralCapabilityStore, capabilityEventBus);
    const toolExecutor = new ToolExecutor(capabilityRegistry);
    workflowManager = new WorkflowManager(toolExecutor, stateStore, createChildLogger('WorkflowManager'));
    
    // Load test capabilities
    await loadTestCapabilities(capabilityRegistry);
    
    // Create API server with test dependencies
    app = await createApiServer({
      workflowManager,
      centralCapabilityStore,
      capabilityEventEmitter: capabilityEventBus,
      adminApiKey: 'test-admin-key'
    });
    
    // Ready the Fastify instance for testing
    await app.ready();
  });

  async function loadTestCapabilities(registry: CapabilityRegistry) {
    // Load a simple greeting plan for testing
    const greetingPlan = {
      planId: 'interaction::greeting',
      description: 'Simple greeting plan',
      parameters: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const }
        },
        required: ['name']
      },
      startStepId: 'greeting_step',
      steps: [{
        id: 'greeting_step',
        type: 'final_response' as const,
        message: { jsonPath: '$.promptInput.name' }
      }]
    };
    await registry.registerPlan(greetingPlan);
  }

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /sessions', () => {
    it('should create a new session', async () => {
      const response = await request(app)
        .post('/sessions')
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });
  });

  describe('GET /sessions/:sessionId', () => {
    let sessionId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/sessions')
        .expect(201);
      sessionId = createResponse.body.sessionId;
    });

    it('should retrieve session details', async () => {
      const response = await request(app)
        .get(`/sessions/${sessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('core');
      expect(response.body).toHaveProperty('context');
      expect(response.body).toHaveProperty('history');
      expect(response.body.core.sessionId).toBe(sessionId);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app)
        .get('/sessions/non-existent-id')
        .expect(404);
    });
  });

  describe('POST /sessions/:sessionId/execute-plan', () => {
    let sessionId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/sessions')
        .expect(201);
      sessionId = createResponse.body.sessionId;
    });

    it('should execute a plan by planId', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/execute-plan`)
        .send({
          planId: 'interaction::greeting',
          parameters: {
            name: 'Test User'
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('sessionId', sessionId);
      expect(response.body).toHaveProperty('status');
    });

    it('should return 400 for invalid plan execution request', async () => {
      await request(app)
        .post(`/sessions/${sessionId}/execute-plan`)
        .send({
          // Missing required fields
        })
        .expect(400);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app)
        .post('/sessions/non-existent-id/execute-plan')
        .send({
          planId: 'interaction::greeting',
          parameters: {}
        })
        .expect(404);
    });
  });

  describe('GET /capabilities', () => {
    it('should list all available capabilities', async () => {
      const response = await request(app)
        .get('/capabilities')
        .expect(200);

      expect(response.body).toHaveProperty('tools');
      expect(response.body).toHaveProperty('plans');
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(Array.isArray(response.body.plans)).toBe(true);
    });
  });

  describe('POST /capabilities/discover', () => {
    it('should search capabilities by query', async () => {
      const response = await request(app)
        .post('/capabilities/discover')
        .send({
          query: 'greeting'
        })
        .expect(200);

      expect(response.body).toHaveProperty('tools');
      expect(response.body).toHaveProperty('plans');
    });

    it('should return 400 for missing query', async () => {
      await request(app)
        .post('/capabilities/discover')
        .send({})
        .expect(400);
    });
  });
});