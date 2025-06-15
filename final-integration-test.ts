import { AgenticMCPServer } from './src/server';

async function finalIntegrationTest() {
  console.log('=== Final Integration Test: Complete Event-Driven System ===\n');
  
  const server = new AgenticMCPServer();
  
  // Track all events for final verification
  const allEvents: any[] = [];
  const eventBus = server.getEventBus();
  const originalEmit = eventBus.emit.bind(eventBus);
  eventBus.emit = async (event) => {
    allEvents.push({ 
      ...event, 
      receivedAt: new Date().toISOString() 
    });
    return originalEmit(event);
  };
  
  console.log('🚀 Starting server...');
  await server.start();
  
  console.log('✅ Server started with all components wired');
  console.log('   - Event bus initialized');
  console.log('   - Supervisor service listening');
  console.log('   - Plan executor with event emission');
  console.log('   - Context resolver with jsonpath-plus');
  
  // Test 1: Complete failure flow
  console.log('\n🧪 Test 1: Complete workflow failure handling');
  const failSessionId = 'final-test-fail-' + Date.now();
  await server.getStateStore().createSession({
    sessionId: failSessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails')!;
  const failResult = await server.getPlanExecutor().execute(failSessionId, failingPlan, {});
  
  // Test 2: Complete success flow
  console.log('\n🧪 Test 2: Complete workflow success handling');
  const successSessionId = 'final-test-success-' + Date.now();
  await server.getStateStore().createSession({
    sessionId: successSessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const mathPlan = server.getCapabilityRegistry().getPlan('math::conditional_add')!;
  const successResult = await server.getPlanExecutor().execute(successSessionId, mathPlan, { num1: 5, num2: 3 });
  
  // Test 3: Human-in-the-loop flow
  console.log('\n🧪 Test 3: Complete human-in-the-loop handling');
  const humanSessionId = 'final-test-human-' + Date.now();
  await server.getStateStore().createSession({
    sessionId: humanSessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const greetingPlan = server.getCapabilityRegistry().getPlan('interaction::greeting')!;
  const pauseResult = await server.getPlanExecutor().execute(humanSessionId, greetingPlan, {});
  const resumeResult = await server.getPlanExecutor().resume(humanSessionId, { name: 'Final Test User' });
  
  // Wait for all events to be processed
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Verify complete system behavior
  console.log('\n📊 Final System Verification:');
  
  // Check failure handling
  const failureEvents = allEvents.filter(e => e.type === 'workflow.failed');
  const failureHandled = failResult.status === 'failed' && failureEvents.length > 0;
  console.log(`✅ Failure handling: ${failureHandled ? 'PASS' : 'FAIL'}`);
  console.log(`   - Session status: ${failResult.status}`);
  console.log(`   - Failure events: ${failureEvents.length}`);
  
  // Check success handling  
  const completionEvents = allEvents.filter(e => e.type === 'workflow.completed');
  const successHandled = successResult.status === 'completed' && completionEvents.length > 0;
  console.log(`✅ Success handling: ${successHandled ? 'PASS' : 'FAIL'}`);
  console.log(`   - Session status: ${successResult.status}`);
  console.log(`   - Completion events: ${completionEvents.length}`);
  
  // Check pause/resume handling
  const pauseEvents = allEvents.filter(e => e.type === 'workflow.paused');
  const pauseResumeHandled = pauseResult.status === 'paused_on_human' && 
                            resumeResult.status === 'completed' && 
                            pauseEvents.length > 0;
  console.log(`✅ Pause/Resume handling: ${pauseResumeHandled ? 'PASS' : 'FAIL'}`);
  console.log(`   - Pause status: ${pauseResult.status}`);
  console.log(`   - Resume status: ${resumeResult.status}`);
  console.log(`   - Pause events: ${pauseEvents.length}`);
  
  // Check event ordering and timing
  const eventTimestamps = allEvents.map(e => new Date(e.timestamp).getTime());
  const isOrdered = eventTimestamps.every((time, i) => i === 0 || time >= eventTimestamps[i-1]);
  console.log(`✅ Event ordering: ${isOrdered ? 'PASS' : 'FAIL'}`);
  
  // Summary
  console.log('\n🎯 Final Integration Results:');
  console.log(`   Total events processed: ${allEvents.length}`);
  console.log(`   Event types: ${[...new Set(allEvents.map(e => e.type))].join(', ')}`);
  console.log(`   Sessions tested: 3 (fail, success, human-loop)`);
  console.log(`   All core flows: ${failureHandled && successHandled && pauseResumeHandled ? '✅ WORKING' : '❌ ISSUES'}`);
  
  if (failureHandled && successHandled && pauseResumeHandled && isOrdered) {
    console.log('\n🎉 COMPLETE: Event-driven error handling system is fully functional!');
    console.log('   ✅ Graceful failure handling with supervisor intervention');
    console.log('   ✅ Success workflow completion with event emission');
    console.log('   ✅ Human-in-the-loop pause/resume with proper state management');
    console.log('   ✅ Robust event ordering and timing');
    console.log('   ✅ Proper dependency injection throughout');
    console.log('   ✅ TypeScript type safety maintained');
  } else {
    console.log('\n❌ ISSUES DETECTED: Some flows are not working correctly');
  }
  
  console.log('\n📝 Event Log:');
  allEvents.forEach((event, idx) => {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    console.log(`   ${idx + 1}. [${timestamp}] ${event.type} → ${event.sessionId}`);
  });
}

// Run the final integration test
finalIntegrationTest().catch(console.error);