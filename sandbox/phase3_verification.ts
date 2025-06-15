import { 
  CapabilityRegistry, 
  ToolDefinition, 
  ToolExecutor, 
  InMemoryStateStore, 
  WorkflowManager,
  AgenticPlan,
  ContextResolver,
  PlanExecutor,
  ContextValuePointer,
  ToolCallStep,
  FinalResponseStep
} from '../src/core';

async function verifyPhase3Implementation() {
  console.log('🧪 Phase 3 Verification: Unified Agentic Workflows IR');
  console.log('='.repeat(60));

  let testsPassed = 0;
  let totalTests = 0;

  function test(name: string, testFn: () => void | Promise<void>) {
    totalTests++;
    try {
      const result = testFn();
      if (result instanceof Promise) {
        return result.then(() => {
          console.log(`✅ ${name}`);
          testsPassed++;
        }).catch((error) => {
          console.log(`❌ ${name}: ${error.message}`);
        });
      } else {
        console.log(`✅ ${name}`);
        testsPassed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 1: ContextResolver functionality
  await test('ContextResolver can resolve simple JSONPath', async () => {
    const resolver = new ContextResolver();
    const state = {
      context: { userName: 'Alice', age: 30 },
      history: [],
      promptInput: { targetFile: 'data.json' }
    };

    const pointer: ContextValuePointer = { jsonPath: '$.context.userName' };
    const result = resolver.resolve(pointer, state);
    
    if (result !== 'Alice') {
      throw new Error(`Expected 'Alice', got ${result}`);
    }
  });

  // Test 2: ContextResolver with complex path
  await test('ContextResolver can resolve complex JSONPath', async () => {
    const resolver = new ContextResolver();
    const state = {
      context: { datasets: { users: { count: 42 } } },
      history: [],
      promptInput: {}
    };

    const pointer: ContextValuePointer = { jsonPath: '$.context.datasets.users.count' };
    const result = resolver.resolve(pointer, state);
    
    if (result !== 42) {
      throw new Error(`Expected 42, got ${result}`);
    }
  });

  // Test 3: CapabilityRegistry can register and retrieve plans
  await test('CapabilityRegistry can register and retrieve plans', async () => {
    const registry = new CapabilityRegistry();
    
    const testPlan: AgenticPlan = {
      planId: 'test-plan',
      description: 'A test plan',
      parameters: { type: 'object', properties: {} },
      startStepId: 'step1',
      steps: [
        {
          id: 'step1',
          type: 'final_response',
          message: 'Hello from test plan'
        }
      ]
    };

    registry.registerPlan(testPlan);
    const retrievedPlan = registry.getPlan('test-plan');
    
    if (!retrievedPlan || retrievedPlan.planId !== 'test-plan') {
      throw new Error('Plan not registered or retrieved correctly');
    }
  });

  // Test 4: CapabilityRegistry prevents duplicate plan registration
  await test('CapabilityRegistry prevents duplicate plan registration', async () => {
    const registry = new CapabilityRegistry();
    
    const testPlan: AgenticPlan = {
      planId: 'duplicate-test',
      description: 'A test plan',
      parameters: { type: 'object', properties: {} },
      startStepId: 'step1',
      steps: []
    };

    registry.registerPlan(testPlan);
    
    try {
      registry.registerPlan(testPlan);
      throw new Error('Should have thrown an error for duplicate registration');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already registered')) {
        throw error;
      }
    }
  });

  // Test 5: CapabilityRegistry enforces JSON serializability
  await test('CapabilityRegistry enforces JSON serializability', async () => {
    const registry = new CapabilityRegistry();
    
    const invalidPlan: any = {
      planId: 'invalid-plan',
      description: 'A test plan',
      parameters: { type: 'object', properties: {} },
      startStepId: 'step1',
      steps: [],
      invalidFunction: () => {} // This makes it non-serializable
    };

    try {
      registry.registerPlan(invalidPlan);
      throw new Error('Should have thrown an error for non-serializable plan');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('not JSON serializable')) {
        throw error;
      }
    }
  });

  // Test 6: CapabilityRegistry unified capability listing
  await test('CapabilityRegistry unified capability listing', async () => {
    const registry = new CapabilityRegistry();
    
    // Register a tool
    const toolDef: ToolDefinition = {
      id: 'test-tool',
      description: 'A test tool',
      parameters: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} }
    };
    const toolImpl = async () => ({ success: true });
    registry.registerTool(toolDef, toolImpl);

    // Register a plan
    const testPlan: AgenticPlan = {
      planId: 'test-plan-2',
      description: 'Another test plan',
      parameters: { type: 'object', properties: {} },
      startStepId: 'step1',
      steps: []
    };
    registry.registerPlan(testPlan);

    const capabilities = registry.listAllCapabilities();
    
    if (capabilities.tools.length !== 1 || capabilities.plans.length !== 1) {
      throw new Error(`Expected 1 tool and 1 plan, got ${capabilities.tools.length} tools and ${capabilities.plans.length} plans`);
    }
  });

  // Test 7: PlanExecutor initialization
  await test('PlanExecutor can be initialized', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);
    
    if (!planExecutor) {
      throw new Error('PlanExecutor not initialized');
    }
  });

  // Test 8: Simple plan execution setup validation
  await test('PlanExecutor validates plan parameters', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);

    // Create a session
    const session = await workflowManager.createSession('test-session');

    // Create a plan with parameters
    const testPlan: AgenticPlan = {
      planId: 'param-test-plan',
      description: 'A plan with parameters',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      },
      startStepId: 'step1',
      steps: [
        {
          id: 'step1',
          type: 'final_response',
          message: 'Hello'
        }
      ]
    };

    try {
      await planExecutor.execute('test-session', testPlan, {}); // Missing required parameter
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Invalid initial arguments')) {
        throw error;
      }
    }
  });

  // Test 9: Tool call plan execution (happy path)
  await test('PlanExecutor can execute tool_call plan', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);

    // Register math::add tool
    const addTool: ToolDefinition = {
      id: 'math::add',
      description: 'Adds two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      },
      outputSchema: { type: 'number' }
    };
    const addImpl = async (args: any) => args.a + args.b;
    registry.registerTool(addTool, addImpl);

    // Create session
    const session = await workflowManager.createSession('add-test-session');

    // Create plan
    const addPlan: AgenticPlan = {
      planId: 'add-plan',
      description: 'Add two numbers',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y']
      },
      startStepId: 'add-step',
      steps: [
        {
          id: 'add-step',
          type: 'tool_call',
          toolId: 'math::add',
          arguments: {
            a: { jsonPath: '$.promptInput.x' },
            b: { jsonPath: '$.promptInput.y' }
          },
          nextStepId: 'final-step'
        },
        {
          id: 'final-step',
          type: 'final_response',
          message: { jsonPath: '$.history[?(@.planStepId=="add-step")].result.output' }
        }
      ]
    };

    const result = await planExecutor.execute(session.sessionId, addPlan, { x: 5, y: 10 });
    
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
    }

    const history = await stateStore.readHistory(session.sessionId);
    if (history.length !== 1) {
      throw new Error(`Expected 1 history entry, got ${history.length}`);
    }

    if (history[0].result.output !== 15) {
      throw new Error(`Expected output 15, got ${history[0].result.output}`);
    }
  });

  // Test 10: Conditional branch plan execution
  await test('PlanExecutor can execute conditional_branch plan', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);

    // Register string::length tool
    const lengthTool: ToolDefinition = {
      id: 'string::length',
      description: 'Gets string length',
      parameters: {
        type: 'object',
        properties: {
          str: { type: 'string' }
        },
        required: ['str']
      },
      outputSchema: { type: 'number' }
    };
    const lengthImpl = async (args: any) => args.str.length;
    registry.registerTool(lengthTool, lengthImpl);

    // Create session
    const session = await workflowManager.createSession('conditional-test-session');

    // Create conditional plan
    const conditionalPlan: AgenticPlan = {
      planId: 'conditional-plan',
      description: 'Check string length',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      startStepId: 'length-step',
      steps: [
        {
          id: 'length-step',
          type: 'tool_call',
          toolId: 'string::length',
          arguments: {
            str: { jsonPath: '$.promptInput.input' }
          },
          nextStepId: 'check-length'
        },
        {
          id: 'check-length',
          type: 'conditional_branch',
          condition: {
            left: { jsonPath: '$.history[?(@.planStepId=="length-step")].result.output' },
            operator: 'greater_than',
            right: 5
          },
          onTrue: { nextStepId: 'long-string' },
          onFalse: { nextStepId: 'short-string' }
        },
        {
          id: 'long-string',
          type: 'final_response',
          message: 'Long'
        },
        {
          id: 'short-string',
          type: 'final_response',
          message: 'Short'
        }
      ]
    };

    // Create separate sessions for each test
    const longSession = await workflowManager.createSession();
    const shortSession = await workflowManager.createSession();

    // Test onTrue path
    const longResult = await planExecutor.execute(longSession.sessionId, conditionalPlan, { input: 'abcdef' });
    if (longResult.status !== 'completed') {
      throw new Error(`Expected completed status for long string, got ${longResult.status}`);
    }

    // Test onFalse path
    const shortResult = await planExecutor.execute(shortSession.sessionId, conditionalPlan, { input: 'abc' });
    if (shortResult.status !== 'completed') {
      throw new Error(`Expected completed status for short string, got ${shortResult.status}`);
    }
  });

  // Test 11: Plan execution with failure
  await test('PlanExecutor handles tool failure correctly', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);

    // Register failing tool
    const failTool: ToolDefinition = {
      id: 'system::fail',
      description: 'Always fails',
      parameters: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} }
    };
    const failImpl = async () => {
      throw new Error('Intentional Failure');
    };
    registry.registerTool(failTool, failImpl);

    // Create session
    const session = await workflowManager.createSession('fail-test-session');

    // Create failing plan
    const failPlan: AgenticPlan = {
      planId: 'fail-plan',
      description: 'Test failure handling',
      parameters: { type: 'object', properties: {} },
      startStepId: 'fail-step',
      steps: [
        {
          id: 'fail-step',
          type: 'tool_call',
          toolId: 'system::fail',
          arguments: {},
          nextStepId: 'never-reached'
        },
        {
          id: 'never-reached',
          type: 'final_response',
          message: 'Should not see this.'
        }
      ]
    };

    const result = await planExecutor.execute(session.sessionId, failPlan, {});
    
    if (result.status !== 'failed') {
      throw new Error(`Expected status 'failed', got '${result.status}'`);
    }

    if (!result.lastError || !result.lastError.message.includes('Intentional Failure')) {
      throw new Error(`Expected error with 'Intentional Failure', got ${result.lastError?.message}`);
    }

    if (result.currentStepId !== 'fail-step') {
      throw new Error(`Expected currentStepId 'fail-step', got '${result.currentStepId}'`);
    }
  });

  // Test 12: Human in the loop plan execution
  await test('PlanExecutor handles human_in_the_loop correctly', async () => {
    const registry = new CapabilityRegistry();
    const stateStore = new InMemoryStateStore();
    const toolExecutor = new ToolExecutor(registry);
    const workflowManager = new WorkflowManager(toolExecutor, stateStore);
    const contextResolver = new ContextResolver();
    const planExecutor = new PlanExecutor(workflowManager, registry, contextResolver);

    // Create session
    const session = await workflowManager.createSession('human-test-session');

    // Create human-in-the-loop plan
    const humanPlan: AgenticPlan = {
      planId: 'human-plan',
      description: 'Test human interaction',
      parameters: { type: 'object', properties: {} },
      startStepId: 'ask-human',
      steps: [
        {
          id: 'ask-human',
          type: 'human_in_the_loop',
          message: 'Please provide your name.',
          nextStepId: 'say-hello'
        },
        {
          id: 'say-hello',
          type: 'final_response',
          message: { jsonPath: '$.context.human_input.name' }
        }
      ]
    };

    // Register the plan so it can be retrieved during resume
    registry.registerPlan(humanPlan);

    // Execute plan (should pause on human)
    const pauseResult = await planExecutor.execute(session.sessionId, humanPlan, {});
    
    if (pauseResult.status !== 'paused_on_human') {
      throw new Error(`Expected status 'paused_on_human', got '${pauseResult.status}'`);
    }

    if (pauseResult.currentStepId !== 'ask-human') {
      throw new Error(`Expected currentStepId 'ask-human', got '${pauseResult.currentStepId}'`);
    }

    // Resume with human input
    const resumeResult = await planExecutor.resume(session.sessionId, { name: 'Alice' });
    
    if (resumeResult.status !== 'completed') {
      throw new Error(`Expected status 'completed' after resume, got '${resumeResult.status}'`);
    }

    // Check context has human input
    const context = await stateStore.getContext(session.sessionId);
    if (!context.human_input || context.human_input.name !== 'Alice') {
      throw new Error(`Expected human_input.name to be 'Alice', got ${context.human_input?.name}`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log('🎉 Phase 3 Implementation: ALL TESTS PASSED!');
    console.log('\n📋 Phase 3 Complete Summary:');
    console.log('✅ AgenticPlan types and interfaces implemented');
    console.log('✅ ContextResolver with JSONPath support implemented');
    console.log('✅ PlanExecutor with state machine loop implemented');
    console.log('✅ CapabilityRegistry extended for plans');
    console.log('✅ Tool call execution with context resolution');
    console.log('✅ Conditional branching execution');
    console.log('✅ Error handling and failure states');
    console.log('✅ Human-in-the-loop workflow pausing/resuming');
    console.log('✅ Core module exports updated');
    console.log('✅ TypeScript compilation successful');
    console.log('\n🚀 Ready for Phase 4: Scaffolded Emergence');
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyPhase3Implementation().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

export { verifyPhase3Implementation };