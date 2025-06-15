import { ToolDefinition, PureToolImplementation } from './tool-definition';

export interface ICapabilityRegistry {
  register(definition: ToolDefinition, implementation: PureToolImplementation): void;
  getDefinition(id: string): ToolDefinition | undefined;
  getImplementation(id: string): PureToolImplementation | undefined;
  listAllDefinitions(): ToolDefinition[];
}

export class CapabilityRegistry implements ICapabilityRegistry {
  private definitions = new Map<string, ToolDefinition>();
  private implementations = new Map<string, PureToolImplementation>();

  register(definition: ToolDefinition, implementation: PureToolImplementation): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Tool with ID '${definition.id}' is already registered`);
    }
    this.definitions.set(definition.id, definition);
    this.implementations.set(definition.id, implementation);
  }

  getDefinition(id: string): ToolDefinition | undefined {
    return this.definitions.get(id);
  }

  getImplementation(id: string): PureToolImplementation | undefined {
    return this.implementations.get(id);
  }

  listAllDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }
}