import { Decision, ModelDecision, RiskLevel } from "../types/types";

const ALLOWED_DECISIONS: Decision[] = [
  "EXECUTE_SILENTLY",
  "EXECUTE_AND_TELL",
  "CONFIRM_BEFORE_EXECUTING",
  "ASK_CLARIFYING_QUESTION",
  "REFUSE_OR_ESCALATE"
];

const ALLOWED_RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];

const REQUIRED_KEYS: Array<keyof ModelDecision> = [
  "decision",
  "rationale",
  "risk_level",
  "unresolved_fields",
  "policy_flags"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDecision(value: unknown): value is Decision {
  return (
    typeof value === "string" &&
    ALLOWED_DECISIONS.includes(value as Decision)
  );
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return (
    typeof value === "string" &&
    ALLOWED_RISK_LEVELS.includes(value as RiskLevel)
  );
}

export function parseModelOutput(raw: string): ModelDecision {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("invalid field type: output must be a JSON object");
  }

  const missingKeys = REQUIRED_KEYS.filter((key) => !(key in parsed));
  if (missingKeys.length > 0) {
    throw new Error(`missing required keys: ${missingKeys.join(", ")}`);
  }

  if (!isDecision(parsed.decision)) {
    throw new Error("invalid decision value");
  }

  if (typeof parsed.rationale !== "string") {
    throw new Error("invalid field type: rationale must be a string");
  }

  if (!isRiskLevel(parsed.risk_level)) {
    throw new Error("invalid risk_level value");
  }

  if (!isStringArray(parsed.unresolved_fields)) {
    throw new Error(
      "invalid field type: unresolved_fields must be an array of strings"
    );
  }

  if (!isStringArray(parsed.policy_flags)) {
    throw new Error(
      "invalid field type: policy_flags must be an array of strings"
    );
  }

  return {
    decision: parsed.decision,
    rationale: parsed.rationale,
    risk_level: parsed.risk_level,
    unresolved_fields: parsed.unresolved_fields,
    policy_flags: parsed.policy_flags
  };
}
