import { WorkflowEvent, WorkflowEventHandler } from './types';

export interface IWorkflowEventEmitter {
  emit(event: WorkflowEvent): Promise<void>;
}

export interface IWorkflowEventListener {
  on(eventType: WorkflowEvent['type'], handler: WorkflowEventHandler): void;
  startListening(): Promise<void>;
}