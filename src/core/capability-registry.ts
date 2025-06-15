import { ToolDefinition, PureToolImplementation } from './tool-definition';
import { AgenticPlan } from './agentic-plan/plan-executor';
import { ICentralCapabilityStore } from './central-capability-store.interface';
import { ICapabilityEventListener } from './capability-events.interface';

export interface ICapabilityRegistry {
  // Tool-specific methods (from Phase 1)
  registerTool(definition: ToolDefinition, implementation: PureToolImplementation): Promise<void>;
  getToolDefinition(id: string): Promise<ToolDefinition | undefined>;
  getToolImplementation(id: string): PureToolImplementation | undefined;
  listAllToolDefinitions(): Promise<ToolDefinition[]>;

  // Plan-specific methods
  registerPlan(plan: AgenticPlan): Promise<void>;
  getPlan(id: string): Promise<AgenticPlan | undefined>;
  listAllPlans(): Promise<AgenticPlan[]>;

  // Unified discovery method
  listAllCapabilities(): Promise<{ tools: ToolDefinition[], plans: AgenticPlan[] }>;

  // Legacy methods for backward compatibility
  register(definition: ToolDefinition, implementation: PureToolImplementation): Promise<void>;
  getDefinition(id: string): Promise<ToolDefinition | undefined>;
  getImplementation(id: string): PureToolImplementation | undefined;
  listAllDefinitions(): Promise<ToolDefinition[]>;
}

export class CapabilityRegistry implements ICapabilityRegistry {
  private definitions = new Map<string, ToolDefinition>();
  private implementations = new Map<string, PureToolImplementation>();
  private plans = new Map<string, AgenticPlan>();
  private isInitialized = false;

  constructor(
    private centralStore: ICentralCapabilityStore,
    private eventListener: ICapabilityEventListener
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventListener.on('capability.updated', (id, type) => {
      this.invalidateLocalCache(id);
    });
    
    this.eventListener.on('capability.deleted', (id, type) => {
      this.removeFromLocalCache(id);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.syncFromCentralStore();
    this.isInitialized = true;
  }

  private async syncFromCentralStore(): Promise<void> {
    const capabilities = await this.centralStore.listAll();
    
    for (const capability of capabilities) {
      if (capability.type === 'tool') {
        this.definitions.set(capability.id, capability.definition as ToolDefinition);
      } else if (capability.type === 'plan') {
        this.plans.set(capability.id, capability.definition as AgenticPlan);
      }
    }
  }

  private async invalidateLocalCache(id: string): Promise<void> {
    const capability = await this.centralStore.get(id);
    if (capability) {
      if (capability.type === 'tool') {
        this.definitions.set(id, capability.definition as ToolDefinition);
      } else if (capability.type === 'plan') {
        this.plans.set(id, capability.definition as AgenticPlan);
      }
    }
  }

  private removeFromLocalCache(id: string): void {
    this.definitions.delete(id);
    this.plans.delete(id);
    this.implementations.delete(id);
  }

  // Tool-specific methods
  async registerTool(definition: ToolDefinition, implementation: PureToolImplementation): Promise<void> {
    await this.ensureInitialized();
    
    // Make registration idempotent - update if already exists
    await this.centralStore.save(definition.id, 'tool', definition);
    this.definitions.set(definition.id, definition);
    this.implementations.set(definition.id, implementation);
  }

  async getToolDefinition(id: string): Promise<ToolDefinition | undefined> {
    await this.ensureInitialized();
    return this.definitions.get(id);
  }

  getToolImplementation(id: string): PureToolImplementation | undefined {
    return this.implementations.get(id);
  }

  async listAllToolDefinitions(): Promise<ToolDefinition[]> {
    await this.ensureInitialized();
    return Array.from(this.definitions.values());
  }

  // Plan-specific methods
  async registerPlan(plan: AgenticPlan): Promise<void> {
    await this.ensureInitialized();
    
    // Ensure JSON serializability
    try {
      const serialized = JSON.stringify(plan);
      const parsed = JSON.parse(serialized);
      
      // Check if the serialization round-trip preserves all properties
      if (this.hasNonSerializableProperties(plan, parsed)) {
        throw new Error('Plan contains non-serializable properties');
      }
    } catch (error) {
      throw new Error(`Plan is not JSON serializable: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Make registration idempotent - update if already exists
    await this.centralStore.save(plan.planId, 'plan', plan);
    this.plans.set(plan.planId, plan);
  }

  async getPlan(id: string): Promise<AgenticPlan | undefined> {
    await this.ensureInitialized();
    return this.plans.get(id);
  }

  async listAllPlans(): Promise<AgenticPlan[]> {
    await this.ensureInitialized();
    return Array.from(this.plans.values());
  }

  // Unified discovery method
  async listAllCapabilities(): Promise<{ tools: ToolDefinition[], plans: AgenticPlan[] }> {
    await this.ensureInitialized();
    return {
      tools: await this.listAllToolDefinitions(),
      plans: await this.listAllPlans()
    };
  }

  // Legacy methods for backward compatibility
  async register(definition: ToolDefinition, implementation: PureToolImplementation): Promise<void> {
    await this.registerTool(definition, implementation);
  }

  async getDefinition(id: string): Promise<ToolDefinition | undefined> {
    return await this.getToolDefinition(id);
  }

  getImplementation(id: string): PureToolImplementation | undefined {
    return this.getToolImplementation(id);
  }

  async listAllDefinitions(): Promise<ToolDefinition[]> {
    return await this.listAllToolDefinitions();
  }

  private hasNonSerializableProperties(original: any, parsed: any): boolean {
    for (const key in original) {
      if (original.hasOwnProperty(key)) {
        const originalValue = original[key];
        const parsedValue = parsed[key];
        
        // Check if property was lost during serialization
        if (originalValue !== undefined && parsedValue === undefined) {
          return true;
        }
        
        // Check if it's a function
        if (typeof originalValue === 'function') {
          return true;
        }
        
        // Recursively check objects
        if (typeof originalValue === 'object' && originalValue !== null && parsedValue !== null) {
          if (this.hasNonSerializableProperties(originalValue, parsedValue)) {
            return true;
          }
        }
      }
    }
    return false;
  }
}