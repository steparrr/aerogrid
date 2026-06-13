import { useGame } from "../game/gameContext";
import { aircraftModelById } from "../data/indexes";
import type { GameView } from "../domain/types";

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

export function RoutesScreen() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const active    = state.routes.filter(r => r.status === "active");
  const suspended = state.routes.filter(r => r.status === "suspended");

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerTitle}>Rotte</div>
        <button style={s.addBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "planner" })}>
          + Nuova
        </button>
      </header>

      <main style={s.main}>
        {state.routes.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: "2.5rem" }}>🗺</div>
            <div style={s.emptyTitle}>Nessuna rotta</div>
            <p style={s.emptyText}>Apri la tua prima rotta dal Route Planner.</p>
            <button style={s.ctaBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "planner" })}>
              Apri una rotta →
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section style={s.section}>
                <div style={s.sectionTitle}>Attive ({active.length})</div>
                {active.map(r => {
                  const ac = state.fleet.find(a => a.id === r.aircraftId);
                  const model = ac ? aircraftModelById.get(ac.modelId) : null;
                  const lastPerf = r.performanceHistory.at(-1);
                  const profit = lastPerf?.profit ?? 0;
                  const lf = lastPerf?.loadFactor ?? 0;
                  return (
                    <div key={r.id} style={s.routeCard}>
                      <div style={s.routeHeader}>
                        <div style={s.routeCode}>{r.originIata} → {r.destinationIata}</div>
                        <button
                          style={s.suspendBtn}
                          onClick={() => dispatch({ type: "SET_ROUTE_STATUS", payload: { routeId: r.id, status: "suspended" } })}
                        >
                          Sospendi
                        </button>
                      </div>
                      <div style={s.routeMeta}>
                        {model && <span>{model.manufacturer} {model.name}</span>}
                        <span>{r.weeklyFrequency}x/sett</span>
                        <span>Eco ${r.economyPrice} · Biz ${r.businessPrice}</span>
                      </div>
                      {lastPerf ? (
                        <div style={s.perfRow}>
                          <PerfStat label="Load Factor" value={pct(lf)} color={lf > 0.7 ? "var(--color-success)" : "var(--color-warning)"} />
                          <PerfStat label="Pax" value={String(lastPerf.passengers)} />
                          <PerfStat label="Profitto" value={fmt(profit)} color={profit >= 0 ? "var(--color-success)" : "var(--color-danger)"} />
                        </div>
                      ) : (
                        <div style={s.noPerfNote}>Avanza il turno per vedere i dati.</div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {suspended.length > 0 && (
              <section style={s.section}>
                <div style={s.sectionTitle}>Sospese ({suspended.length})</div>
                {suspended.map(r => (
                  <div key={r.id} style={{ ...s.routeCard, opacity: 0.6 }}>
                    <div style={s.routeHeader}>
                      <div style={s.routeCode}>{r.originIata} → {r.destinationIata}</div>
                      <button
                        style={{ ...s.suspendBtn, color: "var(--color-success)", borderColor: "var(--color-success)" }}
                        onClick={() => dispatch({ type: "SET_ROUTE_STATUS", payload: { routeId: r.id, status: "active" } })}
                      >
                        Riattiva
                      </button>
                    </div>
                    <div style={s.routeMeta}>
                      <span>{r.weeklyFrequency}x/sett</span>
                      <span style={{ color: "var(--color-warning)" }}>Sospesa</span>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
        <div style={{ height: "var(--nav-height)" }} />
      </main>

      <nav style={s.nav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            style={{ ...s.navBtn, color: state.currentView === item.view ? "var(--color-accent)" : "var(--color-text-muted)" }}
            onClick={() => dispatch({ type: "SET_VIEW", payload: item.view })}
          >
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function PerfStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: color ?? "var(--color-text)" }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" },
  header: { height: "var(--header-height)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-page)", position: "sticky", top: 0, zIndex: 10 },
  headerTitle: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  addBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  main: { flex: 1, padding: "var(--space-4) var(--space-page)", display: "flex", flexDirection: "column", gap: "var(--space-4)", overflowY: "auto" },
  section: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  sectionTitle: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 },
  routeCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  routeHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  routeCode: { fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text)", letterSpacing: "0.04em" },
  suspendBtn: { fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text-muted)", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "2px 10px", cursor: "pointer" },
  routeMeta: { display: "flex", gap: "var(--space-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", flexWrap: "wrap" as const },
  perfRow: { display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-1)" },
  noPerfNote: { fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)", fontStyle: "italic" },
  emptyCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-6)", textAlign: "center" as const, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" },
  emptyTitle: { fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" },
  emptyText: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", maxWidth: 280 },
  ctaBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  nav: { height: "var(--nav-height)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", display: "flex", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
};
