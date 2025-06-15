import { v4 as uuidv4 } from 'uuid';
import { IToolExecutor, ToolExecutionRequest, ToolExecutionResult } from './tool-executor';
import { IStateStore } from './state/state-store.interface';
import { SessionCore, HistoryEntry } from './state/types';

export interface IWorkflowManager {
  createSession(sessionId?: string): Promise<SessionCore>;
  getSession(sessionId: string): Promise<{ core: SessionCore; context: Record<string, any> } | null>;
  executeToolInSession(
    sessionId: string,
    request: ToolExecutionRequest,
    planStepId?: string
  ): Promise<{
    core: SessionCore;
    context: Record<string, any>;
    result: ToolExecutionResult;
  }>;
}

export class WorkflowManager implements IWorkflowManager {
  constructor(
    private toolExecutor: IToolExecutor,
    private stateStore: IStateStore
  ) {}

  async createSession(sessionId?: string): Promise<SessionCore> {
    const id = sessionId || uuidv4();
    const now = new Date().toISOString();
    
    const core: SessionCore = {
      sessionId: id,
      status: 'running',
      createdAt: now,
      updatedAt: now
    };

    await this.stateStore.createSession(core);
    return { ...core };
  }

  async getSession(sessionId: string): Promise<{ core: SessionCore; context: Record<string, any> } | null> {
    const core = await this.stateStore.readSessionCore(sessionId);
    if (!core) {
      return null;
    }

    const context = await this.stateStore.getContext(sessionId);
    return { core: { ...core }, context: { ...context } };
  }

  async executeToolInSession(
    sessionId: string,
    request: ToolExecutionRequest,
    planStepId?: string
  ): Promise<{
    core: SessionCore;
    context: Record<string, any>;
    result: ToolExecutionResult;
  }> {
    // Read current session state
    const sessionCore = await this.stateStore.readSessionCore(sessionId);
    if (!sessionCore) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    const sessionContext = await this.stateStore.getContext(sessionId);

    try {
      // Execute the tool
      const { result, newContext } = await this.toolExecutor.execute(request, sessionContext);
      
      // Create history entry
      const historyEntry: HistoryEntry = {
        timestamp: new Date().toISOString(),
        toolId: request.toolId,
        request,
        result,
        planStepId
      };

      // Atomically persist results
      await this.stateStore.appendToHistory(sessionId, historyEntry);
      
      if (newContext !== sessionContext) {
        await this.stateStore.setContext(sessionId, newContext);
      }

      // Update session status based on result
      if (result.status === 'error') {
        await this.stateStore.updateSessionStatus(sessionId, 'paused_on_error', result.error);
      } else {
        await this.stateStore.updateSessionStatus(sessionId, 'running');
      }

      // Return updated state
      const updatedCore = await this.stateStore.readSessionCore(sessionId);
      const updatedContext = await this.stateStore.getContext(sessionId);

      return {
        core: updatedCore!,
        context: updatedContext,
        result
      };
    } catch (error) {
      // Handle execution errors
      const errorInfo = {
        name: error instanceof Error ? error.constructor.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined
      };

      await this.stateStore.updateSessionStatus(sessionId, 'failed', errorInfo);
      
      const updatedCore = await this.stateStore.readSessionCore(sessionId);
      const context = await this.stateStore.getContext(sessionId);

      return {
        core: updatedCore!,
        context,
        result: {
          status: 'error',
          error: errorInfo
        }
      };
    }
  }
}