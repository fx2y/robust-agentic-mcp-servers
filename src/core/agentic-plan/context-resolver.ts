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

      // For filter expressions that don't match, return empty array
      if (result === undefined && pointer.jsonPath.includes('[?(@.')) {
        return [];
      }

      // Return undefined for non-existent paths
      if (result === undefined) {
        return undefined;
      }

      // Return empty arrays as-is for non-matching filters
      if (Array.isArray(result) && result.length === 0) {
        return result;
      }

      // If result is an array with one element, return the element directly
      if (Array.isArray(result) && result.length === 1) {
        return result[0];
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to resolve JSONPath ${pointer.jsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}