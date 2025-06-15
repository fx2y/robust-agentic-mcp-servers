import { JSONPath } from 'jsonpath-plus';
import { IContextResolver } from './context-resolver.interface';
import { ContextValuePointer } from './types';
import { HistoryEntry } from '../state/types';

export class ContextResolver implements IContextResolver {
  resolve(pointer: ContextValuePointer, state: { context: any, history: HistoryEntry[], promptInput: any }): any {
    try {
      const result = JSONPath({
        path: pointer.jsonPath,
        json: state,
        wrap: false
      });

      if (result === undefined) {
        throw new Error(`JSONPath ${pointer.jsonPath} resolved to undefined`);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to resolve JSONPath ${pointer.jsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}