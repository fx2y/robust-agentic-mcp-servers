import { InMemoryEventBus } from './in-memory-event-bus';
import { WorkflowEvent } from './types';

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus;
  let handlerSpy1: jest.Mock;
  let handlerSpy2: jest.Mock;

  beforeEach(async () => {
    eventBus = new InMemoryEventBus();
    handlerSpy1 = jest.fn();
    handlerSpy2 = jest.fn();
    
    eventBus.on('workflow.failed', handlerSpy1);
    eventBus.on('workflow.completed', handlerSpy2);
    await eventBus.startListening();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should emit workflow.failed event to correct handler', async () => {
    const testEvent: WorkflowEvent = {
      type: 'workflow.failed',
      sessionId: 'session-abc-123',
      timestamp: '2023-10-27T10:00:00Z',
      details: { reason: 'Tool execution failed' }
    };

    await eventBus.emit(testEvent);

    expect(handlerSpy1).toHaveBeenCalledTimes(1);
    expect(handlerSpy1).toHaveBeenCalledWith(testEvent);
    expect(handlerSpy2).toHaveBeenCalledTimes(0);
  });

  it('should emit workflow.completed event to correct handler', async () => {
    const testEvent: WorkflowEvent = {
      type: 'workflow.completed',
      sessionId: 'session-def-456',
      timestamp: '2023-10-27T11:00:00Z',
      details: { reason: 'Workflow finished successfully' }
    };

    await eventBus.emit(testEvent);

    expect(handlerSpy2).toHaveBeenCalledTimes(1);
    expect(handlerSpy2).toHaveBeenCalledWith(testEvent);
    expect(handlerSpy1).toHaveBeenCalledTimes(0);
  });

  it('should support multiple handlers for same event type', async () => {
    const additionalHandler = jest.fn();
    eventBus.on('workflow.failed', additionalHandler);

    const testEvent: WorkflowEvent = {
      type: 'workflow.failed',
      sessionId: 'session-ghi-789',
      timestamp: '2023-10-27T12:00:00Z',
      details: { reason: 'Test failure' }
    };

    await eventBus.emit(testEvent);

    expect(handlerSpy1).toHaveBeenCalledTimes(1);
    expect(additionalHandler).toHaveBeenCalledTimes(1);
    expect(handlerSpy1).toHaveBeenCalledWith(testEvent);
    expect(additionalHandler).toHaveBeenCalledWith(testEvent);
  });

  it('should track listener count correctly', () => {
    expect(eventBus.listenerCount('workflow.failed')).toBe(1);
    expect(eventBus.listenerCount('workflow.completed')).toBe(1);
    expect(eventBus.listenerCount('workflow.paused')).toBe(0);
  });

  it('should remove listeners correctly', async () => {
    eventBus.removeAllListeners('workflow.failed');
    expect(eventBus.listenerCount('workflow.failed')).toBe(0);
    expect(eventBus.listenerCount('workflow.completed')).toBe(1);

    const testEvent: WorkflowEvent = {
      type: 'workflow.failed',
      sessionId: 'session-test',
      timestamp: '2023-10-27T13:00:00Z',
      details: { reason: 'Test' }
    };

    await eventBus.emit(testEvent);
    expect(handlerSpy1).toHaveBeenCalledTimes(0);
  });
});