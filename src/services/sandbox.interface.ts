export interface SandboxExecutionRequest {
  language: 'python' | 'javascript' | 'r';
  code: string;
  inputs?: Record<string, any>;
  timeoutMs?: number;
}

export interface SandboxExecutionResult {
  status: 'success' | 'error' | 'timeout';
  stdout?: string;
  stderr?: string;
  returnValue?: any;
  errorMessage?: string;
}

export interface ISandboxService {
  execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult>;
}