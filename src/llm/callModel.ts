import OpenAI from "openai";

export async function callModel(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to call the model.");
  }

  if (!model) {
    throw new Error("OPENAI_MODEL is required to call the model.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: prompt
  });
  const outputText = response.output_text?.trim();

  if (!outputText) {
    throw new Error("Model returned no usable text output.");
  }

  return outputText;
}
