import { ToolExecutionRequest, ToolExecutionResult } from '../tool-executor';

export interface SessionCore {
  sessionId: string; // UUID
  status: 'running' | 'paused' | 'completed' | 'failed' | 'paused_on_error' | 'paused_on_human';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  currentPlanId?: string;
  currentStepId?: string;
  lastError?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface HistoryEntry {
  timestamp: string; // ISO 8601
  toolId: string;
  request: ToolExecutionRequest;
  result: ToolExecutionResult;
  planStepId?: string; // Links execution to a step in an AgenticPlan
}