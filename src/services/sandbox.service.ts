import { ISandboxService, SandboxExecutionRequest, SandboxExecutionResult } from './sandbox.interface';

export class SandboxService implements ISandboxService {
  constructor(private readonly sandboxServiceUrl: string) {}

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
    try {
      const response = await fetch(`${this.sandboxServiceUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return {
          status: 'error',
          errorMessage: `Sandbox service returned ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json() as SandboxExecutionResult;
      return result;
    } catch (error) {
      return {
        status: 'error',
        errorMessage: `Failed to communicate with sandbox service: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}