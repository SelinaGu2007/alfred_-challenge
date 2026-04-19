import {
  ComputedSignals,
  ContextSummary,
  ConversationTurn,
  ProposedAction,
  UserState
} from "../types/types";

type SignalArgs = {
  proposedAction: ProposedAction;
  latestUserMessage: string;
  conversationHistory: ConversationTurn[];
  userState?: UserState;
  contextSummary: ContextSummary;
};

const VAGUE_REFERENCE_PATTERN =
  /\b(it|that|this|them|they|second version|go ahead|send it|send that|cancel it|block it|do it)\b/i;

const APPROVAL_PATTERN =
  /\b(yes|yep|yeah|go ahead|do it|send it|proceed)\b/i;

const COMPETING_CANDIDATE_PATTERN =
  /\b(second version|first version|other one|another draft|one of them|that one|the other draft)\b/i;

const EXTERNAL_PATTERN =
  /@|\b(partner|client|customer|vendor|landlord|boss|manager|acme|external)\b/i;

const SENSITIVE_PATTERN =
  /\b(legal|contract|pricing|discount|medical|doctor|notice|eviction|resignation|hr|payroll|salary|financial|invoice)\b/i;

const DECEPTION_PATTERN =
  /\b(i never received|pretend|impersonat|fake|lie|mislead|deceptive)\b/i;

const PERMISSION_PATTERN =
  /\b(without (asking|permission)|do not tell|don't tell|unauthorized|not allowed)\b/i;

const BOUNDARY_BYPASS_PATTERN =
  /\b(without approval|without permission|unauthorized|pretend approved|say legal approved|claim legal approved|bypass approval|skip approval)\b/i;

function addFinding(
  findings: string[],
  condition: boolean,
  finding: string
): void {
  if (condition) {
    findings.push(finding);
  }
}

function textFor(args: SignalArgs): string {
  const action = args.proposedAction;
  const actionText = [
    action.target,
    action.recipient,
    action.subject,
    action.body,
    action.time
  ]
    .filter(Boolean)
    .join(" ");
  const historyText = args.conversationHistory
    .map((turn) => turn.content)
    .join(" ");

  return `${args.latestUserMessage} ${historyText} ${actionText}`;
}

function hasValue(value?: string): boolean {
  return Boolean(value?.trim());
}

function hasAmbiguousKnownContact(
  target: string | undefined,
  userState: UserState | undefined
): boolean {
  if (!target || !userState?.knownContacts?.length) {
    return false;
  }

  const normalizedTarget = target.toLowerCase();
  const matches = userState.knownContacts.filter((contact) =>
    contact.toLowerCase().includes(normalizedTarget)
  );

  return matches.length > 1;
}

function computeResolution(args: SignalArgs): ComputedSignals["resolution"] {
  const { proposedAction, latestUserMessage, userState, contextSummary } = args;
  const findings: string[] = [];

  const needsRecipient = ["send_email", "send_message"].includes(
    proposedAction.actionType
  );
  const needsBody = ["send_email", "send_message", "create_reminder"].includes(
    proposedAction.actionType
  );
  const needsTime = [
    "schedule_meeting",
    "create_reminder",
    "modify_calendar"
  ].includes(proposedAction.actionType);
  const needsTarget = ["schedule_meeting", "cancel_event"].includes(
    proposedAction.actionType
  );

  const missingRecipient = needsRecipient && !hasValue(proposedAction.recipient);
  const missingBody = needsBody && !hasValue(proposedAction.body);
  const missingTime = needsTime && !hasValue(proposedAction.time);
  const missingTarget =
    needsTarget &&
    !hasValue(proposedAction.target) &&
    !hasValue(proposedAction.recipient);
  const ambiguousContact = hasAmbiguousKnownContact(
    proposedAction.target,
    userState
  );

  const vagueLatestReference = VAGUE_REFERENCE_PATTERN.test(latestUserMessage);
  const keyParametersComplete =
    !missingRecipient && !missingBody && !missingTime && !missingTarget;
  const entityResolved = !missingRecipient && !missingTarget && !ambiguousContact;
  const intentResolved = Boolean(proposedAction.actionType);
  const shortApproval = APPROVAL_PATTERN.test(latestUserMessage);
  const competingCandidate = COMPETING_CANDIDATE_PATTERN.test(
    latestUserMessage
  );
  const groundedApproval =
    keyParametersComplete &&
    entityResolved &&
    contextSummary.priorConfirmationRequested &&
    shortApproval &&
    !competingCandidate;
  const referenceResolved =
    groundedApproval ||
    (!contextSummary.unresolvedReferenceDetected &&
      (!vagueLatestReference || contextSummary.priorConfirmationRequested));

  addFinding(findings, missingRecipient, "Missing recipient for the action.");
  addFinding(findings, missingBody, "Missing message or reminder body.");
  addFinding(findings, missingTime, "Missing required time.");
  addFinding(findings, missingTarget, "Missing target entity.");
  addFinding(
    findings,
    ambiguousContact,
    "Target may match multiple known contacts."
  );
  addFinding(
    findings,
    !referenceResolved,
    "Latest message contains an unresolved reference."
  );
  addFinding(
    findings,
    groundedApproval && contextSummary.unresolvedReferenceDetected,
    "Short approval appears grounded by the proposed action and prior confirmation."
  );

  return {
    intentResolved,
    entityResolved,
    keyParametersComplete,
    referenceResolved,
    findings
  };
}

function computeRisk(args: SignalArgs): ComputedSignals["risk"] {
  const { proposedAction, contextSummary } = args;
  const findings: string[] = [];
  const text = textFor(args);

  const sendsExternalMessage = ["send_email", "send_message"].includes(
    proposedAction.actionType
  );
  const irreversible =
    sendsExternalMessage || proposedAction.actionType === "cancel_event";
  const externalFacing =
    sendsExternalMessage &&
    (hasValue(proposedAction.recipient) ||
      EXTERNAL_PATTERN.test(text));
  const sensitiveDomain = SENSITIVE_PATTERN.test(text);
  const highConsequenceIfWrong =
    (irreversible && sensitiveDomain) ||
    (externalFacing && contextSummary.priorHoldDetected) ||
    (externalFacing && SENSITIVE_PATTERN.test(text));

  addFinding(
    findings,
    irreversible,
    "Action may be hard to undo after execution."
  );
  addFinding(findings, externalFacing, "Action affects an external party.");
  addFinding(findings, sensitiveDomain, "Sensitive domain language detected.");
  addFinding(
    findings,
    contextSummary.priorHoldDetected && externalFacing,
    "Prior hold increases consequence of external execution."
  );

  return {
    irreversible,
    externalFacing,
    sensitiveDomain,
    highConsequenceIfWrong,
    findings
  };
}

function computePolicy(args: SignalArgs): ComputedSignals["policy"] {
  const findings: string[] = [];
  const text = textFor(args);

  const policyBlocked = DECEPTION_PATTERN.test(text);
  const permissionMismatch = PERMISSION_PATTERN.test(text);
  const responsibilityBoundaryHit = BOUNDARY_BYPASS_PATTERN.test(text);

  addFinding(
    findings,
    policyBlocked,
    "Potentially deceptive or impersonating content detected."
  );
  addFinding(
    findings,
    permissionMismatch,
    "Permission or authorization concern detected."
  );
  addFinding(
    findings,
    responsibilityBoundaryHit,
    "Explicit boundary-bypass or approval issue detected."
  );

  return {
    policyBlocked,
    permissionMismatch,
    responsibilityBoundaryHit,
    findings
  };
}

function computeAutonomy(args: SignalArgs): ComputedSignals["autonomy"] {
  const { proposedAction, userState } = args;
  const findings: string[] = [];

  const routineTask =
    proposedAction.actionType === "create_reminder" ||
    proposedAction.actionType === "modify_calendar";
  const externalCommunication = ["send_email", "send_message"].includes(
    proposedAction.actionType
  );

  let expectedAutonomy: "low" | "medium" | "high" =
    userState?.autonomyPreference ?? "medium";

  if (userState?.approvalStyle === "conservative" || externalCommunication) {
    expectedAutonomy = "low";
  } else if (userState?.approvalStyle === "delegative" && routineTask) {
    expectedAutonomy = "high";
  } else if (routineTask && expectedAutonomy === "medium") {
    expectedAutonomy = "medium";
  }

  addFinding(findings, routineTask, "Task is routine or administrative.");
  addFinding(
    findings,
    externalCommunication,
    "External communication lowers expected autonomy."
  );
  addFinding(
    findings,
    userState?.approvalStyle === "conservative",
    "User state suggests conservative approval style."
  );
  addFinding(
    findings,
    userState?.approvalStyle === "delegative" && routineTask,
    "User state supports delegation for routine work."
  );

  return {
    expectedAutonomy,
    routineTask,
    findings
  };
}

function computeNotification(args: SignalArgs): ComputedSignals["notification"] {
  const { proposedAction } = args;
  const findings: string[] = [];

  const externalStateChange = ["send_email", "send_message"].includes(
    proposedAction.actionType
  );
  const scheduleChange = ["schedule_meeting", "modify_calendar", "cancel_event"].includes(
    proposedAction.actionType
  );
  const routineTask = proposedAction.actionType === "create_reminder";

  const resultVisibility: "low" | "medium" | "high" = externalStateChange
    ? "low"
    : scheduleChange
      ? "medium"
      : "high";
  const notificationValue: "low" | "medium" | "high" = externalStateChange
    ? "high"
    : scheduleChange
      ? "medium"
      : "low";
  const interruptionCost: "low" | "medium" | "high" = routineTask
    ? "high"
    : externalStateChange
      ? "low"
      : "medium";

  addFinding(
    findings,
    externalStateChange,
    "External state change makes notification valuable."
  );
  addFinding(findings, scheduleChange, "Calendar state changes are user-visible.");
  addFinding(
    findings,
    routineTask,
    "Routine delegated task has higher interruption cost."
  );

  return {
    notificationValue,
    resultVisibility,
    interruptionCost,
    findings
  };
}

export function computeSignals(args: {
  proposedAction: ProposedAction;
  latestUserMessage: string;
  conversationHistory: ConversationTurn[];
  userState?: UserState;
  contextSummary: ContextSummary;
}): ComputedSignals {
  return {
    resolution: computeResolution(args),
    risk: computeRisk(args),
    policy: computePolicy(args),
    autonomy: computeAutonomy(args),
    notification: computeNotification(args)
  };
}
