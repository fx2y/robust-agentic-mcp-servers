import { ToolDefinition, PureToolImplementation } from '../../../core';

export const definition: ToolDefinition = {
  id: "validate::is_positive",
  description: "Returns true if a number is greater than 0.",
  parameters: {
    type: "object",
    properties: {
      num: { type: "number" },
    },
    required: ["num"],
  },
  outputSchema: { type: "boolean" },
};

export const implementation: PureToolImplementation = async (args) => {
  return args.num > 0;
};