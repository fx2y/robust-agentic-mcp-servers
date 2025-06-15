import Ajv from 'ajv';
import { IPlanExecutor } from './plan-executor.interface';
import { AgenticPlan, PlanStep, ContextValuePointer, ToolCallStep, ConditionalBranchStep, ParallelBranchStep, LoopOverItemsStep, HumanInTheLoopStep, FinalResponseStep } from './types';
import { SessionCore } from '../state/types';
import { IWorkflowManager } from '../workflow-manager';
import { ICapabilityRegistry } from '../capability-registry';
import { IContextResolver } from './context-resolver.interface';
import { ToolExecutionRequest } from '../tool-executor';
import { IStateStore } from '../state/state-store.interface';
import { IWorkflowEventEmitter, WorkflowEvent } from '../event-bus';

export class PlanExecutor implements IPlanExecutor {
  private ajv = new Ajv();

  constructor(
    private workflowManager: IWorkflowManager,
    private capabilityRegistry: ICapabilityRegistry,
    private contextResolver: IContextResolver,
    private eventEmitter: IWorkflowEventEmitter
  ) {}

  async execute(sessionId: string, plan: AgenticPlan, initialArgs: any): Promise<SessionCore> {
    // Validate initial arguments against plan parameters
    if (plan.parameters) {
      const validate = this.ajv.compile(plan.parameters);
      if (!validate(initialArgs)) {
        throw new Error(`Invalid initial arguments: ${this.ajv.errorsText(validate.errors)}`);
      }
    }

    // JSON serializability check for the plan
    try {
      JSON.parse(JSON.stringify(plan));
    } catch (error) {
      throw new Error(`Plan is not JSON serializable: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Initialize session context with prompt input
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Update context with promptInput directly via state store
    await this.updateContext(sessionId, { promptInput: initialArgs });

    return this.executeFromStep(sessionId, plan, plan.startStepId);
  }

  async resume(sessionId: string, humanInput: any): Promise<SessionCore> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    if (session.core.status !== 'paused_on_human') {
      throw new Error(`Session is not paused for human input. Current status: ${session.core.status}`);
    }

    if (!session.core.currentPlanId || !session.core.currentStepId) {
      throw new Error('Session is missing current plan or step information');
    }

    // Add human input to context
    await this.updateContext(sessionId, { human_input: humanInput });

    // Get the plan from registry
    const plan = this.capabilityRegistry.getPlan(session.core.currentPlanId);
    if (!plan) {
      throw new Error(`Plan with ID '${session.core.currentPlanId}' not found`);
    }

    // Find the current step and get its next step
    const currentStep = plan.steps.find(s => s.id === session.core.currentStepId);
    if (!currentStep || currentStep.type !== 'human_in_the_loop') {
      throw new Error('Current step is not a human_in_the_loop step');
    }

    // Continue execution from the next appropriate step
    return this.executeFromStep(sessionId, plan, this.getNextStepId(currentStep));
  }

  private async executeFromStep(sessionId: string, plan: AgenticPlan, startStepId: string): Promise<SessionCore> {
    let currentStepId = startStepId;

    // Store the current plan ID in context for reference during execution
    await this.updateContext(sessionId, { currentPlanId: plan.planId });

    while (currentStepId) {
      const step = plan.steps.find((s: PlanStep) => s.id === currentStepId);
      if (!step) {
        throw new Error(`Step with ID '${currentStepId}' not found in plan`);
      }

      // Update session with current step before execution
      await this.updateSessionState(sessionId, plan.planId, currentStepId, 'running');

      try {
        const nextStepId = await this.executeStep(sessionId, plan, step);
        currentStepId = nextStepId || '';
      } catch (error) {
        // Handle step failure
        const errorInfo = {
          name: error instanceof Error ? error.constructor.name : 'UnknownError',
          message: error instanceof Error ? error.message : 'An unknown error occurred',
          stack: error instanceof Error ? error.stack : undefined
        };

        await this.updateSessionState(sessionId, plan.planId, currentStepId, 'failed', errorInfo);
        
        // Emit workflow.failed event
        const workflowEvent: WorkflowEvent = {
          type: 'workflow.failed',
          sessionId,
          timestamp: new Date().toISOString(),
          details: {
            reason: errorInfo.message,
            currentStepId,
            error: errorInfo
          }
        };
        
        await this.eventEmitter.emit(workflowEvent);
        break;
      }
    }

    // Return final session state and emit completion event if successful
    const session = await this.workflowManager.getSession(sessionId);
    const finalSession = session!.core;
    
    if (finalSession.status === 'completed') {
      const workflowEvent: WorkflowEvent = {
        type: 'workflow.completed',
        sessionId,
        timestamp: new Date().toISOString(),
        details: {
          reason: 'Workflow completed successfully'
        }
      };
      await this.eventEmitter.emit(workflowEvent);
    }
    
    return finalSession;
  }

  private async executeStep(sessionId: string, plan: AgenticPlan, step: PlanStep): Promise<string | null> {
    switch (step.type) {
      case 'tool_call':
        return this.executeToolCallStep(sessionId, step);
      case 'conditional_branch':
        return this.executeConditionalBranchStep(sessionId, step);
      case 'parallel_branch':
        return this.executeParallelBranchStep(sessionId, plan, step);
      case 'loop_over_items':
        return this.executeLoopOverItemsStep(sessionId, plan, step);
      case 'human_in_the_loop':
        return this.executeHumanInTheLoopStep(sessionId, step);
      case 'final_response':
        return this.executeFinalResponseStep(sessionId, step);
      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  }

  private async executeToolCallStep(sessionId: string, step: ToolCallStep): Promise<string> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Load actual history from state store
    const history = await this.getSessionHistory(sessionId);
    
    const state = {
      context: session.context,
      history,
      promptInput: session.context.promptInput || {}
    };

    // Resolve arguments
    const resolvedArgs: Record<string, any> = {};
    for (const [key, value] of Object.entries(step.arguments)) {
      if (this.isContextValuePointer(value)) {
        resolvedArgs[key] = this.contextResolver.resolve(value, state);
      } else {
        resolvedArgs[key] = value;
      }
    }

    const request: ToolExecutionRequest = {
      toolId: step.toolId,
      arguments: resolvedArgs
    };

    const { result } = await this.workflowManager.executeToolInSession(sessionId, request, step.id);

    if (result.status === 'error') {
      throw new Error(`Tool execution failed: ${result.error?.message}`);
    }

    return step.nextStepId;
  }

  private async executeConditionalBranchStep(sessionId: string, step: ConditionalBranchStep): Promise<string> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Load actual history from state store
    const history = await this.getSessionHistory(sessionId);
    
    const state = {
      context: session.context,
      history,
      promptInput: session.context.promptInput || {}
    };

    // Resolve condition values
    const leftValue = this.isContextValuePointer(step.condition.left)
      ? this.contextResolver.resolve(step.condition.left, state)
      : step.condition.left;

    const rightValue = this.isContextValuePointer(step.condition.right)
      ? this.contextResolver.resolve(step.condition.right, state)
      : step.condition.right;

    // Evaluate condition
    const conditionResult = this.evaluateCondition(leftValue, step.condition.operator, rightValue);

    return conditionResult ? step.onTrue.nextStepId : step.onFalse.nextStepId;
  }

  private async executeParallelBranchStep(sessionId: string, plan: AgenticPlan, step: ParallelBranchStep): Promise<string> {
    // Execute all branches in parallel
    const branchPromises = step.branches.map(branch =>
      this.executeBranchSteps(sessionId, plan, branch.steps)
    );

    await Promise.all(branchPromises);
    return step.nextStepId;
  }

  private async executeLoopOverItemsStep(sessionId: string, plan: AgenticPlan, step: LoopOverItemsStep): Promise<string> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Load actual history from state store
    const history = await this.getSessionHistory(sessionId);
    
    const state = {
      context: session.context,
      history,
      promptInput: session.context.promptInput || {}
    };

    // Resolve collection
    const collection = this.contextResolver.resolve(step.collectionPath, state);
    if (!Array.isArray(collection)) {
      throw new Error(`Collection path ${step.collectionPath.jsonPath} did not resolve to an array`);
    }

    // Execute loop plan for each item
    for (let i = 0; i < collection.length; i++) {
      const item = collection[i];
      
      // Set current item in context
      const itemContext = { [step.itemAlias]: item, [`${step.itemAlias}_index`]: i };
      await this.updateContext(sessionId, itemContext);

      // Execute loop plan
      await this.executeBranchSteps(sessionId, plan, step.loopPlan);
    }

    return step.nextStepId;
  }

  private async executeHumanInTheLoopStep(sessionId: string, step: HumanInTheLoopStep): Promise<string | null> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Load actual history from state store
    const history = await this.getSessionHistory(sessionId);
    
    const state = {
      context: session.context,
      history,
      promptInput: session.context.promptInput || {}
    };

    // Resolve message
    const message = typeof step.message === 'string'
      ? step.message
      : this.contextResolver.resolve(step.message, state);

    // Store the message and update status
    await this.updateContext(sessionId, { humanPromptMessage: message });
    // We need to get the current plan id from context since it's not passed to this method
    const currentPlanId = session.context.currentPlanId || '';
    
    await this.updateSessionState(sessionId, currentPlanId, step.id, 'paused_on_human');

    // Emit workflow.paused event
    const workflowEvent: WorkflowEvent = {
      type: 'workflow.paused',
      sessionId,
      timestamp: new Date().toISOString(),
      details: {
        reason: message,
        currentStepId: step.id,
        humanInputSchema: step.expectedInputSchema
      }
    };
    await this.eventEmitter.emit(workflowEvent);

    // Return null to stop execution (will be resumed externally)
    return null;
  }

  private async executeFinalResponseStep(sessionId: string, step: FinalResponseStep): Promise<string | null> {
    const session = await this.workflowManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Load actual history from state store
    const history = await this.getSessionHistory(sessionId);
    
    const state = {
      context: session.context,
      history,
      promptInput: session.context.promptInput || {}
    };

    // Resolve message
    const message = typeof step.message === 'string'
      ? step.message
      : this.contextResolver.resolve(step.message, state);

    // Store the final response and update status
    await this.updateContext(sessionId, { finalResponse: message });
    await this.updateSessionState(sessionId, '', step.id, 'completed');

    // Return null to stop execution
    return null;
  }

  private async executeBranchSteps(sessionId: string, plan: AgenticPlan, steps: PlanStep[]): Promise<void> {
    for (const step of steps) {
      const nextStepId = await this.executeStep(sessionId, plan, step);
      if (!nextStepId) {
        break; // Step requested to stop execution (e.g., human_in_the_loop, final_response)
      }
    }
  }

  private isContextValuePointer(value: any): value is ContextValuePointer {
    return value && typeof value === 'object' && 'jsonPath' in value;
  }

  private evaluateCondition(left: any, operator: string, right: any): boolean {
    switch (operator) {
      case 'equals':
        return left === right;
      case 'not_equals':
        return left !== right;
      case 'greater_than':
        return left > right;
      case 'less_than':
        return left < right;
      case 'exists':
        return left !== undefined && left !== null;
      case 'not_exists':
        return left === undefined || left === null;
      case 'contains':
        if (typeof left === 'string') {
          return left.includes(String(right));
        }
        if (Array.isArray(left)) {
          return left.includes(right);
        }
        return false;
      default:
        throw new Error(`Unknown condition operator: ${operator}`);
    }
  }

  private getNextStepId(step: PlanStep): string {
    switch (step.type) {
      case 'tool_call':
        return step.nextStepId;
      case 'parallel_branch':
      case 'loop_over_items':
        return step.nextStepId;
      case 'human_in_the_loop':
        return step.nextStepId;
      default:
        throw new Error(`Cannot determine next step for step type: ${step.type}`);
    }
  }

  private async updateSessionState(sessionId: string, planId: string, stepId: string, status: SessionCore['status'], error?: any): Promise<void> {
    // Update session core through state store
    await this.getStateStore().updateSessionCore(sessionId, {
      currentPlanId: planId,
      currentStepId: stepId,
      status,
      lastError: error
    });
  }

  private async updateContext(sessionId: string, updates: Record<string, any>): Promise<void> {
    await this.getStateStore().updateContext(sessionId, updates);
  }

  private async getSessionHistory(sessionId: string): Promise<any[]> {
    return await this.getStateStore().readHistory(sessionId);
  }

  private getStateStore(): IStateStore {
    // Access the state store through the workflow manager
    return (this.workflowManager as any).stateStore;
  }
}