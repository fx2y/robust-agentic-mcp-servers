import { ToolDefinition, PureToolImplementation } from '../../../core';

export const definition: ToolDefinition = {
  id: "math::add",
  description: "Adds two numbers.",
  parameters: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    required: ["a", "b"],
  },
  outputSchema: { type: "number" },
};

export const implementation: PureToolImplementation = async (args) => {
  return args.a + args.b;
};