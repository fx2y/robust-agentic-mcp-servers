import { ContextResolver } from './context-resolver';
import { ContextValuePointer } from './types';

describe('ContextResolver', () => {
  let contextResolver: ContextResolver;
  let testState: any;

  beforeEach(() => {
    contextResolver = new ContextResolver();
    testState = {
      promptInput: { target_file: "data.csv" },
      context: {
        dataset: { id: "ds-123", columns: ["A", "B"] }
      },
      history: [
        { planStepId: "step1", result: { output: { file_path: "/tmp/output.json" } } },
        { planStepId: "step2", result: { output: { status_code: 200 } } }
      ]
    };
  });

  it('should resolve promptInput.target_file', () => {
    const pointer: ContextValuePointer = { jsonPath: "$.promptInput.target_file" };
    const result = contextResolver.resolve(pointer, testState);
    expect(result).toBe("data.csv");
  });

  it('should resolve context.dataset.columns', () => {
    const pointer: ContextValuePointer = { jsonPath: "$.context.dataset.columns" };
    const result = contextResolver.resolve(pointer, testState);
    expect(result).toEqual(["A", "B"]);
  });

  it('should resolve history filter with planStepId', () => {
    const pointer: ContextValuePointer = { jsonPath: "$.history[?(@.planStepId=='step1')].result.output.file_path" };
    const result = contextResolver.resolve(pointer, testState);
    expect(result).toBe("/tmp/output.json");
  });

  it('should return undefined for non-existent key', () => {
    const pointer: ContextValuePointer = { jsonPath: "$.context.non_existent_key" };
    const result = contextResolver.resolve(pointer, testState);
    expect(result).toBeUndefined();
  });

  it('should return empty array for non-matching filter', () => {
    const pointer: ContextValuePointer = { jsonPath: "$.history[?(@.planStepId=='step3')]" };
    const result = contextResolver.resolve(pointer, testState);
    expect(result).toEqual([]);
  });
});