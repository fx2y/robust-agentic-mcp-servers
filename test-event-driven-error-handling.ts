import { AgenticMCPServer } from './src/server';

async function testEventDrivenErrorHandling() {
  console.log('=== Testing Event-Driven Error Handling ===');
  
  const server = new AgenticMCPServer();
  
  try {
    // Start the server
    await server.start();
    
    // Create a session
    const sessionId = 'test-session-failure';
    await server.getStateStore().createSession({
      sessionId,
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log(`\nCreated session: ${sessionId}`);
    
    // Get the failing plan
    const failingPlan = server.getCapabilityRegistry().getPlan('test::plan_that_fails');
    if (!failingPlan) {
      throw new Error('Failing test plan not found');
    }
    
    console.log(`\nExecuting failing plan: ${failingPlan.planId}`);
    console.log('Plan description:', failingPlan.description);
    
    // Execute the failing plan
    const result = await server.getPlanExecutor().execute(sessionId, failingPlan, {});
    
    console.log('\nPlan execution result:', result);
    
    // Wait a moment for supervisor to process the event
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check final session state
    const finalSession = await server.getStateStore().readSessionCore(sessionId);
    console.log('\nFinal session state:', finalSession);
    
    // Verify the error handling worked correctly
    if (finalSession?.status === 'failed' && finalSession.lastError) {
      console.log('\n✅ SUCCESS: Event-driven error handling working correctly!');
      console.log('- Plan execution failed gracefully');
      console.log('- Session status set to "failed"');
      console.log('- Error details captured:', finalSession.lastError);
      console.log('- Supervisor received and processed the workflow.failed event');
    } else {
      console.log('\n❌ FAILURE: Event-driven error handling not working as expected');
      console.log('Final session:', finalSession);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
testEventDrivenErrorHandling().catch(console.error);