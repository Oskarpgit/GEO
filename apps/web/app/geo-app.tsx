"use client";

import { FormEvent, useMemo, useState } from "react";

type Analysis = {
  offer: { offerId: string; productId?: string; title?: string; source: string };
  audit: {
    score: number;
    maxScore: number;
    confidence: number;
    evidenceLevel: string;
    components: Array<{ id: string; label: string; score: number; maxScore: number }>;
    recommendations: Array<{
      id: string;
      priority: "high" | "medium" | "low";
      title: string;
      rationale: string;
      safetyBoundary: string;
    }>;
    allegro: { readyForGeneration: boolean; totals: Record<string, number> };
    generationInputReady: boolean;
    generationInputReasons: string[];
  };
  claims: Array<{
    claimId: string;
    kind: string;
    label: string;
    value: string;
    sourceKind: string;
    reviewStatus: string;
  }>;
  generation: null | {
    status: "blocked" | "generated";
    reasons?: string[];
    description?: string;
    validationStatus?: string;
    provenanceValid?: boolean;
    readyForHumanReview?: boolean;
    readyForUse?: boolean;
  };
  boundaries: {
    causalClaimAllowed: false;
    claimsRequireExplicitReview: true;
    catalogIdentityConnected: false;
  };
};

async function requestAnalysis(payload: Record<string, unknown>): Promise<Analysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as Analysis | { error?: string };
  if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Analiza nie powiodła się.");
  return body as Analysis;
}

export default function GeoApp() {
  const [activeModule, setActiveModule] = useState<"geo" | "analizy">("geo");
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [url, setUrl] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [approvedClaims, setApprovedClaims] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "analyzing" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const identityClaims = useMemo(
    () => analysis?.claims.filter((claim) => claim.kind !== "parameter").length ?? 0,
    [analysis],
  );

  async function analyze(event?: FormEvent, demo = false) {
    event?.preventDefault();
    setError(null);
    setCopied(false);
    setPhase("analyzing");
    try {
      const result = await requestAnalysis(demo ? { demo: true } : { url });
      setAnalysis(result);
      setIsDemo(demo);
      setApprovedClaims(new Set());
    } catch (caught) {
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : "Analiza nie powiodła się.");
    } finally {
      setPhase("idle");
    }
  }

  async function generate() {
    if (!analysis || approvedClaims.size === 0) return;
    setError(null);
    setPhase("generating");
    try {
      const result = await requestAnalysis({
        ...(isDemo ? { demo: true } : { url }),
        approvedClaimIds: [...approvedClaims],
      });
      setAnalysis(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generowanie nie powiodło się.");
    } finally {
      setPhase("idle");
    }
  }

  function toggleClaim(claimId: string) {
    setApprovedClaims((current) => {
      const next = new Set(current);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  }

  async function copyDescription() {
    const description = analysis?.generation?.description;
    if (!description) return;
    await navigator.clipboard.writeText(description);
    setCopied(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Shoppalyzer">shoppalyzer<span className="brand-dot">.</span></div>
        <span className="environment-pill">GEO beta</span>
      </header>

      <aside className="sidebar" aria-label="Nawigacja główna">
        <nav className="nav-list">
          <button
            className={`nav-item ${activeModule === "geo" ? "nav-item-active" : ""}`}
            onClick={() => setActiveModule("geo")}
            type="button"
          >
            <span className="nav-icon">G</span> GEO
          </button>
          <button
            className={`nav-item ${activeModule === "analizy" ? "nav-item-active" : ""}`}
            onClick={() => setActiveModule("analizy")}
            type="button"
          >
            <span className="nav-icon">A</span> Analizy
          </button>
        </nav>
        <div className="sidebar-footer"><span className="nav-icon">?</span> Jak działa GEO</div>
      </aside>

      {activeModule === "analizy" ? (
        <section className="workspace">
          <div className="workspace-inner">
            <div className="eyebrow">Oddzielny moduł</div>
            <h1>Analizy ofert</h1>
            <p className="lead">To miejsce jest przygotowane do podłączenia istniejącego modelu analitycznego Shoppalyzer. Moduł GEO działa niezależnie w menu po lewej.</p>
            <div className="empty-module">
              <span className="empty-module-icon">A</span>
              <div><h2>Moduł gotowy do konsolidacji</h2><p>Nie łączymy wyników analizy sprzedażowej z wynikiem GEO bez jawnego modelu danych.</p></div>
            </div>
          </div>
        </section>
      ) : (
        <section className="workspace" id="geo">
          <div className="workspace-inner">
            <div className="eyebrow">Widoczność ofert w odpowiedziach AI</div>
            <h1>Optymalizacja GEO dla Allegro</h1>
            <p className="lead">Sprawdź, czy opis Twojej oferty jest czytelny dla modeli językowych i otrzymaj rekomendacje oparte wyłącznie na potwierdzonych danych produktu.</p>

            <form className="analysis-card" onSubmit={(event) => void analyze(event)}>
              <div className="card-heading">
                <div><span className="step-label">Krok 1 z 3</span><h2>Nowa analiza GEO</h2></div>
                <div className="mode-switch" aria-label="Tryb analizy">
                  <button className={mode === "basic" ? "mode-active" : ""} onClick={() => setMode("basic")} type="button">Podstawowy</button>
                  <button className={mode === "advanced" ? "mode-active" : ""} onClick={() => setMode("advanced")} type="button">Zaawansowany</button>
                </div>
              </div>
              <label className="field-label" htmlFor="offer-url">Link do oferty Allegro</label>
              <div className="url-row">
                <input id="offer-url" name="offer-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://allegro.pl/oferta/nazwa-produktu-1234567890" required />
                <button className="primary-button" disabled={phase !== "idle"} type="submit">{phase === "analyzing" ? "Analizuję…" : "Analizuj GEO →"}</button>
              </div>
              <div className="form-footer">
                <p className="field-hint">Analizujemy konkretną ofertę, nie ogólną stronę produktu.</p>
                <button className="demo-button" onClick={() => void analyze(undefined, true)} disabled={phase !== "idle"} type="button">Uruchom przykład</button>
              </div>
              {mode === "advanced" && <div className="advanced-note"><strong>Tryb zaawansowany:</strong> pokazuje bramki pochodzenia danych, zgodności Allegro i gotowości generatora oddzielnie.</div>}
              {error && <div className="error-banner" role="alert">{error}</div>}
              <div className="trust-row">
                <div className="trust-item"><span>✓</span> Zgodność z Allegro</div>
                <div className="trust-item"><span>✓</span> Fakty bez zgadywania</div>
                <div className="trust-item"><span>✓</span> Rekomendacje GEO</div>
              </div>
            </form>

            {analysis && (
              <div className="results-stack" aria-live="polite">
                <section className="result-card score-card">
                  <div className="score-visual" style={{ "--score": `${analysis.audit.score * 3.6}deg` } as React.CSSProperties}>
                    <div><strong>{analysis.audit.score}</strong><span>/100</span></div>
                  </div>
                  <div className="score-copy">
                    <span className="step-label">Krok 2 z 3 · GEO Score v0.1</span>
                    <h2>{analysis.offer.title}</h2>
                    <p>To wynik jakości i kompletności treści, a nie prognoza pozycji ani sprzedaży.</p>
                    <div className="status-pills">
                      <span>{Math.round(analysis.audit.confidence * 100)}% kompletności dowodów</span>
                      <span>{analysis.claims.length} faktów do weryfikacji</span>
                      <span>{identityClaims}/4 sygnałów tożsamości</span>
                    </div>
                  </div>
                </section>

                <section className="result-card">
                  <div className="section-heading"><div><span className="step-label">Składowe wyniku</span><h2>Co rozumie model językowy</h2></div></div>
                  <div className="component-grid">
                    {analysis.audit.components.map((component) => (
                      <div className="component-row" key={component.id}>
                        <div className="component-meta"><span>{component.label}</span><strong>{component.score}/{component.maxScore}</strong></div>
                        <div className="progress-track"><span style={{ width: `${(component.score / component.maxScore) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="result-card">
                  <div className="section-heading"><div><span className="step-label">Priorytety</span><h2>Rekomendacje GEO</h2></div><span className="count-badge">{analysis.audit.recommendations.length}</span></div>
                  <div className="recommendation-list">
                    {analysis.audit.recommendations.map((recommendation, index) => (
                      <article className="recommendation" key={recommendation.id}>
                        <span className={`priority priority-${recommendation.priority}`}>{index + 1}</span>
                        <div><h3>{recommendation.title}</h3><p>{recommendation.rationale}</p><small>{recommendation.safetyBoundary}</small></div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="result-card">
                  <div className="section-heading">
                    <div><span className="step-label">Krok 3 z 3</span><h2>Zatwierdź fakty do nowego opisu</h2></div>
                    <button className="text-button" onClick={() => setApprovedClaims(new Set(analysis.claims.map((claim) => claim.claimId)))} type="button">Zaznacz wszystkie</button>
                  </div>
                  <p className="section-intro">Generator użyje wyłącznie zaznaczonych faktów. Każde zdanie zachowa powiązanie ze źródłem.</p>
                  <div className="claims-grid">
                    {analysis.claims.map((claim) => (
                      <label className="claim-row" key={claim.claimId}>
                        <input type="checkbox" checked={approvedClaims.has(claim.claimId)} onChange={() => toggleClaim(claim.claimId)} />
                        <span><strong>{claim.label}</strong><small>{claim.value}</small></span>
                        <em>{claim.kind === "parameter" ? "parametr" : "tożsamość"}</em>
                      </label>
                    ))}
                  </div>
                  <button className="primary-button generate-button" onClick={() => void generate()} disabled={phase !== "idle" || approvedClaims.size === 0} type="button">
                    {phase === "generating" ? "Generuję…" : `Generuj opis z ${approvedClaims.size} faktów →`}
                  </button>

                  {analysis.generation?.status === "blocked" && <div className="warning-banner"><strong>Generowanie zatrzymane.</strong> {analysis.generation.reasons?.join(" ")}</div>}
                  {analysis.generation?.status === "generated" && (
                    <div className="generated-output">
                      <div className="generated-heading"><div><span className="success-dot">✓</span><strong>Opis z poprawnym pochodzeniem</strong></div><button className="text-button" onClick={() => void copyDescription()} type="button">{copied ? "Skopiowano" : "Kopiuj opis"}</button></div>
                      <pre>{analysis.generation.description}</pre>
                      <p>Stan walidacji: <strong>{analysis.generation.validationStatus}</strong>. Opis nadal wymaga przeglądu reguł semantycznych Allegro.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
