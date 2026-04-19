import {
  ComputedSignals,
  ConservativeFallbackDecision,
  SimulatedFailureMode
} from "../types/types";

type FallbackDecisionResult = {
  finalDecision: ConservativeFallbackDecision;
  rationale: string;
};

function hasBoundaryBlock(signals: ComputedSignals): boolean {
  const policy = signals.policy;

  return (
    policy.policyBlocked ||
    policy.permissionMismatch ||
    policy.responsibilityBoundaryHit
  );
}

export function runFallbackDecision(args: {
  failureMode: SimulatedFailureMode;
  signals: ComputedSignals;
}): FallbackDecisionResult {
  const { failureMode, signals } = args;

  if (failureMode === "missing_context") {
    return {
      finalDecision: "ASK_CLARIFYING_QUESTION",
      rationale: "Ask for clarification because critical context is missing."
    };
  }

  if (hasBoundaryBlock(signals)) {
    return {
      finalDecision: "REFUSE_OR_ESCALATE",
      rationale:
        "Refuse or escalate because a policy, permission, or responsibility boundary is present."
    };
  }

  return {
    finalDecision: "CONFIRM_BEFORE_EXECUTING",
    rationale:
      "Confirm before executing because the model result was unavailable or unreliable."
  };
}
