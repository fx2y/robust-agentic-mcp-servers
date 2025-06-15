import Redis from 'ioredis';
import { CapabilityRegistry } from './core/capability-registry';
import { ToolExecutor } from './core/tool-executor';
import { InMemoryStateStore } from './core/state/in-memory-state-store';
import { WorkflowManager } from './core/workflow-manager';
import { ContextResolver } from './core/agentic-plan/context-resolver';
import { PlanExecutor } from './core/agentic-plan/plan-executor';
import { InMemoryEventBus } from './core/event-bus/in-memory-event-bus';
import { SupervisorService } from './services/supervisor.service';
import { AgenticPlan } from './core/agentic-plan/plan-executor';
import { RedisCentralCapabilityStore } from './core/redis-central-capability-store';
import { RedisCapabilityEventBus } from './core/redis-capability-event-bus';
import { SandboxService } from './services/sandbox.service';
import { createApiServer } from './api/index';
import { config } from './shared/config';
import { logger, createChildLogger } from './shared/logger';


export class AgenticMCPServer {
  private redis: Redis;
  private centralCapabilityStore: RedisCentralCapabilityStore;
  private capabilityEventBus: RedisCapabilityEventBus;
  private capabilityRegistry: CapabilityRegistry;
  private toolExecutor: ToolExecutor;
  private stateStore: InMemoryStateStore;
  private workflowManager: WorkflowManager;
  private contextResolver: ContextResolver;
  private planExecutor: PlanExecutor;
  private eventBus: InMemoryEventBus;
  private supervisorService: SupervisorService;
  private sandboxService: SandboxService;
  private apiServer: any;
  private logger = createChildLogger('AgenticMCPServer');

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(config.redisUrl);
    
    // Initialize distributed stores and event bus
    this.centralCapabilityStore = new RedisCentralCapabilityStore(this.redis);
    this.capabilityEventBus = new RedisCapabilityEventBus(this.redis);
    
    // Initialize capability registry with distributed backend
    this.capabilityRegistry = new CapabilityRegistry(
      this.centralCapabilityStore,
      this.capabilityEventBus
    );
    
    // Initialize core components
    this.toolExecutor = new ToolExecutor(this.capabilityRegistry);
    this.stateStore = new InMemoryStateStore();
    this.contextResolver = new ContextResolver();
    this.eventBus = new InMemoryEventBus();
    
    // Initialize sandbox service
    this.sandboxService = new SandboxService(config.sandboxServiceUrl);
    
    // Initialize workflow manager first (without plan executor)
    this.workflowManager = new WorkflowManager(
      this.toolExecutor, 
      this.stateStore, 
      createChildLogger('WorkflowManager')
    );
    
    // Initialize plan executor with event emitter
    this.planExecutor = new PlanExecutor(
      this.workflowManager,
      this.capabilityRegistry,
      this.contextResolver,
      this.eventBus,
      createChildLogger('PlanExecutor')
    );
    
    // Now inject the plan executor back into workflow manager
    (this.workflowManager as any).planExecutor = this.planExecutor;

    // Initialize supervisor service
    this.supervisorService = new SupervisorService(
      this.eventBus,
      this.stateStore,
      this.workflowManager,
      this.capabilityRegistry,
      createChildLogger('SupervisorService')
    );
  }

  async start(): Promise<void> {
    this.logger.info('Starting Agentic MCP Server...');
    
    try {
      // Test Redis connection
      await this.redis.ping();
      this.logger.info('Redis connection established');
    } catch (error) {
      this.logger.fatal({ error }, 'Failed to connect to core dependency: Redis');
      process.exit(1);
    }
    
    // Start capability event listener
    this.capabilityEventBus.startListening();
    this.logger.info('Capability event bus started');
    
    // Load capabilities (tools and plans)
    await this.loadCapabilities();
    
    // Start the supervisor service to listen for workflow events
    await this.supervisorService.startListening();
    this.logger.info('Supervisor service started and listening for workflow events');
    
    // Create and start API server
    this.apiServer = await createApiServer({
      workflowManager: this.workflowManager,
      centralCapabilityStore: this.centralCapabilityStore,
      capabilityEventEmitter: this.capabilityEventBus,
      adminApiKey: config.adminApiKey
    });
    
    await this.apiServer.listen({ port: config.port, host: '0.0.0.0' });
    this.logger.info({ port: config.port }, 'MCP Server listening on port');
    
    this.logger.info('Agentic MCP Server started successfully');
    const capabilities = await this.capabilityRegistry.listAllCapabilities();
    this.logger.info({ capabilities }, 'Available capabilities loaded');
  }

  private async loadCapabilities(): Promise<void> {
    // This would typically load capabilities from the filesystem
    // For now, we'll register the existing test capabilities
    
    this.logger.info('Loading capabilities...');
    
    try {
      // Load math tools
      const { definition: addDefinition, implementation: addImplementation } = await import('./capabilities/tools/math/add.tool');
      await this.capabilityRegistry.registerTool(addDefinition, addImplementation);
      
      // Load validation tools
      const { definition: isPositiveDefinition, implementation: isPositiveImplementation } = await import('./capabilities/tools/validate/is_positive.tool');
      await this.capabilityRegistry.registerTool(isPositiveDefinition, isPositiveImplementation);
      
      // Load test tools
      const { definition: alwaysFailDefinition, implementation: alwaysFailImplementation } = await import('./capabilities/tools/test/always_fail.tool');
      await this.capabilityRegistry.registerTool(alwaysFailDefinition, alwaysFailImplementation);
      
      // Load python execution tool with sandbox service injection
      const { definition: executePythonDefinition, implementation: executePythonImplementation } = await import('./capabilities/tools/quick-data/execute_python_code.tool');
      await this.capabilityRegistry.registerTool(executePythonDefinition, executePythonImplementation(this.sandboxService));
      
      // Load plans
      const conditionalAddPlan = await import('./capabilities/plans/math/conditional_add.plan.json');
      await this.capabilityRegistry.registerPlan(conditionalAddPlan.default as AgenticPlan);
      
      const greetingPlan = await import('./capabilities/plans/interaction/greeting.plan.json');
      await this.capabilityRegistry.registerPlan(greetingPlan.default as AgenticPlan);
      
      const failureTestPlan = await import('./capabilities/plans/test/failure_test.plan.json');
      await this.capabilityRegistry.registerPlan(failureTestPlan.default as AgenticPlan);
      
      this.logger.info('Capabilities loaded successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error loading capabilities');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Agentic MCP Server...');
    
    if (this.apiServer) {
      await this.apiServer.close();
      this.logger.info('API server stopped');
    }
    
    await this.capabilityEventBus.disconnect();
    this.logger.info('Capability event bus disconnected');
    
    await this.redis.disconnect();
    this.logger.info('Redis connection closed');
    
    this.logger.info('Agentic MCP Server stopped');
  }

  // Getters for accessing components (useful for testing and API endpoints)
  getCapabilityRegistry() {
    return this.capabilityRegistry;
  }

  getWorkflowManager() {
    return this.workflowManager;
  }

  getPlanExecutor() {
    return this.planExecutor;
  }

  getEventBus() {
    return this.eventBus;
  }

  getStateStore() {
    return this.stateStore;
  }
}

// Main entry point
async function main() {
  const server = new AgenticMCPServer();
  
  try {
    await server.start();
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}