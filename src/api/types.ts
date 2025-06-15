import { ToolDefinition } from '../core/tool-definition';
import { AgenticPlan } from '../core/agentic-plan/plan-executor';

export interface CapabilityListing {
  tools: ToolDefinition[];
  plans: AgenticPlan[];
}

export interface CreateSessionRequest {
  sessionId?: string;
}

export interface ExecutePlanRequest {
  plan?: AgenticPlan;
  planId?: string;
  initialArgs?: Record<string, any>;
}

export interface ResumeSessionRequest {
  input: Record<string, any>;
}

export interface RegisterCapabilityRequest {
  type: 'tool' | 'plan';
  definition: ToolDefinition | AgenticPlan;
}

export interface DiscoverCapabilitiesRequest {
  query: string;
  limit?: number;
}