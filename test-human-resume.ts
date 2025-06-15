import { AgenticMCPServer } from './src/server';

async function testHumanInTheLoopResume() {
  console.log('=== Testing Human-in-the-Loop Pause and Resume ===\n');
  
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
  
  const sessionId = 'test-human-resume-' + Date.now();
  
  // Use the existing greeting plan which has human-in-the-loop
  const greetingPlan = server.getCapabilityRegistry().getPlan('interaction::greeting');
  
  if (!greetingPlan) {
    console.log('❌ Greeting plan not found');
    return;
  }
  
  console.log('🧪 Step 1: Create session and start plan');
  await server.getStateStore().createSession({
    sessionId,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log('Plan steps:', greetingPlan.steps.map(s => `${s.id} (${s.type})`));
  
  // Execute the plan - should pause at human-in-the-loop
  const initialResult = await server.getPlanExecutor().execute(sessionId, greetingPlan, {});
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log('\n🧪 Step 2: Verify plan paused for human input');
  console.log('Execution result status:', initialResult.status);
  console.log('Current step:', initialResult.currentStepId);
  
  const pauseEvents = emittedEvents.filter(e => e.type === 'workflow.paused');
  if (pauseEvents.length > 0 && initialResult.status === 'paused_on_human') {
    console.log('✅ Plan correctly paused for human input');
    console.log('   Pause event emitted:', pauseEvents[0].details.reason);
  } else {
    console.log('❌ Plan did not pause correctly');
    console.log('   Expected paused_on_human, got:', initialResult.status);
    console.log('   Pause events:', pauseEvents.length);
  }
  
  console.log('\n🧪 Step 3: Resume with human input');
  
  // Resume the plan with human input
  const resumeResult = await server.getPlanExecutor().resume(sessionId, { name: 'Test User' });
  
  // Wait for event processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log('Resume result status:', resumeResult.status);
  
  const completionEvents = emittedEvents.filter(e => e.type === 'workflow.completed');
  if (completionEvents.length > 0 && resumeResult.status === 'completed') {
    console.log('✅ Plan resumed and completed successfully');
    
    // Check the final response
    const session = await server.getWorkflowManager().getSession(sessionId);
    console.log('   Final response:', session?.context.finalResponse);
  } else {
    console.log('❌ Plan did not resume correctly');
    console.log('   Expected completed, got:', resumeResult.status);
    console.log('   Completion events:', completionEvents.length);
  }
  
  console.log('\n📊 Event Summary:');
  emittedEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.type} (session: ${event.sessionId}) - ${event.details.reason}`);
  });
}

// Run the test
testHumanInTheLoopResume().catch(console.error);