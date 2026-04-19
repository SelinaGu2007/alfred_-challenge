export type Decision =
  | "EXECUTE_SILENTLY"
  | "EXECUTE_AND_TELL"
  | "CONFIRM_BEFORE_EXECUTING"
  | "ASK_CLARIFYING_QUESTION"
  | "REFUSE_OR_ESCALATE";

export type ActionType =
  | "send_email"
  | "schedule_meeting"
  | "create_reminder"
  | "modify_calendar"
  | "cancel_event"
  | "send_message";

export type Role = "user" | "assistant";

export type RiskLevel = "low" | "medium" | "high";

export type FailureMode =
  | "timeout"
  | "malformed_output"
  | "missing_context"
  | null;

export type SimulatedFailureMode = Exclude<FailureMode, null>;

export type ConservativeFallbackDecision = Exclude<
  Decision,
  "EXECUTE_SILENTLY" | "EXECUTE_AND_TELL"
>;

export type ModelStage = "live" | "fallback";

export interface ProposedAction {
  actionType: ActionType;
  target?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  time?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationTurn {
  role: Role;
  content: string;
}

export interface UserState {
  autonomyPreference?: "low" | "medium" | "high";
  knownContacts?: string[];
  approvalStyle?: "conservative" | "balanced" | "delegative";
}

export interface EvaluationInput {
  proposedAction: ProposedAction;
  latestUserMessage: string;
  conversationHistory: ConversationTurn[];
  userState?: UserState;
  simulateFailure?: SimulatedFailureMode;
}

export interface Scenario extends EvaluationInput {
  id: string;
  title: string;
  category: "easy" | "ambiguous" | "risky";
}

export interface ContextSummary {
  priorHoldDetected: boolean;
  priorConfirmationRequested: boolean;
  userReversedPriorInstruction: boolean;
  unresolvedReferenceDetected: boolean;
  notes: string[];
}

export interface ResolutionSignals {
  intentResolved: boolean;
  entityResolved: boolean;
  keyParametersComplete: boolean;
  referenceResolved: boolean;
  findings: string[];
}

export interface RiskSignals {
  irreversible: boolean;
  externalFacing: boolean;
  sensitiveDomain: boolean;
  highConsequenceIfWrong: boolean;
  findings: string[];
}

export interface PolicySignals {
  policyBlocked: boolean;
  permissionMismatch: boolean;
  responsibilityBoundaryHit: boolean;
  findings: string[];
}

export interface AutonomySignals {
  expectedAutonomy: "low" | "medium" | "high";
  routineTask: boolean;
  findings: string[];
}

export interface NotificationSignals {
  notificationValue: "low" | "medium" | "high";
  resultVisibility: "low" | "medium" | "high";
  interruptionCost: "low" | "medium" | "high";
  findings: string[];
}

export interface ComputedSignals {
  resolution: ResolutionSignals;
  risk: RiskSignals;
  policy: PolicySignals;
  autonomy: AutonomySignals;
  notification: NotificationSignals;
}

export interface DecisionPathStep {
  step:
    | "CLARIFY_GATE"
    | "BOUNDARY_GATE"
    | "SILENT_ELIGIBILITY"
    | "FINAL_ROUTING";
  outcome: "passed" | "triggered" | "failed" | "skipped";
  reason: string;
}

export interface ModelDecision {
  decision: Decision;
  rationale: string;
  risk_level: RiskLevel;
  unresolved_fields: string[];
  policy_flags: string[];
}

export interface DecisionResult {
  finalDecision: Decision;
  rationale: string;
  failureMode: FailureMode;
  modelStage: ModelStage;
  decisionPath: DecisionPathStep[];
  parsedModelOutput: ModelDecision | null;
  rawModelOutput: string | null;
}

export interface EvaluationOutput {
  inputs: EvaluationInput;
  contextSummary: ContextSummary;
  signals: ComputedSignals;
  prompt: string | null;
  result: DecisionResult;
}
