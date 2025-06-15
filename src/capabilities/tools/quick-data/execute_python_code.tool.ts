import { ToolDefinition, PureToolImplementation } from '../../../core/tool-definition';
import { ISandboxService } from '../../../services/sandbox.interface';

export const definition: ToolDefinition = {
  id: 'quick-data::execute_python_code',
  description: 'Execute Python code in a secure sandbox environment',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute'
      },
      inputs: {
        type: 'object',
        description: 'Variables to make available in the execution context',
        additionalProperties: true
      }
    },
    required: ['code'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['success', 'error', 'timeout']
      },
      stdout: {
        type: 'string',
        description: 'Standard output from the execution'
      },
      stderr: {
        type: 'string',
        description: 'Standard error from the execution'
      },
      returnValue: {
        description: 'The return value from the executed code'
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if execution failed'
      }
    },
    required: ['status']
  }
};

export const implementation = (sandboxService: ISandboxService): PureToolImplementation => {
  return async (args: { code: string; inputs?: Record<string, any> }) => {
    return await sandboxService.execute({
      language: 'python',
      code: args.code,
      inputs: args.inputs
    });
  };
};