import { CapabilityRegistry, ToolExecutor, PlanExecutor, InMemoryStateStore, ContextResolver, WorkflowManager } from './core';
import fs from 'fs';
import path from 'path';

async function testCapabilities() {
  // Initialize components
  const stateStore = new InMemoryStateStore();
  const capabilityRegistry = new CapabilityRegistry();
  const toolExecutor = new ToolExecutor(capabilityRegistry);
  const contextResolver = new ContextResolver();
  const workflowManager = new WorkflowManager(toolExecutor, stateStore);
  const planExecutor = new PlanExecutor(workflowManager, capabilityRegistry, contextResolver);

  // Register tools
  const addTool = await import('./capabilities/tools/math/add.tool');
  const isPositiveTool = await import('./capabilities/tools/validate/is_positive.tool');
  
  capabilityRegistry.registerTool(addTool.definition, addTool.implementation);
  capabilityRegistry.registerTool(isPositiveTool.definition, isPositiveTool.implementation);

  // Register plans
  const conditionalAddPlan = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'capabilities/plans/math/conditional_add.plan.json'), 'utf-8')
  );
  const greetingPlan = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'capabilities/plans/interaction/greeting.plan.json'), 'utf-8')
  );
  
  capabilityRegistry.registerPlan(conditionalAddPlan);
  capabilityRegistry.registerPlan(greetingPlan);

  console.log('=== Testing Tools ===');
  
  // Test math::add tool
  const addResult = await toolExecutor.execute({
    toolId: 'math::add',
    arguments: { a: 10, b: 5 }
  }, {});
  console.log('math::add(10, 5):', addResult.result.output);

  // Test validate::is_positive tool
  const isPositiveResult = await toolExecutor.execute({
    toolId: 'validate::is_positive',
    arguments: { num: 15 }
  }, {});
  console.log('validate::is_positive(15):', isPositiveResult.result.output);

  const isNegativeResult = await toolExecutor.execute({
    toolId: 'validate::is_positive',
    arguments: { num: -5 }
  }, {});
  console.log('validate::is_positive(-5):', isNegativeResult.result.output);

  console.log('\n=== Testing Plans ===');

  // Test conditional_add plan with positive result
  const sessionId1 = 'test-session-1';
  await workflowManager.createSession(sessionId1);

  console.log('Testing math::conditional_add with positive numbers (10, 5)...');
  const result1 = await planExecutor.execute(sessionId1, conditionalAddPlan, { num1: 10, num2: 5 });
  console.log('Result:', result1);
  
  // Debug: Check what's in the session history
  const session1 = await workflowManager.getSession(sessionId1);
  const history1 = await stateStore.readHistory(sessionId1);
  console.log('Session1 Context:', JSON.stringify(session1?.context, null, 2));
  console.log('Session1 History:', JSON.stringify(history1, null, 2));

  // Test conditional_add plan with non-positive result
  const sessionId2 = 'test-session-2';
  await workflowManager.createSession(sessionId2);

  console.log('\nTesting math::conditional_add with non-positive result (-10, 5)...');
  const result2 = await planExecutor.execute(sessionId2, conditionalAddPlan, { num1: -10, num2: 5 });
  console.log('Result:', result2);

  console.log('\n=== All Tests Completed ===');
}

testCapabilities().catch(console.error);