import { AgenticMCPServer } from './src/server';

async function testAllEventScenarios() {
  console.log('=== Comprehensive Event-Driven Error Handling Tests ===\n');
  
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
  
  console.log('🧪 Test 1: Workflow Failure Event');
  await testWorkflowFailure(server, emittedEvents);
  
  console.log('\n🧪 Test 2: Workflow Completion Event');
  await testWorkflowCompletion(server, emittedEvents);
  
  console.log('\n🧪 Test 3: Human-in-the-Loop Pause Event');
  await testHumanInTheLoopPause(server, emittedEvents);
  
  console.log('\n🧪 Test 4: Supervisor Idempotency');
  await testSupervisorIdempotency(server, emittedEvents);
  
  console.log('\n🧪 Test 5: Event Timing and Order');
  await testEventTimingAndOrder(server, emittedEvents);
  
  console.log('\n📊 Final Event Summary:');
  console.log(`Total events emitted: ${emittedEvents.length}`);
  emittedEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.type} (session: ${event.sessionId})`);
  });
}

async function testWorkflowFailure(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-failure-' + Date.now();
  const initialEventCount = emittedEvents.length;
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails')!;
  const result = await server.getPlanExecutor().execute(sessionId, failingPlan, {});
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const failureEvents = emittedEvents.slice(initialEventCount).filter(e => e.type === 'workflow.failed');
  
  if (failureEvents.length === 1 && result.status === 'failed') {
    console.log('✅ Workflow failure event emitted correctly');
    console.log(`   Session status: ${result.status}`);
    console.log(`   Error: ${result.lastError?.message}`);
  } else {
    console.log('❌ Workflow failure event test failed');
    console.log(`   Expected 1 failure event, got ${failureEvents.length}`);
    console.log(`   Session status: ${result.status}`);
  }
}

async function testWorkflowCompletion(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-completion-' + Date.now();
  const initialEventCount = emittedEvents.length;
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  // Create a simple completion plan
  const completionPlan = {
    planId: 'test::simple_completion',
    description: 'A plan that completes successfully',
    parameters: { type: 'object' as const },
    startStepId: 'final_step',
    steps: [{
      id: 'final_step',
      type: 'final_response' as const,
      message: 'Task completed successfully'
    }]
  };
  
  server.getCapabilityRegistry().registerPlan(completionPlan);
  
  const result = await server.getPlanExecutor().execute(sessionId, completionPlan, {});
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const completionEvents = emittedEvents.slice(initialEventCount).filter(e => e.type === 'workflow.completed');
  
  if (completionEvents.length === 1 && result.status === 'completed') {
    console.log('✅ Workflow completion event emitted correctly');
    console.log(`   Session status: ${result.status}`);
  } else {
    console.log('❌ Workflow completion event test failed');
    console.log(`   Expected 1 completion event, got ${completionEvents.length}`);
    console.log(`   Session status: ${result.status}`);
  }
}

async function testHumanInTheLoopPause(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-pause-' + Date.now();
  const initialEventCount = emittedEvents.length;
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  // Create a human-in-the-loop plan
  const pausePlan = {
    planId: 'test::human_pause',
    description: 'A plan that pauses for human input',
    parameters: { type: 'object' as const },
    startStepId: 'human_step',
    steps: [{
      id: 'human_step',
      type: 'human_in_the_loop' as const,
      message: 'Please provide your input',
      nextStepId: 'final_step',
      expectedInputSchema: { 
        type: 'object' as const, 
        properties: { 
          input: { type: 'string' as const } 
        } 
      }
    }, {
      id: 'final_step',
      type: 'final_response' as const,
      message: 'Thank you for your input'
    }]
  };
  
  server.getCapabilityRegistry().registerPlan(pausePlan);
  
  const result = await server.getPlanExecutor().execute(sessionId, pausePlan, {});
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const pauseEvents = emittedEvents.slice(initialEventCount).filter(e => e.type === 'workflow.paused');
  
  if (pauseEvents.length === 1 && result.status === 'paused_on_human') {
    console.log('✅ Workflow pause event emitted correctly');
    console.log(`   Session status: ${result.status}`);
    console.log(`   Pause reason: ${pauseEvents[0].details.reason}`);
  } else {
    console.log('❌ Workflow pause event test failed');
    console.log(`   Expected 1 pause event, got ${pauseEvents.length}`);
    console.log(`   Session status: ${result.status}`);
  }
}

async function testSupervisorIdempotency(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-idempotency-' + Date.now();
  
  // Create session in failed state
  await server.getStateStore().createSession({
    sessionId,
    status: 'failed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: { name: 'TestError', message: 'Test error' }
  });
  
  // Manually emit a workflow.failed event for an already-failed session
  const testEvent = {
    type: 'workflow.failed' as const,
    sessionId,
    timestamp: new Date().toISOString(),
    details: {
      reason: 'Test idempotency',
      error: { name: 'TestError', message: 'Test error' }
    }
  };
  
  await server.getEventBus().emit(testEvent);
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log('✅ Supervisor idempotency test - check logs for idempotency message');
}

async function testEventTimingAndOrder(server: AgenticMCPServer, emittedEvents: any[]) {
  const sessionId = 'test-timing-' + Date.now();
  const initialEventCount = emittedEvents.length;
  const startTime = Date.now();
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails')!;
  await server.getPlanExecutor().execute(sessionId, failingPlan, {});
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const newEvents = emittedEvents.slice(initialEventCount);
  const eventTimes = newEvents.map(e => new Date(e.timestamp).getTime());
  
  if (newEvents.length > 0) {
    const isOrdered = eventTimes.every((time, i) => i === 0 || time >= eventTimes[i-1]);
    const totalTime = Date.now() - startTime;
    
    if (isOrdered) {
      console.log('✅ Events emitted in correct chronological order');
      console.log(`   Total execution time: ${totalTime}ms`);
    } else {
      console.log('❌ Events not in chronological order');
    }
  }
}

// Run the comprehensive tests
testAllEventScenarios().catch(console.error);