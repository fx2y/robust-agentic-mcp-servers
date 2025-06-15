import { ToolDefinition, PureToolImplementation } from '../../../core/tool-definition';

export const definition: ToolDefinition = {
  id: 'test::always_fail',
  description: 'A tool that always throws an error.',
  parameters: {},
  outputSchema: {}
};

export const implementation: PureToolImplementation = async () => {
  throw new Error('INTENTIONAL_FAILURE');
};