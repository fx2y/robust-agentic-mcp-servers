import { CapabilityRegistry, ToolExecutor, PlanExecutor, InMemoryStateStore, ContextResolver, WorkflowManager, InMemoryEventBus } from './core';
import fs from 'fs';
import path from 'path';

async function testCapabilities() {
  // Note: This test file is deprecated with Phase 5 changes
  // The CapabilityRegistry now requires Redis dependencies
  console.log('Test file is deprecated - use the new server with REST API instead');
  return;
}

// Run the test
if (require.main === module) {
  testCapabilities().catch(console.error);
}