import { AgenticMCPServer } from './src/server';

async function testParallelAndLoopErrors() {
  console.log('=== Testing Parallel and Loop Step Error Handling ===\n');
  
  const server = new AgenticMCPServer();
  const eventBus = server.getEventBus();
  
  // Track emitted events
  const emittedEvents: any[] = [];
  const originalEmit = eventBus.emit.bind(eventBus);
  eventBus.emit = async (event) => {
    emittedEvents.push({ ...event });
    return originalEmit(event);
  };
  
  await server.start();
  
  console.log('🧪 Test 1: Error in Parallel Branch');
  await testParallelBranchError(server, emittedEvents);
  
  console.log('\n🧪 Test 2: Error in Loop Step');
  await testLoopStepError(server, emittedEvents);
  
  console.log('\n📊 Events Summary:');
  emittedEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.type} (session: ${event.sessionId})`);
  });
}

async function testParallelBranchError(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-parallel-error-' + Date.now();
  const initialEventCount = emittedEvents.length;
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  // Create a plan with parallel branches where one fails
  const parallelErrorPlan = {
    planId: 'test::parallel_with_error',
    description: 'A plan with parallel branches where one fails',
    parameters: { type: 'object' as const },
    startStepId: 'parallel_step',
    steps: [{
      id: 'parallel_step',
      type: 'parallel_branch' as const,
      branches: [
        {
          steps: [{
            id: 'success_step',
            type: 'tool_call' as const,
            toolId: 'math::add',
            arguments: { a: 1, b: 2 }
          }]
        },
        {
          steps: [{
            id: 'fail_step',
            type: 'tool_call' as const,
            toolId: 'test::always_fail',
            arguments: {}
          }]
        }
      ],
      nextStepId: 'final_step'
    }, {
      id: 'final_step',
      type: 'final_response' as const,
      message: 'All parallel branches completed'
    }]
  };
  
  server.getCapabilityRegistry().registerPlan(parallelErrorPlan);
  
  try {
    const result = await server.getPlanExecutor().execute(sessionId, parallelErrorPlan, {});
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newEvents = emittedEvents.slice(initialEventCount);
    const failureEvents = newEvents.filter(e => e.type === 'workflow.failed');
    
    if (failureEvents.length > 0 && result.status === 'failed') {
      console.log('✅ Parallel branch error handled correctly');
      console.log(`   Session status: ${result.status}`);
      console.log(`   Error events: ${failureEvents.length}`);
    } else {
      console.log('❌ Parallel branch error not handled correctly');
      console.log(`   Session status: ${result.status}`);
      console.log(`   Error events: ${failureEvents.length}`);
    }
  } catch (error) {
    console.log('❌ Parallel branch test threw exception:', error.message);
  }
}

async function testLoopStepError(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-loop-error-' + Date.now();
  const initialEventCount = emittedEvents.length;
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  // Set up context with test data
  await server.getStateStore().updateContext(sessionId, {
    testItems: [1, 2, 'invalid']  // Third item will cause validation to fail
  });
  
  // Create a plan with a loop that will fail on the third iteration
  const loopErrorPlan = {
    planId: 'test::loop_with_error',
    description: 'A plan with a loop that fails on invalid data',
    parameters: { type: 'object' as const },
    startStepId: 'loop_step',
    steps: [{
      id: 'loop_step',
      type: 'loop_over_items' as const,
      collectionPath: { jsonPath: '$.context.testItems' },
      itemAlias: 'currentItem',
      loopPlan: [{
        id: 'validate_item',
        type: 'tool_call' as const,
        toolId: 'validate::is_positive',
        arguments: { 
          number: { jsonPath: '$.context.currentItem' }
        }
      }],
      nextStepId: 'final_step'
    }, {
      id: 'final_step',
      type: 'final_response' as const,
      message: 'All items processed'
    }]
  };
  
  server.getCapabilityRegistry().registerPlan(loopErrorPlan);
  
  try {
    const result = await server.getPlanExecutor().execute(sessionId, loopErrorPlan, {});
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newEvents = emittedEvents.slice(initialEventCount);
    const failureEvents = newEvents.filter(e => e.type === 'workflow.failed');
    
    if (failureEvents.length > 0 && result.status === 'failed') {
      console.log('✅ Loop step error handled correctly');
      console.log(`   Session status: ${result.status}`);
      console.log(`   Error events: ${failureEvents.length}`);
      console.log(`   Error: ${result.lastError?.message}`);
    } else {
      console.log('❌ Loop step error not handled correctly');
      console.log(`   Session status: ${result.status}`);
      console.log(`   Error events: ${failureEvents.length}`);
    }
  } catch (error) {
    console.log('❌ Loop step test threw exception:', error.message);
  }
}

// Run the tests
testParallelAndLoopErrors().catch(console.error);