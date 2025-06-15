import { EventEmitter } from 'events';
import { IWorkflowEventEmitter, IWorkflowEventListener } from './interfaces';
import { WorkflowEvent, WorkflowEventHandler } from './types';

export class InMemoryEventBus implements IWorkflowEventEmitter, IWorkflowEventListener {
  private eventEmitter: EventEmitter;
  private isListening: boolean = false;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  async emit(event: WorkflowEvent): Promise<void> {
    this.eventEmitter.emit(event.type, event);
  }

  on(eventType: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventEmitter.on(eventType, handler);
  }

  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }
    
    this.isListening = true;
    // For in-memory implementation, we don't need to do anything special
    // The EventEmitter is already ready to handle events
  }

  // Additional utility methods for testing/debugging
  removeAllListeners(eventType?: WorkflowEvent['type']): void {
    if (eventType) {
      this.eventEmitter.removeAllListeners(eventType);
    } else {
      this.eventEmitter.removeAllListeners();
    }
  }

  listenerCount(eventType: WorkflowEvent['type']): number {
    return this.eventEmitter.listenerCount(eventType);
  }
}