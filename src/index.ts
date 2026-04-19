import {
  ComputedSignals,
  Decision,
  DecisionPathStep,
  EvaluationInput,
  EvaluationOutput,
  SimulatedFailureMode
} from "./types/types";
import { sampleScenarios } from "./scenarios/sampleScenarios";
import { summarizeContext } from "./context/summarizeContext";
import { computeSignals } from "./signals/computeSignals";
import { runDecisionFlow } from "./decision/decisionFlow";
import { runFallbackDecision } from "./decision/fallback";
import { buildPrompt } from "./prompt/buildPrompt";
import { callModel } from "./llm/callModel";
import { parseModelOutput } from "./llm/parseModelOutput";
import { renderAllSampleScenarios } from "./ui/renderConsoleDemo";

declare const require: { main?: unknown };
declare const module: unknown;

type CodeDecision = {
  finalDecision: Decision;
  rationale: string;
  decisionPath: DecisionPathStep[];
};

function applyFallback(args: {
  failureMode: SimulatedFailureMode;
  signals: ComputedSignals;
  codeDecision: CodeDecision;
  rawModelOutput: string | null;
}): EvaluationOutput["result"] {
  const { failureMode, signals, codeDecision, rawModelOutput } = args;
  const fallback = runFallbackDecision({
    failureMode,
    signals
  });

  return {
    finalDecision: fallback.finalDecision,
    rationale: fallback.rationale,
    failureMode,
    modelStage: "fallback",
    decisionPath: codeDecision.decisionPath,
    parsedModelOutput: null,
    rawModelOutput
  };
}

function isConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "OPENAI_API_KEY is required to call the model." ||
      error.message === "OPENAI_MODEL is required to call the model.")
  );
}

export async function evaluateInput(
  input: EvaluationInput
): Promise<EvaluationOutput> {
  const contextSummary = summarizeContext(
    input.conversationHistory,
    input.latestUserMessage
  );
  const signals = computeSignals({
    proposedAction: input.proposedAction,
    latestUserMessage: input.latestUserMessage,
    conversationHistory: input.conversationHistory,
    userState: input.userState,
    contextSummary
  });
  const codeDecision = runDecisionFlow({ signals });
  const prompt = buildPrompt({
    input,
    contextSummary,
    signals
  });

  if (input.simulateFailure === "missing_context") {
    return {
      inputs: input,
      contextSummary,
      signals,
      prompt,
      result: applyFallback({
        failureMode: "missing_context",
        signals,
        codeDecision,
        rawModelOutput: null
      })
    };
  }

  if (input.simulateFailure === "timeout") {
    return {
      inputs: input,
      contextSummary,
      signals,
      prompt,
      result: applyFallback({
        failureMode: "timeout",
        signals,
        codeDecision,
        rawModelOutput: null
      })
    };
  }

  let rawModelOutput: string | null = null;

  try {
    rawModelOutput =
      input.simulateFailure === "malformed_output"
        ? "not valid model json"
        : await callModel(prompt);
    const parsedModelOutput = parseModelOutput(rawModelOutput);

    return {
      inputs: input,
      contextSummary,
      signals,
      prompt,
      result: {
        finalDecision: parsedModelOutput.decision,
        rationale: parsedModelOutput.rationale,
        failureMode: null,
        modelStage: "live",
        decisionPath: codeDecision.decisionPath,
        parsedModelOutput,
        rawModelOutput
      }
    };
  } catch (error) {
    if (isConfigurationError(error)) {
      throw error;
    }

    return {
      inputs: input,
      contextSummary,
      signals,
      prompt,
      result: applyFallback({
        failureMode: rawModelOutput ? "malformed_output" : "timeout",
        signals,
        codeDecision,
        rawModelOutput
      })
    };
  }
}

export async function evaluateSampleScenarios(): Promise<EvaluationOutput[]> {
  return Promise.all(sampleScenarios.map((scenario) => evaluateInput(scenario)));
}

if (typeof require !== "undefined" && require.main === module) {
  void renderAllSampleScenarios();
}
