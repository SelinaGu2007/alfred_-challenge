# alfred_ Execution Decision Layer Prototype

## Overview

This prototype implements a conversation-aware execution decision layer for an assistant acting on a user’s behalf. The goal is not to classify the latest message in isolation, but to decide when the assistant should act, notify, confirm, clarify, or refuse based on the proposed action, conversation history, user state, and a mix of deterministic signals and model judgment.

The system outputs exactly one of five decisions:

- `EXECUTE_SILENTLY`
- `EXECUTE_AND_TELL`
- `CONFIRM_BEFORE_EXECUTING`
- `ASK_CLARIFYING_QUESTION`
- `REFUSE_OR_ESCALATE`

I optimized for judgment, interpretability, safe failure behavior, and scope discipline rather than model complexity or visual polish.

---

## What signals the system uses, and why

I use five top-level signal groups:

### 1. Resolution / certainty
This captures whether the task is sufficiently defined:
- is the intent clear?
- is the entity resolved?
- are key parameters complete?
- are references grounded?

This primarily supports the clarify gate. If the system does not reliably know what it is being asked to do, it should clarify rather than execute or confirm.

### 2. Risk / consequence
This captures whether the action is high-consequence even if it is understood:
- is it external-facing?
- is it hard to undo?
- is the content sensitive?
- would being wrong be costly?

This primarily supports the difference between silent/tell/confirm. A task can be fully understood and still require user approval.

### 3. Policy / boundary
This captures whether the agent should directly own execution responsibility at all:
- deception / false statements
- impersonation
- permission mismatch
- explicit approval or authorization bypass

This is what separates confirmable actions from actions that should be refused or escalated.

### 4. Autonomy expectation
This captures whether the user would reasonably expect the assistant to handle the task autonomously:
- is it routine/admin work?
- is it an external communication?
- does the user state suggest a more delegative or conservative style?

This helps distinguish silent execution from execute-and-tell.

### 5. Notification value
This captures whether informing the user after execution creates meaningful value:
- is the result otherwise hard to observe?
- does it affect the user’s next step?
- is the interruption worth it?

This helps distinguish silent execution from execute-and-tell.

A key design choice is that **contextual conflict is not its own signal family**. Instead, it modifies the interpretation of existing signals, especially resolution, risk, and policy.

---

## How I split responsibility between the LLM and regular code

I split the system into a deterministic scaffolding layer and a contextual judgment layer.

### Regular code handles:
- input structuring
- context summarization
- signal computation
- code-side decision path / deterministic trace
- schema validation
- conservative failure fallback

### The LLM handles:
- contextual interpretation of the full conversation
- synthesis of raw conversation context with computed signals
- the final structured decision on the normal path
- concise rationale generation

The code is responsible for making the system stable, inspectable, and safe. The model is responsible for making the normal-path judgment more context-sensitive than a fixed rules engine.

---

## What the model decides vs. what I compute deterministically

### Computed deterministically
I compute:
- structured action/context inputs
- context summary from conversation history
- the five signal groups
- the code-side decision trace
- fallback behavior for timeout, malformed output, and missing critical context

I also enforce conservative constraints outside the model. For example, fallback behavior is restricted to:
- clarify
- confirm
- refuse/escalate

The system never falls back to silent or autonomous execution under uncertainty.

### Decided by the model
On the live normal path, the model returns:
- `decision`
- `rationale`
- `risk_level`
- `unresolved_fields`
- `policy_flags`

That parsed model output becomes the final decision on the normal path.

So the model is not being asked to invent the entire control system from scratch. It operates inside a structured decision environment created by code.

---

## Prompt design in brief

The prompt is designed to make the model act as the execution decision layer for an assistant acting on the user’s behalf.

The prompt includes:
- the five allowed decisions
- the decision boundary
- the proposed action
- the latest user message
- relevant conversation history
- user state
- code-computed context summary
- code-computed signals

The model is required to return strict JSON with exactly these keys:
- `decision`
- `rationale`
- `risk_level`
- `unresolved_fields`
- `policy_flags`

I intentionally pass both raw conversational context and structured computed signals. The raw history preserves nuance; the computed signals make the pipeline more stable, inspectable, and easier to debug.

---

## Expected failure modes

The prototype explicitly handles three failure modes:

### 1. LLM timeout
If the model is unavailable or times out, the system falls back conservatively rather than executing.

### 2. Malformed model output
If the model output cannot be parsed into the required schema, the system falls back conservatively.

### 3. Missing critical context
If the system cannot reliably identify the action target, entity, or key parameters, it clarifies instead of executing.

A key rule is that **default safe behavior should avoid irreversible execution under uncertainty**. In practice, that means fallback decisions are restricted to clarification, confirmation, or refusal/escalation.

---

## How I would evolve this system as alfred_ gains riskier tools

As alfred_ gains riskier tools, I would not evolve this system by simply adding more keywords or more one-off rules. I would evolve it by increasing its **structured governance capacity**.

The first step is to move from a lightweight cross-action policy to **tool-specific policy**. Different tools and action types should not share the same silent threshold, confirm requirement, or hard blocks.

The second step is **stronger grounding**. As tools get riskier, the system needs much stronger linkage to concrete objects: drafts, threads, events, contacts, accounts, and other action surfaces. Many trust failures that look like “bad judgment” are really failures of object grounding.

Above that, I think the most important long-term layer is **trust / auditability**. The goal is not merely to make the system stricter. The goal is to make it more negotiable. As agents become more powerful, users will want them not just to be helpful, but to behave like an extension of themselves. That means the system needs to support a dynamic balance between the assistant’s “presence” and its ability to “disappear” into the background when appropriate.

In practice, that means making the system:
- more adjustable
- more explainable
- more replayable

Richer approval semantics should emerge from that trust layer: staged approvals, scoped approvals, and draft-first workflows are not just extra workflow states; they are how the system makes autonomy feel negotiable rather than imposed.

---

## What I would build next if I owned this for the next 6 months

### Phase 1 (0–2 months): evaluation and observability
I would first build a stronger evaluation and analysis loop around the highest-value boundaries:
- clarify vs confirm
- confirm vs refuse
- short approval after prior hold
- missing context vs risky context

I would prioritize decision traces, replay, and side-by-side comparison between code-side traces and live model decisions. I would not start by chasing broader coverage; I would start by reducing the errors that most damage user trust.

### Phase 2 (2–4 months): grounding first, then tool-specific policy
Next, I would improve grounding across the most important action objects:
- email drafts / threads
- calendar events
- contacts / entities

Once grounding is more stable, I would progressively introduce tool-specific policy rather than relying on a single cross-action decision style.

### Phase 3 (4–6 months): productize trust
Finally, I would make trust visible and adjustable in the product itself:
- user-facing autonomy controls
- decision replay / audit trail
- constrained personalization of approval behavior
- richer approval semantics

The goal would not be to make the assistant simply “more automatic.” The goal would be to let users accept higher levels of automation while still feeling that the relationship is understandable, adjustable, and under their control.

---

## Scope notes

This prototype is intentionally scoped as a decision-layer prototype rather than a full agent platform. I chose to prioritize:
- clear decision boundaries
- interpretable signals
- conservative failure handling
- a transparent pipeline
- a minimal but working UI

There are many things I would improve with more time, but for this challenge I optimized for judgment, clarity, and honest tradeoffs rather than breadth.