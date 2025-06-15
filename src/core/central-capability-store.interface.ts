import { ToolDefinition } from './tool-definition';
import { AgenticPlan } from './agentic-plan/plan-executor';

export interface ICentralCapabilityStore {
  save(id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan): Promise<void>;
  get(id: string): Promise<{ type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan } | null>;
  listAll(): Promise<Array<{ id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan }>>;
  delete(id: string): Promise<boolean>;
}