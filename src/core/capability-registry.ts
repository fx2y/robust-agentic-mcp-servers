import { ToolDefinition, PureToolImplementation } from './tool-definition';
import { AgenticPlan } from './agentic-plan/types';

export interface ICapabilityRegistry {
  // Tool-specific methods (from Phase 1)
  registerTool(definition: ToolDefinition, implementation: PureToolImplementation): void;
  getToolDefinition(id: string): ToolDefinition | undefined;
  getToolImplementation(id: string): PureToolImplementation | undefined;
  listAllToolDefinitions(): ToolDefinition[];

  // Plan-specific methods
  registerPlan(plan: AgenticPlan): void;
  getPlan(id: string): AgenticPlan | undefined;
  listAllPlans(): AgenticPlan[];

  // Unified discovery method
  listAllCapabilities(): { tools: ToolDefinition[], plans: AgenticPlan[] };

  // Legacy methods for backward compatibility
  register(definition: ToolDefinition, implementation: PureToolImplementation): void;
  getDefinition(id: string): ToolDefinition | undefined;
  getImplementation(id: string): PureToolImplementation | undefined;
  listAllDefinitions(): ToolDefinition[];
}

export class CapabilityRegistry implements ICapabilityRegistry {
  private definitions = new Map<string, ToolDefinition>();
  private implementations = new Map<string, PureToolImplementation>();
  private plans = new Map<string, AgenticPlan>();

  // Tool-specific methods
  registerTool(definition: ToolDefinition, implementation: PureToolImplementation): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Tool with ID '${definition.id}' is already registered`);
    }
    this.definitions.set(definition.id, definition);
    this.implementations.set(definition.id, implementation);
  }

  getToolDefinition(id: string): ToolDefinition | undefined {
    return this.definitions.get(id);
  }

  getToolImplementation(id: string): PureToolImplementation | undefined {
    return this.implementations.get(id);
  }

  listAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  // Plan-specific methods
  registerPlan(plan: AgenticPlan): void {
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

    if (this.plans.has(plan.planId)) {
      throw new Error(`Plan with ID '${plan.planId}' is already registered`);
    }
    this.plans.set(plan.planId, plan);
  }

  getPlan(id: string): AgenticPlan | undefined {
    return this.plans.get(id);
  }

  listAllPlans(): AgenticPlan[] {
    return Array.from(this.plans.values());
  }

  // Unified discovery method
  listAllCapabilities(): { tools: ToolDefinition[], plans: AgenticPlan[] } {
    return {
      tools: this.listAllToolDefinitions(),
      plans: this.listAllPlans()
    };
  }

  // Legacy methods for backward compatibility
  register(definition: ToolDefinition, implementation: PureToolImplementation): void {
    this.registerTool(definition, implementation);
  }

  getDefinition(id: string): ToolDefinition | undefined {
    return this.getToolDefinition(id);
  }

  getImplementation(id: string): PureToolImplementation | undefined {
    return this.getToolImplementation(id);
  }

  listAllDefinitions(): ToolDefinition[] {
    return this.listAllToolDefinitions();
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