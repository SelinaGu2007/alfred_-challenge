"use client";

import { useMemo, useState } from "react";
import { sampleScenarios } from "../src/scenarios/sampleScenarios";
import { EvaluationOutput } from "../src/types/types";

function jsonBlock(value: unknown): string {
  return value === null ? "null" : JSON.stringify(value, null, 2);
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Pre({ value }: { value: unknown }) {
  return <pre>{typeof value === "string" ? value : jsonBlock(value)}</pre>;
}

export default function Page() {
  const [selectedId, setSelectedId] = useState(sampleScenarios[0]?.id ?? "");
  const [output, setOutput] = useState<EvaluationOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = useMemo(
    () => sampleScenarios.find((scenario) => scenario.id === selectedId),
    [selectedId]
  );

  async function runEvaluation() {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scenarioId: selectedId })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Evaluation failed");
      }

      setOutput(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Alfred Decision Layer</h1>
          <p>
            Select a preloaded scenario, run the decision pipeline, and inspect
            the full trace.
          </p>
        </div>
      </header>

      <div className="layout">
        <aside className="panel">
          <Section title="Scenario">
            <label htmlFor="scenario">Preloaded scenario</label>
            <select
              id="scenario"
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setOutput(null);
                setError(null);
              }}
            >
              {sampleScenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>

            {selectedScenario ? (
              <div className="summary">
                <div>
                  <span>Id</span>
                  <strong>{selectedScenario.id}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{selectedScenario.category}</strong>
                </div>
                <div>
                  <span>Failure demo</span>
                  <strong>{selectedScenario.simulateFailure ?? "none"}</strong>
                </div>
              </div>
            ) : null}

            <button onClick={runEvaluation} disabled={!selectedId || isRunning}>
              {isRunning ? "Running..." : "Run evaluation"}
            </button>

            {error ? <p className="error">{error}</p> : null}
          </Section>
        </aside>

        <div className="results">
          {output ? (
            <>
              <section className="decision">
                <div>
                  <span>Final decision</span>
                  <h2>{output.result.finalDecision}</h2>
                </div>
                <p>{output.result.rationale}</p>
                <dl>
                  <div>
                    <dt>Failure mode</dt>
                    <dd>{output.result.failureMode ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Model stage</dt>
                    <dd>{output.result.modelStage}</dd>
                  </div>
                </dl>
              </section>

              <Section title="Decision Path">
                <ol className="path">
                  {output.result.decisionPath.map((step) => (
                    <li key={`${step.step}-${step.outcome}`}>
                      <strong>{step.step}</strong>
                      <span>{step.outcome}</span>
                      <p>{step.reason}</p>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Inputs">
                <Pre value={output.inputs} />
              </Section>

              <Section title="Context Summary">
                <Pre value={output.contextSummary} />
              </Section>

              <Section title="Computed Signals / Rules">
                <Pre value={output.signals} />
              </Section>

              <Section title="Exact Prompt">
                <Pre value={output.prompt} />
              </Section>

              <Section title="Raw Model Output">
                <Pre value={output.result.rawModelOutput} />
              </Section>

              <Section title="Final Parsed Decision">
                <Pre value={output.result.parsedModelOutput} />
              </Section>
            </>
          ) : (
            <section className="empty">
              <h2>No evaluation yet</h2>
              <p>Choose a scenario and run the pipeline to inspect the result.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
