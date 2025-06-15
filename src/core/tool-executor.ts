import Ajv from 'ajv';
import { ICapabilityRegistry } from './capability-registry';

export interface ToolExecutionRequest {
  toolId: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  status: 'success' | 'error';
  output?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface IToolExecutor {
  execute(
    request: ToolExecutionRequest,
    sessionContext: Record<string, any>
  ): Promise<{
    result: ToolExecutionResult;
    newContext: Record<string, any>;
  }>;
}

export class ToolExecutor implements IToolExecutor {
  private ajv = new Ajv();

  constructor(private registry: ICapabilityRegistry) {}

  async execute(
    request: ToolExecutionRequest,
    sessionContext: Record<string, any>
  ): Promise<{
    result: ToolExecutionResult;
    newContext: Record<string, any>;
  }> {
    const definition = this.registry.getDefinition(request.toolId);
    const implementation = this.registry.getImplementation(request.toolId);
    if (!definition || !implementation) {
      return {
        result: {
          status: 'error',
          error: {
            name: 'ToolNotFoundError',
            message: `Tool with ID '${request.toolId}' not found in registry`
          }
        },
        newContext: sessionContext
      };
    }

    const validateInput = this.ajv.compile(definition.parameters);
    if (!validateInput(request.arguments)) {
      return {
        result: {
          status: 'error',
          error: {
            name: 'InputValidationError',
            message: `Invalid arguments: ${this.ajv.errorsText(validateInput.errors)}`
          }
        },
        newContext: sessionContext
      };
    }

    try {
      const output = await implementation(request.arguments);
      const validateOutput = this.ajv.compile(definition.outputSchema);
      if (!validateOutput(output)) {
        return {
          result: {
            status: 'error',
            error: {
              name: 'OutputValidationError',
              message: `Invalid tool output: ${this.ajv.errorsText(validateOutput.errors)}`
            }
          },
          newContext: sessionContext
        };
      }

      // Update context with tool output for state mediation
      const newContext = {
        ...sessionContext,
        [`${request.toolId}_result`]: output,
        lastToolExecution: {
          toolId: request.toolId,
          timestamp: new Date().toISOString(),
          output
        }
      };

      return {
        result: {
          status: 'success',
          output
        },
        newContext
      };
    } catch (error) {
      return {
        result: {
          status: 'error',
          error: {
            name: 'ToolExecutionError',
            message: error instanceof Error ? error.message : 'An unknown error occurred',
            stack: error instanceof Error ? error.stack : undefined
          }
        },
        newContext: sessionContext
      };
    }
  }
}