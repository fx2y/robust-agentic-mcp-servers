// In sandbox/phase2_walkthrough.ts
import { WorkflowManager } from '../src/core/workflow-manager';
import { InMemoryStateStore } from '../src/core/state/in-memory-state-store';
import { IToolExecutor, ToolExecutionRequest, ToolExecutionResult } from '../src/core/tool-executor';
import { SessionCore } from '../src/core/state/types';

// Mock a simple Tool Executor for the demo
class MockToolExecutor implements IToolExecutor {
  async execute(request: ToolExecutionRequest, sessionContext: Record<string, any>): Promise<{ result: ToolExecutionResult; newContext: Record<string, any> }> {
    switch (request.toolId) {
      case 'context-writer':
        const value = request.arguments.value;
        // This tool's "side effect" is to request a context update
        return {
          result: { status: 'success', output: { valueWritten: value } },
          newContext: { ...sessionContext, savedValue: value } // The executor returns the new context
        };
      case 'context-reader':
        const readValue = sessionContext.savedValue;
        if (!readValue) {
          return { result: { status: 'error', error: { name: 'ReadError', message: 'No value found in context' } }, newContext: sessionContext };
        }
        return { result: { status: 'success', output: { valueRead: readValue } }, newContext: sessionContext };
      case 'failing-tool':
        // This tool always fails
        return { result: { status: 'error', error: { name: 'IntentionalError', message: 'This tool is designed to fail.' } }, newContext: sessionContext };
      default:
        throw new Error(`Tool not found: ${request.toolId}`);
    }
  }
}

async function main() {
  const stateStore = new InMemoryStateStore();
  const mockToolExecutor = new MockToolExecutor();
  const workflowManager = new WorkflowManager(mockToolExecutor, stateStore);
  
  // Tutorial steps
  console.log("--- 1. HAPPY PATH WALKTHROUGH ---");
  const happySession = await workflowManager.createSession();
  const happySessionId = happySession.sessionId;
  console.log(`[1.1] Created Session. ID: ${happySessionId}, Status: ${happySession.status}`);

  console.log("\n[1.2] Executing 'context-writer' tool...");
  await workflowManager.executeToolInSession(happySessionId, {
    toolId: 'context-writer',
    arguments: { value: 'hello durable world' }
  });

  const contextAfterWrite = await stateStore.getContext(happySessionId);
  console.log("  -> Context is now:", contextAfterWrite);
  const historyAfterWrite = await stateStore.readHistory(happySessionId);
  console.log("  -> History now contains:", historyAfterWrite[0].result);

  console.log("\n[1.3] Executing 'context-reader' tool...");
  const readerResult = await workflowManager.executeToolInSession(happySessionId, {
    toolId: 'context-reader',
    arguments: {}
  });
  console.log("  -> 'context-reader' successfully read the value from context:", readerResult.result.output);

  const finalHistory = await stateStore.readHistory(happySessionId);
  console.log("\n[1.4] Final session history contains two successful tool calls:");
  console.log("  -> Entry 1:", finalHistory[0].result);
  console.log("  -> Entry 2:", finalHistory[1].result);

  console.log("\n\n--- 2. FAILURE PATH WALKTHROUGH ---");
  const failSession = await workflowManager.createSession();
  const failSessionId = failSession.sessionId;
  console.log(`[2.1] Created Session for failure test. ID: ${failSessionId}`);

  console.log("\n[2.2] Executing 'failing-tool'...");
  await workflowManager.executeToolInSession(failSessionId, {
    toolId: 'failing-tool',
    arguments: {}
  });

  const failedCoreState = await stateStore.readSessionCore(failSessionId);
  console.log("  -> Session status is now:", failedCoreState?.status); // Expected: 'failed'
  console.log("  -> Session `lastError` is populated:", failedCoreState?.lastError);
  
  const failedHistory = await stateStore.readHistory(failSessionId);
  console.log("\n[2.3] History correctly records the failed execution:");
  console.log("  -> History Entry Result:", failedHistory[0].result);
}

main().catch(console.error);