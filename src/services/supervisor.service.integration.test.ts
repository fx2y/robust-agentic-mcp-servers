import { SupervisorService } from './supervisor.service';
import { InMemoryEventBus } from '../core/event-bus/in-memory-event-bus';
import { InMemoryStateStore } from '../core/state/in-memory-state-store';
import { WorkflowManager } from '../core/workflow-manager';
import { CapabilityRegistry } from '../core/capability-registry';
import { ToolExecutor } from '../core/tool-executor';
import { WorkflowEvent } from '../core/event-bus/types';
import { SessionCore } from '../core/state/types';
import { createChildLogger } from '../shared/logger';
import { InMemoryCapabilityStore } from '../core/in-memory-capability-store';
import { InMemoryCapabilityEventBus } from '../core/in-memory-capability-event-bus';

describe('SupervisorService Event Reaction Integration', () => {
  let eventBus: InMemoryEventBus;
  let stateStore: InMemoryStateStore;
  let workflowManager: WorkflowManager;
  let capabilityRegistry: CapabilityRegistry;
  let supervisorService: SupervisorService;
  let loggerSpy: jest.SpyInstance;
  let mockLogger: any;

  beforeEach(async () => {
    eventBus = new InMemoryEventBus();
    stateStore = new InMemoryStateStore();
    const centralStore = new InMemoryCapabilityStore();
    const capabilityEventBus = new InMemoryCapabilityEventBus();
    capabilityRegistry = new CapabilityRegistry(centralStore, capabilityEventBus);
    const toolExecutor = new ToolExecutor(capabilityRegistry);
    workflowManager = new WorkflowManager(toolExecutor, stateStore, createChildLogger('WorkflowManager'));
    
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    loggerSpy = mockLogger.info;
    
    supervisorService = new SupervisorService(
      eventBus,
      stateStore,
      workflowManager,
      capabilityRegistry,
      mockLogger
    );
    
    supervisorService.startListening();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    jest.clearAllMocks();
  });

  it('should handle workflow.failed event and verify session state', async () => {
    const sessionId = 'session-needs-supervision-789';
    
    // Create a session in failed state
    const failedSession: SessionCore = {
      sessionId,
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentPlanId: 'test-plan',
      currentStepId: 'step_x',
      lastError: {
        name: 'Error',
        message: 'Supervisor test failure'
      }
    };
    
    await stateStore.createSession(failedSession);

    const failedEvent: WorkflowEvent = {
      type: 'workflow.failed',
      sessionId,
      timestamp: '2023-10-27T11:00:00Z',
      details: { 
        reason: 'Supervisor test failure', 
        currentStepId: 'step_x',
        error: {
          name: 'Error',
          message: 'Supervisor test failure'
        }
      }
    };

    // Emit the event
    await eventBus.emit(failedEvent);

    // Wait a bit for async handling
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify supervisor logging
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      expect.stringContaining('Handling workflow failure')
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.stringContaining('Workflow failed - Reason: Supervisor test failure')
    );
    // Note: The 'Error details:' call has a third parameter with the actual error object
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({}),
      'Error details:',
      expect.anything()
    );
  });

  it('should ignore workflow.failed event if session is not in failed state (idempotency)', async () => {
    const sessionId = 'session-already-recovered';
    
    // Create a session that is NOT in failed state (maybe running or completed)
    const recoveredSession: SessionCore = {
      sessionId,
      status: 'running', // This is the key - not failed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentPlanId: 'test-plan',
      currentStepId: 'step_y'
    };
    
    await stateStore.createSession(recoveredSession);

    const failedEvent: WorkflowEvent = {
      type: 'workflow.failed',
      sessionId,
      timestamp: '2023-10-27T11:30:00Z',
      details: { 
        reason: 'Old failure event', 
        currentStepId: 'step_y'
      }
    };

    // Emit the event
    await eventBus.emit(failedEvent);

    // Wait a bit for async handling
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify supervisor ignored the event
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      expect.stringContaining('is not in failed state, ignoring event')
    );
  });

  it('should handle workflow.completed event', async () => {
    const sessionId = 'session-completed-123';
    
    const completedEvent: WorkflowEvent = {
      type: 'workflow.completed',
      sessionId,
      timestamp: '2023-10-27T12:00:00Z',
      details: { 
        reason: 'Workflow finished successfully'
      }
    };

    // Emit the event
    await eventBus.emit(completedEvent);

    // Wait a bit for async handling
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify supervisor logging
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      expect.stringContaining('Workflow completed successfully')
    );
  });

  it('should handle workflow.paused event', async () => {
    const sessionId = 'session-paused-456';
    
    const pausedEvent: WorkflowEvent = {
      type: 'workflow.paused',
      sessionId,
      timestamp: '2023-10-27T13:00:00Z',
      details: { 
        reason: 'Please provide additional input',
        humanInputSchema: { type: 'string' }
      }
    };

    // Emit the event
    await eventBus.emit(pausedEvent);

    // Wait a bit for async handling
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify supervisor logging
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      expect.stringContaining('Workflow paused for human input')
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.stringContaining('Human prompt: Please provide additional input')
    );
  });
});