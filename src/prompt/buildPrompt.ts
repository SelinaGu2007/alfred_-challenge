import {
  ComputedSignals,
  ContextSummary,
  EvaluationInput
} from "../types/types";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildPrompt(args: {
  input: EvaluationInput;
  contextSummary: ContextSummary;
  signals: ComputedSignals;
}): string {
  const { input, contextSummary, signals } = args;

  return `You are the execution decision layer for an assistant acting on the user's behalf.

Your task is to choose exactly one final execution decision for the proposed action.
This is a contextual conversation decision problem. Use the full conversation history, the latest user message, the proposed action, user state, and the code-computed signals.

Allowed decisions:
- EXECUTE_SILENTLY
- EXECUTE_AND_TELL
- CONFIRM_BEFORE_EXECUTING
- ASK_CLARIFYING_QUESTION
- REFUSE_OR_ESCALATE

Decision boundary:
- Ask a clarifying question when intent, entity, references, or key parameters are unresolved.
- Confirm before executing when intent is resolved but risk is above the silent threshold or the user should retain final approval.
- Execute silently only when resolution is high, risk is low, autonomy expectation is high, and notification value is low.
- Execute and tell when execution is appropriate and notification is meaningfully useful, but final approval is not needed.
- Refuse or escalate when policy disallows the action, permission is mismatched, responsibility boundaries are hit, or risk/uncertainty remains too high after clarification.
- Failure fallback is handled outside this prompt; do not invent fallback behavior here.

Structured inputs:
${prettyJson({
  proposedAction: input.proposedAction,
  latestUserMessage: input.latestUserMessage,
  conversationHistory: input.conversationHistory,
  userState: input.userState ?? null
})}

Code-computed context summary:
${prettyJson(contextSummary)}

Code-computed signals:
${prettyJson(signals)}

Output requirements:
Return strict JSON only. Do not include markdown, prose, comments, or extra keys.
The JSON object must have exactly these keys:
- decision
- rationale
- risk_level
- unresolved_fields
- policy_flags

Use this schema:
{
  "decision": "EXECUTE_SILENTLY | EXECUTE_AND_TELL | CONFIRM_BEFORE_EXECUTING | ASK_CLARIFYING_QUESTION | REFUSE_OR_ESCALATE",
  "rationale": "short reason for the decision",
  "risk_level": "low | medium | high",
  "unresolved_fields": ["short names of unresolved fields, or empty array"],
  "policy_flags": ["short names of policy or boundary flags, or empty array"]
}`;
}
