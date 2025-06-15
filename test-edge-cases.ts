import { AgenticMCPServer } from './src/server';

async function testEdgeCases() {
  console.log('=== Testing Edge Cases and Error Conditions ===\n');
  
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
  
  console.log('🧪 Test 1: Missing session');
  await testMissingSession(server);
  
  console.log('\n🧪 Test 2: Invalid plan execution');
  await testInvalidPlan(server);
  
  console.log('\n🧪 Test 3: Resume non-paused session');
  await testResumeNonPausedSession(server);
  
  console.log('\n🧪 Test 4: Multiple rapid events');
  await testMultipleRapidEvents(server, emittedEvents);
  
  console.log('\n📊 Edge Case Event Summary:');
  console.log(`Total events emitted during edge case tests: ${emittedEvents.length}`);
}

async function testMissingSession(server: AgenticMCPServer) {
  try {
    const nonExistentSessionId = 'non-existent-session';
    const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails')!;
    
    await server.getPlanExecutor().execute(nonExistentSessionId, failingPlan, {});
    console.log('❌ Expected error for missing session, but execution succeeded');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.log('✅ Correctly handled missing session error');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log('❌ Unexpected error for missing session');
      console.log(`   Error: ${error}`);
    }
  }
}

async function testInvalidPlan(server: AgenticMCPServer) {
  const sessionId = 'test-invalid-plan-' + Date.now();
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  try {
    // Create a plan with invalid step reference
    const invalidPlan = {
      planId: 'test::invalid_plan',
      description: 'A plan with invalid step references',
      parameters: { type: 'object' as const },
      startStepId: 'non_existent_step', // This step doesn't exist
      steps: [{
        id: 'real_step',
        type: 'final_response' as const,
        message: 'This step exists but start points to non-existent step'
      }]
    };
    
    server.getCapabilityRegistry().registerPlan(invalidPlan);
    await server.getPlanExecutor().execute(sessionId, invalidPlan, {});
    console.log('❌ Expected error for invalid plan, but execution succeeded');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.log('✅ Correctly handled invalid plan error');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log('❌ Unexpected error for invalid plan');
      console.log(`   Error: ${error}`);
    }
  }
}

async function testResumeNonPausedSession(server: AgenticMCPServer) {
  const sessionId = 'test-resume-invalid-' + Date.now();
  
  await server.getStateStore().createSession({
    sessionId,
    status: 'running', // Not paused
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  try {
    await server.getPlanExecutor().resume(sessionId, { input: 'test' });
    console.log('❌ Expected error for resuming non-paused session, but succeeded');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not paused')) {
      console.log('✅ Correctly handled resume on non-paused session');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log('❌ Unexpected error for resume on non-paused session');
      console.log(`   Error: ${error}`);
    }
  }
}

async function testMultipleRapidEvents(server: AgenticMCPServer, emittedEvents: any[]) {
  const initialEventCount = emittedEvents.length;
  const sessionIds: string[] = [];
  
  // Create multiple sessions and execute failing plans rapidly
  const promises = [];
  for (let i = 0; i < 3; i++) {
    const sessionId = `test-rapid-${Date.now()}-${i}`;
    sessionIds.push(sessionId);
    
    promises.push((async () => {
      await server.getStateStore().createSession({
        sessionId,
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails')!;
      return server.getPlanExecutor().execute(sessionId, failingPlan, {});
    })());
  }
  
  const results = await Promise.all(promises);
  
  // Wait for all events to be processed
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const newEvents = emittedEvents.slice(initialEventCount);
  const failureEvents = newEvents.filter(e => e.type === 'workflow.failed');
  
  const allFailed = results.every(result => result.status === 'failed');
  const correctEventCount = failureEvents.length === 3;
  
  if (allFailed && correctEventCount) {
    console.log('✅ Multiple rapid events handled correctly');
    console.log(`   Sessions created: ${sessionIds.length}`);
    console.log(`   Failed sessions: ${results.filter(r => r.status === 'failed').length}`);
    console.log(`   Failure events: ${failureEvents.length}`);
  } else {
    console.log('❌ Multiple rapid events not handled correctly');
    console.log(`   All failed: ${allFailed}`);
    console.log(`   Correct event count: ${correctEventCount}`);
    console.log(`   Expected 3 failure events, got ${failureEvents.length}`);
  }
}

// Run the edge case tests
testEdgeCases().catch(console.error);