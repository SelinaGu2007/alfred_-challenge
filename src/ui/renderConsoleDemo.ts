import { evaluateSampleScenarios } from "../index";
import { sampleScenarios } from "../scenarios/sampleScenarios";
import { EvaluationOutput, Scenario } from "../types/types";

const SEPARATOR = "=".repeat(80);

function pretty(value: unknown): string {
  return value === null ? "null" : JSON.stringify(value, null, 2);
}

function printSection(title: string, content: string): void {
  console.log(`\n--- ${title} ---`);
  console.log(content);
}

function scenarioFor(output: EvaluationOutput): Scenario | undefined {
  return sampleScenarios.find((scenario) => scenario === output.inputs);
}

function renderDecisionPath(output: EvaluationOutput): string {
  if (output.result.decisionPath.length === 0) {
    return "none";
  }

  return output.result.decisionPath
    .map(
      (step) =>
        `${step.step}: ${step.outcome} - ${step.reason}`
    )
    .join("\n");
}

function renderHeader(output: EvaluationOutput): string {
  const scenario = scenarioFor(output);

  if (!scenario) {
    return "Scenario: ad hoc input\nId: n/a\nCategory: n/a";
  }

  return [
    `Scenario: ${scenario.title}`,
    `Id: ${scenario.id}`,
    `Category: ${scenario.category}`
  ].join("\n");
}

export function renderEvaluation(output: EvaluationOutput): void {
  console.log(SEPARATOR);
  console.log(renderHeader(output));

  printSection("Final Decision", output.result.finalDecision);
  printSection("Rationale", output.result.rationale);
  printSection("Failure Mode", pretty(output.result.failureMode));
  printSection("Model Stage", output.result.modelStage);
  printSection("Decision Path", renderDecisionPath(output));
  printSection("Context Summary", pretty(output.contextSummary));
  printSection("Computed Signals", pretty(output.signals));
  printSection("Exact Prompt", output.prompt ?? "null");
  printSection("Raw Model Output", output.result.rawModelOutput ?? "null");
  printSection("Final Parsed Decision", pretty(output.result.parsedModelOutput));
}

export async function renderAllSampleScenarios(): Promise<void> {
  const outputs = await evaluateSampleScenarios();

  outputs.forEach((output) => renderEvaluation(output));
}
