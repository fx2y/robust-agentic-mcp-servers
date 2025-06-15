import { AgenticPlan } from './types';
import { SessionCore } from '../state/types';

export interface IPlanExecutor {
  /**
   * Initiates or resumes the execution of a plan within a given session.
   * @param sessionId The ID of the workflow session.
   * @param plan The AgenticPlan to execute.
   * @param initialArgs The initial arguments for the plan, validated against plan.parameters.
   * @returns A promise that resolves with the final SessionCore state upon completion or pause.
   */
  execute(sessionId: string, plan: AgenticPlan, initialArgs: any): Promise<SessionCore>;

  /**
   * Resumes a plan that was paused by a 'human_in_the_loop' step.
   * @param sessionId The ID of the paused workflow session.
   * @param humanInput The data provided by the human, which will be added to the session context.
   * @returns A promise that resolves with the final SessionCore state upon completion or next pause.
   */
  resume(sessionId: string, humanInput: any): Promise<SessionCore>;
}