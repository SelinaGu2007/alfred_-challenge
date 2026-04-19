import { NextResponse } from "next/server";
import { evaluateInput } from "../../../src/index";
import { sampleScenarios } from "../../../src/scenarios/sampleScenarios";
import { EvaluationInput } from "../../../src/types/types";

function resolveInput(payload: unknown): EvaluationInput {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "scenarioId" in payload
  ) {
    const scenarioId = String(payload.scenarioId);
    const scenario = sampleScenarios.find((item) => item.id === scenarioId);

    if (!scenario) {
      throw new Error(`Unknown scenario id: ${scenarioId}`);
    }

    return scenario;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "input" in payload
  ) {
    return (payload as { input: EvaluationInput }).input;
  }

  return payload as EvaluationInput;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const input = resolveInput(payload);
    const output = await evaluateInput(input);

    return NextResponse.json(output);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to evaluate input";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
