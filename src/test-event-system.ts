import { AgenticMCPServer } from './server';
import { v4 as uuidv4 } from 'uuid';
import { AgenticPlan } from './core';

async function testEventDrivenErrorHandling() {
  console.log('=== Testing Event-Driven Error Handling System ===\n');

  const server = new AgenticMCPServer();
  await server.start();

  const workflowManager = server.getWorkflowManager();
  const planExecutor = server.getPlanExecutor();
  const eventBus = server.getEventBus();

  // Create a session
  const sessionId = uuidv4();
  await workflowManager.createSession(sessionId);
  console.log(`Created session: ${sessionId}\n`);

  // Test 1: Successful workflow execution
  console.log('Test 1: Successful workflow execution');
  try {
    const session = await workflowManager.getSession(sessionId);
    console.log('Initial session state:', session?.core.status);

    // Execute a simple math plan that should succeed
    const plan = server.getCapabilityRegistry().getPlan('math::conditional_add');
    if (plan) {
      const result = await planExecutor.execute(sessionId, plan, { num1: 5, num2: 3 });
      console.log('Workflow completed with status:', result.status);
      console.log('Final session state:', result, '\n');
    } else {
      console.log('Conditional add plan not found\n');
    }
  } catch (error) {
    console.error('Error in Test 1:', error, '\n');
  }

  // Test 2: Workflow failure (invalid tool)
  console.log('Test 2: Workflow failure with invalid tool');
  try {
    const sessionId2 = uuidv4();
    await workflowManager.createSession(sessionId2);

    // Create a plan that will fail (invalid tool)
    const failingPlan: AgenticPlan = {
      planId: 'test_failing_plan',
      description: 'A plan that will fail',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      },
      startStepId: 'step1',
      steps: [
        {
          id: 'step1',
          type: 'tool_call' as const,
          toolId: 'nonexistent_tool', // This will cause failure
          arguments: { input: 'test' },
          nextStepId: 'step2'
        },
        {
          id: 'step2',
          type: 'final_response' as const,
          message: 'Should not reach here'
        }
      ]
    };

    // Register the failing plan
    server.getCapabilityRegistry().registerPlan(failingPlan);

    // Execute the failing plan - this should trigger workflow.failed event
    const result = await planExecutor.execute(sessionId2, failingPlan, { input: 'test' });
    console.log('Failing workflow result:', result.status);
    console.log('Error details:', result.lastError, '\n');

  } catch (error) {
    console.error('Error in Test 2:', error, '\n');
  }

  // Test 3: Human-in-the-loop workflow
  console.log('Test 3: Human-in-the-loop workflow (should pause and emit event)');
  try {
    const sessionId3 = uuidv4();
    await workflowManager.createSession(sessionId3);

    // Create a plan with human-in-the-loop
    const humanLoopPlan: AgenticPlan = {
      planId: 'test_human_loop',
      description: 'A plan that requires human input',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      },
      startStepId: 'step1',
      steps: [
        {
          id: 'step1',
          type: 'human_in_the_loop' as const,
          message: 'Please provide your input',
          nextStepId: 'step2',
          expectedInputSchema: {
            type: 'object',
            properties: {
              userInput: { type: 'string' }
            }
          }
        },
        {
          id: 'step2',
          type: 'final_response' as const,
          message: 'Thank you for your input!'
        }
      ]
    };

    server.getCapabilityRegistry().registerPlan(humanLoopPlan);

    const result = await planExecutor.execute(sessionId3, humanLoopPlan, { message: 'Hello' });
    console.log('Human loop workflow result:', result.status);
    console.log('Should be paused_on_human:', result.status === 'paused_on_human');

  } catch (error) {
    console.error('Error in Test 3:', error, '\n');
  }

  // Give some time for events to be processed
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('=== Event System Tests Complete ===');
  console.log('Check the console output above for supervisor event handling messages');
}

// Run the test
if (require.main === module) {
  testEventDrivenErrorHandling().catch(console.error);
}