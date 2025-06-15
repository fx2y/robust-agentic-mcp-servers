import { JSONSchema7 } from 'json-schema';

export interface WorkflowEvent {
  type: 'workflow.paused' | 'workflow.failed' | 'workflow.completed';
  sessionId: string;
  timestamp: string; // ISO8601 timestamp
  details: {
    reason: string; // e.g., error message or human-in-the-loop prompt
    currentStepId?: string;
    error?: { 
      name: string; 
      message: string; 
      stack?: string; 
    }; // For 'workflow.failed'
    humanInputSchema?: JSONSchema7; // For 'workflow.paused' on human input
  };
}

export type WorkflowEventHandler = (event: WorkflowEvent) => Promise<void>;