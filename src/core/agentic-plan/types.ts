import { JSONSchema7 } from 'json-schema';

export interface ContextValuePointer {
  jsonPath: string;
}

export interface BasePlanStep {
  id: string;
  type: 'tool_call' | 'conditional_branch' | 'parallel_branch' | 'loop_over_items' | 'human_in_the_loop' | 'final_response';
  description?: string;
}

export interface ToolCallStep extends BasePlanStep {
  type: 'tool_call';
  toolId: string;
  arguments: { [key: string]: any | ContextValuePointer };
  nextStepId: string;
}

export interface ConditionalBranchStep extends BasePlanStep {
  type: 'conditional_branch';
  condition: {
    left: any | ContextValuePointer;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'exists' | 'not_exists' | 'contains';
    right: any | ContextValuePointer;
  };
  onTrue: { nextStepId: string };
  onFalse: { nextStepId: string };
}

export interface ParallelBranchStep extends BasePlanStep {
  type: 'parallel_branch';
  branches: {
    id: string;
    steps: PlanStep[];
  }[];
  nextStepId: string;
}

export interface LoopOverItemsStep extends BasePlanStep {
  type: 'loop_over_items';
  collectionPath: ContextValuePointer;
  itemAlias: string;
  loopPlan: PlanStep[];
  nextStepId: string;
}

export interface HumanInTheLoopStep extends BasePlanStep {
  type: 'human_in_the_loop';
  message: string | ContextValuePointer;
  expectedInputSchema?: JSONSchema7;
  nextStepId: string;
}

export interface FinalResponseStep extends BasePlanStep {
  type: 'final_response';
  message: string | ContextValuePointer;
}

export type PlanStep =
  | ToolCallStep
  | ConditionalBranchStep
  | ParallelBranchStep
  | LoopOverItemsStep
  | HumanInTheLoopStep
  | FinalResponseStep;

export interface AgenticPlan {
  planId: string;
  description: string;
  parameters: JSONSchema7;
  startStepId: string;
  steps: PlanStep[];
}