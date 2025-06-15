import { ICentralCapabilityStore } from './central-capability-store.interface';
import { ToolDefinition } from './tool-definition';
import { AgenticPlan } from './agentic-plan/types';

export class InMemoryCapabilityStore implements ICentralCapabilityStore {
  private store = new Map<string, { type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan }>();

  async save(id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan): Promise<void> {
    this.store.set(id, { type, definition });
  }

  async get(id: string): Promise<{ type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan } | null> {
    return this.store.get(id) || null;
  }

  async listAll(): Promise<Array<{ id: string, type: 'tool' | 'plan', definition: ToolDefinition | AgenticPlan }>> {
    return Array.from(this.store.entries()).map(([id, entry]) => ({ id, ...entry }));
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  // Legacy methods for compatibility
  async storeTool(definition: ToolDefinition): Promise<void> {
    await this.save(definition.id, 'tool', definition);
  }

  async storePlan(plan: AgenticPlan): Promise<void> {
    await this.save(plan.planId, 'plan', plan);
  }

  async getTool(toolId: string): Promise<ToolDefinition | null> {
    const entry = await this.get(toolId);
    return entry && entry.type === 'tool' ? entry.definition as ToolDefinition : null;
  }

  async getPlan(planId: string): Promise<AgenticPlan | null> {
    const entry = await this.get(planId);
    return entry && entry.type === 'plan' ? entry.definition as AgenticPlan : null;
  }

  async listAllTools(): Promise<ToolDefinition[]> {
    const all = await this.listAll();
    return all.filter(entry => entry.type === 'tool').map(entry => entry.definition as ToolDefinition);
  }

  async listAllPlans(): Promise<AgenticPlan[]> {
    const all = await this.listAll();
    return all.filter(entry => entry.type === 'plan').map(entry => entry.definition as AgenticPlan);
  }

  async searchCapabilities(query: string): Promise<{ tools: ToolDefinition[]; plans: AgenticPlan[]; }> {
    const lowerQuery = query.toLowerCase();
    const tools = await this.listAllTools();
    const plans = await this.listAllPlans();
    
    const matchingTools = tools.filter(tool =>
      tool.id.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );

    const matchingPlans = plans.filter(plan =>
      plan.planId.toLowerCase().includes(lowerQuery) ||
      plan.description.toLowerCase().includes(lowerQuery)
    );

    return { tools: matchingTools, plans: matchingPlans };
  }
}