import {
  ComputedSignals,
  Decision,
  DecisionPathStep
} from "../types/types";

type DecisionFlowResult = {
  finalDecision: Decision;
  rationale: string;
  decisionPath: DecisionPathStep[];
};

function addStep(
  decisionPath: DecisionPathStep[],
  step: DecisionPathStep["step"],
  outcome: DecisionPathStep["outcome"],
  reason: string
): void {
  decisionPath.push({ step, outcome, reason });
}

function hasStrongResolution(signals: ComputedSignals): boolean {
  const resolution = signals.resolution;

  return (
    resolution.intentResolved &&
    resolution.entityResolved &&
    resolution.keyParametersComplete &&
    resolution.referenceResolved
  );
}

function hasBoundaryBlock(signals: ComputedSignals): boolean {
  const policy = signals.policy;

  return (
    policy.policyBlocked ||
    policy.permissionMismatch ||
    policy.responsibilityBoundaryHit
  );
}

function isLowRisk(signals: ComputedSignals): boolean {
  const risk = signals.risk;

  return (
    !risk.irreversible &&
    !risk.externalFacing &&
    !risk.sensitiveDomain &&
    !risk.highConsequenceIfWrong
  );
}

function hasElevatedRisk(signals: ComputedSignals): boolean {
  const risk = signals.risk;

  return (
    risk.irreversible ||
    risk.externalFacing ||
    risk.sensitiveDomain ||
    risk.highConsequenceIfWrong
  );
}

function isSilentEligible(signals: ComputedSignals): boolean {
  return (
    hasStrongResolution(signals) &&
    isLowRisk(signals) &&
    signals.autonomy.expectedAutonomy === "high" &&
    signals.notification.notificationValue === "low"
  );
}

export function runDecisionFlow(args: {
  signals: ComputedSignals;
}): DecisionFlowResult {
  const { signals } = args;
  const decisionPath: DecisionPathStep[] = [];

  if (!hasStrongResolution(signals)) {
    addStep(
      decisionPath,
      "CLARIFY_GATE",
      "triggered",
      "Required intent, entity, parameters, or references are unresolved."
    );

    return {
      finalDecision: "ASK_CLARIFYING_QUESTION",
      rationale: "Ask for clarification before executing because resolution is incomplete.",
      decisionPath
    };
  }

  addStep(
    decisionPath,
    "CLARIFY_GATE",
    "passed",
    "Intent, entities, parameters, and references are resolved."
  );

  if (hasBoundaryBlock(signals)) {
    addStep(
      decisionPath,
      "BOUNDARY_GATE",
      "triggered",
      "Policy, permission, or responsibility boundary blocks direct execution."
    );

    return {
      finalDecision: "REFUSE_OR_ESCALATE",
      rationale: "Refuse or escalate because a boundary signal blocks direct execution.",
      decisionPath
    };
  }

  addStep(
    decisionPath,
    "BOUNDARY_GATE",
    "passed",
    "No policy, permission, or responsibility boundary blocks execution."
  );

  if (isSilentEligible(signals)) {
    addStep(
      decisionPath,
      "SILENT_ELIGIBILITY",
      "triggered",
      "Resolution is strong, risk is low, autonomy is high, and notification value is low."
    );

    return {
      finalDecision: "EXECUTE_SILENTLY",
      rationale: "Execute silently because all silent eligibility conditions are met.",
      decisionPath
    };
  }

  addStep(
    decisionPath,
    "SILENT_ELIGIBILITY",
    "failed",
    "At least one silent eligibility condition is not met."
  );

  if (hasElevatedRisk(signals)) {
    addStep(
      decisionPath,
      "FINAL_ROUTING",
      "triggered",
      "Elevated risk means the user should retain final approval."
    );

    return {
      finalDecision: "CONFIRM_BEFORE_EXECUTING",
      rationale: "Confirm before executing because risk is elevated.",
      decisionPath
    };
  }

  if (signals.notification.notificationValue !== "low") {
    addStep(
      decisionPath,
      "FINAL_ROUTING",
      "triggered",
      "Notification value is useful and final approval is not required."
    );

    return {
      finalDecision: "EXECUTE_AND_TELL",
      rationale: "Execute and tell because the task is executable and notification is useful.",
      decisionPath
    };
  }

  addStep(
    decisionPath,
    "FINAL_ROUTING",
    "triggered",
    "Notification value is low but silent eligibility was not satisfied."
  );

  return {
    finalDecision: "CONFIRM_BEFORE_EXECUTING",
    rationale: "Confirm before executing because silent execution is not eligible.",
    decisionPath
  };
}
