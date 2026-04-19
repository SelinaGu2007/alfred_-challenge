import { ContextSummary, ConversationTurn } from "../types/types";

const HOLD_PATTERN =
  /\b(hold off|wait|don't send yet|do not send yet|not yet|pause|stop)\b|\b(after|until)\b.{0,40}\blegal review/i;

const CONFIRMATION_REQUEST_PATTERN =
  /\b(want me to|should i|shall i|do you want me to|okay to|ready for me to)\b.{0,80}\b(send|proceed|cancel|schedule|book|create|block|do it)\b/i;

const REALLOW_PATTERN =
  /\b(yes|yep|yeah|ok|okay|go ahead|send it|send that|proceed|do it|cancel it|block it|approved?|confirmed?)\b/i;

const VAGUE_REFERENCE_PATTERN =
  /\b(it|that|this|them|they|second version|go ahead|send it|send that|cancel it|block it|do it)\b/i;

const MISSING_CONTEXT_PATTERN =
  /\b(do not have|don't have|missing|another thread|not in this conversation|need the draft|need those drafts|need the recipient)\b/i;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function getPriorTurns(
  conversationHistory: ConversationTurn[],
  latestUserMessage: string
): ConversationTurn[] {
  const latest = normalize(latestUserMessage);
  const lastTurn = conversationHistory[conversationHistory.length - 1];

  if (
    lastTurn?.role === "user" &&
    normalize(lastTurn.content) === latest
  ) {
    return conversationHistory.slice(0, -1);
  }

  return conversationHistory;
}

function hasGroundingConfirmation(priorTurns: ConversationTurn[]): boolean {
  const lastPriorTurn = priorTurns[priorTurns.length - 1];

  return (
    lastPriorTurn?.role === "assistant" &&
    CONFIRMATION_REQUEST_PATTERN.test(lastPriorTurn.content)
  );
}

function addNote(notes: string[], condition: boolean, note: string): void {
  if (condition) {
    notes.push(note);
  }
}

export function summarizeContext(
  conversationHistory: ConversationTurn[],
  latestUserMessage: string
): ContextSummary {
  const priorTurns = getPriorTurns(conversationHistory, latestUserMessage);
  const priorUserTurns = priorTurns.filter((turn) => turn.role === "user");
  const priorAssistantTurns = priorTurns.filter(
    (turn) => turn.role === "assistant"
  );

  const priorHoldDetected = priorUserTurns.some((turn) =>
    HOLD_PATTERN.test(turn.content)
  );
  const priorConfirmationRequested = priorAssistantTurns.some((turn) =>
    CONFIRMATION_REQUEST_PATTERN.test(turn.content)
  );
  const userReversedPriorInstruction =
    priorHoldDetected && REALLOW_PATTERN.test(latestUserMessage);

  const vagueLatestReference =
    VAGUE_REFERENCE_PATTERN.test(latestUserMessage);
  const missingContextMentioned = priorTurns.some((turn) =>
    MISSING_CONTEXT_PATTERN.test(turn.content)
  );
  const unresolvedReferenceDetected =
    vagueLatestReference &&
    (!hasGroundingConfirmation(priorTurns) ||
      priorHoldDetected ||
      missingContextMentioned);

  const notes: string[] = [];

  addNote(
    notes,
    priorHoldDetected,
    "Earlier user turn paused or blocked the action."
  );
  addNote(
    notes,
    priorConfirmationRequested,
    "Assistant previously asked for confirmation."
  );
  addNote(
    notes,
    userReversedPriorInstruction,
    "Latest user message appears to re-allow a previously paused action."
  );
  addNote(
    notes,
    unresolvedReferenceDetected,
    "Latest user message relies on a potentially unresolved reference."
  );
  addNote(
    notes,
    missingContextMentioned,
    "Conversation indicates critical context may be missing."
  );

  return {
    priorHoldDetected,
    priorConfirmationRequested,
    userReversedPriorInstruction,
    unresolvedReferenceDetected,
    notes
  };
}
