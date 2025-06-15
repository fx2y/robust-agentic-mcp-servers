import { PlanExecutor } from './plan-executor';
import { CapabilityRegistry } from '../capability-registry';
import { InMemoryStateStore } from '../state/in-memory-state-store';
import { InMemoryEventBus } from '../event-bus/in-memory-event-bus';
import { ContextResolver } from './context-resolver';
import { WorkflowManager } from '../workflow-manager';
import { ToolExecutor } from '../tool-executor';
import { WorkflowEvent } from '../event-bus/types';
import { AgenticPlan } from './types';
import { ToolDefinition, PureToolImplementation } from '../tool-definition';

describe('PlanExecutor Failure Handling Integration', () => {
  let stateStore: InMemoryStateStore;
  let eventBus: InMemoryEventBus;
  let capabilityRegistry: CapabilityRegistry;
  let contextResolver: ContextResolver;
  let toolExecutor: ToolExecutor;
  let workflowManager: WorkflowManager;
  let planExecutor: PlanExecutor;
  let eventSpy: jest.Mock;

  beforeEach(async () => {
    stateStore = new InMemoryStateStore();
    eventBus = new InMemoryEventBus();
    capabilityRegistry = new CapabilityRegistry();
    contextResolver = new ContextResolver();
    toolExecutor = new ToolExecutor(capabilityRegistry);
    workflowManager = new WorkflowManager(toolExecutor, stateStore);
    
    eventSpy = jest.fn();
    eventBus.on('workflow.failed', eventSpy);
    await eventBus.startListening();
    
    planExecutor = new PlanExecutor(
      workflowManager,
      capabilityRegistry,
      contextResolver,
      eventBus
    );

    // Register failing tool
    const failingToolDefinition: ToolDefinition = {
      id: 'test::always_fail',
      description: 'A tool that always throws an error.',
      parameters: {},
      outputSchema: {}
    };
    
    const failingToolImplementation: PureToolImplementation = async () => {
      throw new Error('INTENTIONAL_FAILURE');
    };

    capabilityRegistry.registerTool(failingToolDefinition, failingToolImplementation);

    // Register failing plan
    const failingPlan: AgenticPlan = {
      planId: 'test::plan_that_fails',
      description: 'A plan designed to fail.',
      parameters: {},
      startStepId: 'failing_step',
      steps: [
        {
          id: 'failing_step',
          type: 'tool_call',
          toolId: 'test::always_fail',
          arguments: {},
          nextStepId: 'end'
        }
      ]
    };

    capabilityRegistry.registerPlan(failingPlan);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should emit workflow.failed event and update session state on tool failure', async () => {
    const sessionId = 'session-fail-test-456';
    await workflowManager.createSession(sessionId);
    
    const plan = capabilityRegistry.getPlan('test::plan_that_fails');
    if (!plan) throw new Error('Plan not found');

    await planExecutor.execute(sessionId, plan, {});

    // State Store Verification
    const sessionCore = await stateStore.readSessionCore(sessionId);
    expect(sessionCore).toBeDefined();
    expect(sessionCore!.status).toBe('failed');
    expect(sessionCore!.lastError?.name).toBe('Error');
    expect(sessionCore!.lastError?.message).toContain('INTENTIONAL_FAILURE');

    // Event Bus Verification
    expect(eventSpy).toHaveBeenCalledTimes(1);
    
    const emittedEvent: WorkflowEvent = eventSpy.mock.calls[0][0];
    expect(emittedEvent.type).toBe('workflow.failed');
    expect(emittedEvent.sessionId).toBe(sessionId);
    expect(emittedEvent.details.error?.message).toContain('INTENTIONAL_FAILURE');
    expect(emittedEvent.details.currentStepId).toBe('failing_step');
    expect(emittedEvent.timestamp).toBeDefined();
  });
});