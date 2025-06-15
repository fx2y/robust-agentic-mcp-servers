import { JSONSchema7 } from 'json-schema';

export interface ToolDefinition {
  id: string;
  description: string;
  parameters: JSONSchema7;
  outputSchema: JSONSchema7;
}

export type PureToolImplementation = (args: any) => Promise<any>;