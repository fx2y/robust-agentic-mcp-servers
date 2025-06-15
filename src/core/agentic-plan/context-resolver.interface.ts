import { ContextValuePointer } from './types';
import { HistoryEntry } from '../state/types';

export interface IContextResolver {
  /**
   * Resolves a JSONPath pointer against the combined session state.
   * @param pointer The ContextValuePointer to resolve.
   * @param state The combined state object, including context, history, and initial prompt inputs.
   * @returns The resolved value.
   * @throws Error if the path cannot be resolved.
   */
  resolve(pointer: ContextValuePointer, state: { context: any, history: HistoryEntry[], promptInput: any }): any;
}