import { CapabilityRegistry } from './core/capability-registry';
import { ToolExecutor } from './core/tool-executor';
import { InMemoryStateStore } from './core/state/in-memory-state-store';
import { WorkflowManager } from './core/workflow-manager';
import { ContextResolver } from './core/agentic-plan/context-resolver';
import { PlanExecutor } from './core/agentic-plan/plan-executor';
import { InMemoryEventBus } from './core/event-bus/in-memory-event-bus';
import { SupervisorService } from './services/supervisor.service';
import { AgenticPlan } from './core/agentic-plan/types';

export class AgenticMCPServer {
  private capabilityRegistry: CapabilityRegistry;
  private toolExecutor: ToolExecutor;
  private stateStore: InMemoryStateStore;
  private workflowManager: WorkflowManager;
  private contextResolver: ContextResolver;
  private planExecutor: PlanExecutor;
  private eventBus: InMemoryEventBus;
  private supervisorService: SupervisorService;

  constructor() {
    // Initialize core components with dependency injection
    this.capabilityRegistry = new CapabilityRegistry();
    this.toolExecutor = new ToolExecutor(this.capabilityRegistry);
    this.stateStore = new InMemoryStateStore();
    this.workflowManager = new WorkflowManager(this.toolExecutor, this.stateStore);
    this.contextResolver = new ContextResolver();
    this.eventBus = new InMemoryEventBus();
    
    // Initialize plan executor with event emitter
    this.planExecutor = new PlanExecutor(
      this.workflowManager,
      this.capabilityRegistry,
      this.contextResolver,
      this.eventBus
    );

    // Initialize supervisor service
    this.supervisorService = new SupervisorService(
      this.eventBus,
      this.stateStore,
      this.workflowManager,
      this.capabilityRegistry
    );
  }

  async start(): Promise<void> {
    console.log('Starting Agentic MCP Server...');
    
    // Load capabilities (tools and plans)
    await this.loadCapabilities();
    
    // Start the supervisor service to listen for workflow events
    this.supervisorService.startListening();
    console.log('Supervisor service started and listening for workflow events');
    
    console.log('Agentic MCP Server started successfully');
    console.log('Available capabilities:', this.capabilityRegistry.listAllCapabilities());
  }

  private async loadCapabilities(): Promise<void> {
    // This would typically load capabilities from the filesystem
    // For now, we'll register the existing test capabilities
    
    console.log('Loading capabilities...');
    
    try {
      // Load math tools
      const { definition: addDefinition, implementation: addImplementation } = await import('./capabilities/tools/math/add.tool');
      this.capabilityRegistry.registerTool(addDefinition, addImplementation);
      
      // Load validation tools
      const { definition: isPositiveDefinition, implementation: isPositiveImplementation } = await import('./capabilities/tools/validate/is_positive.tool');
      this.capabilityRegistry.registerTool(isPositiveDefinition, isPositiveImplementation);
      
      // Load plans
      const conditionalAddPlan = await import('./capabilities/plans/math/conditional_add.plan.json');
      this.capabilityRegistry.registerPlan(conditionalAddPlan.default as AgenticPlan);
      
      const greetingPlan = await import('./capabilities/plans/interaction/greeting.plan.json');
      this.capabilityRegistry.registerPlan(greetingPlan.default as AgenticPlan);
      
      console.log('Capabilities loaded successfully');
    } catch (error) {
      console.error('Error loading capabilities:', error);
      throw error;
    }
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
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}