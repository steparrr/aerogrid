import { useState } from "react";
import { useGame } from "../game/gameContext";
import { aircraftModelById } from "../data/indexes";
import type { GameView, Route } from "../domain/types";

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

const DAYS_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface EditState {
  ecoPrice: number;
  bizPrice: number;
  frequency: number;
  operatingDays: number[];
}

function RouteCard({ route }: { route: Route }) {
  const { state, dispatch } = useGame();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    ecoPrice: route.economyPrice,
    bizPrice: route.businessPrice,
    frequency: route.weeklyFrequency,
    operatingDays: [...route.operatingDays],
  });

  const ac = state?.fleet.find(a => a.id === route.aircraftId);
  const model = ac ? aircraftModelById.get(ac.modelId) : null;
  const lastPerf = route.performanceHistory.at(-1);
  const profit = lastPerf?.profit ?? 0;
  const lf = lastPerf?.loadFactor ?? 0;

  function toggleDay(d: number) {
    setEdit(prev => ({
      ...prev,
      operatingDays: prev.operatingDays.includes(d)
        ? prev.operatingDays.filter(x => x !== d)
        : [...prev.operatingDays, d].sort(),
    }));
  }

  function handleSave() {
    if (edit.operatingDays.length === 0) return;
    dispatch({
      type: "UPDATE_ROUTE",
      payload: {
        routeId: route.id,
        economyPrice: edit.ecoPrice,
        businessPrice: edit.bizPrice,
        weeklyFrequency: edit.frequency as 1|2|3|4|5|6|7,
        operatingDays: edit.operatingDays,
      },
    });
    setEditing(false);
  }

  return (
    <div style={s.routeCard}>
      {/* Header */}
      <div style={s.routeHeader}>
        <div style={s.routeCode}>{route.originIata} → {route.destinationIata}</div>
        <div style={s.headerActions}>
          <button
            style={{ ...s.iconBtn, color: editing ? "var(--color-accent)" : "var(--color-text-muted)" }}
            onClick={() => { setEditing(!editing); setEdit({ ecoPrice: route.economyPrice, bizPrice: route.businessPrice, frequency: route.weeklyFrequency, operatingDays: [...route.operatingDays] }); }}
          >
            ✏
          </button>
          <button
            style={{
              ...s.statusBtn,
              color: route.status === "active" ? "var(--color-text-muted)" : "var(--color-success)",
              borderColor: route.status === "active" ? "var(--color-border)" : "var(--color-success)",
            }}
            onClick={() => dispatch({ type: "SET_ROUTE_STATUS", payload: { routeId: route.id, status: route.status === "active" ? "suspended" : "active" } })}
          >
            {route.status === "active" ? "Sospendi" : "Riattiva"}
          </button>
        </div>
      </div>

      {/* Info base */}
      <div style={s.routeMeta}>
        {model && <span>{model.manufacturer} {model.name}</span>}
        <span>{route.weeklyFrequency}x/sett</span>
        <span>Eco ${route.economyPrice} · Biz ${route.businessPrice}</span>
      </div>

      {/* Performance */}
      {lastPerf ? (
        <div style={s.perfRow}>
          <PerfStat label="Load Factor" value={pct(lf)} color={lf > 0.7 ? "var(--color-success)" : "var(--color-warning)"} />
          <PerfStat label="Pax" value={String(lastPerf.passengers)} />
          <PerfStat label="Profitto" value={fmt(profit)} color={profit >= 0 ? "var(--color-success)" : "var(--color-danger)"} />
        </div>
      ) : (
        <div style={s.noPerfNote}>Avanza il turno per vedere i dati.</div>
      )}

      {/* Pannello modifica */}
      {editing && (
        <div style={s.editPanel}>
          <div style={s.editTitle}>Modifica rotta</div>

          {/* Prezzi */}
          <div style={s.editRow}>
            <div style={s.editField}>
              <label style={s.editLabel}>Prezzo Economy ($)</label>
              <input
                style={s.editInput}
                type="number"
                min={1}
                value={edit.ecoPrice}
                onChange={e => setEdit(p => ({ ...p, ecoPrice: Number(e.target.value) }))}
              />
            </div>
            <div style={s.editField}>
              <label style={s.editLabel}>Prezzo Business ($)</label>
              <input
                style={s.editInput}
                type="number"
                min={1}
                value={edit.bizPrice}
                onChange={e => setEdit(p => ({ ...p, bizPrice: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Frequenza */}
          <div style={s.editField}>
            <label style={s.editLabel}>Frequenza settimanale</label>
            <div style={s.freqRow}>
              {[1,2,3,4,5,6,7].map(n => (
                <button
                  key={n}
                  style={{
                    ...s.freqBtn,
                    background: edit.frequency === n ? "var(--color-accent)" : "var(--color-surface-3)",
                    color: edit.frequency === n ? "#0b1622" : "var(--color-text-muted)",
                  }}
                  onClick={() => setEdit(p => ({ ...p, frequency: n }))}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          {/* Giorni */}
          <div style={s.editField}>
            <label style={s.editLabel}>Giorni operativi</label>
            <div style={s.daysRow}>
              {DAYS_LABELS.map((d, i) => (
                <button
                  key={i}
                  style={{
                    ...s.dayBtn,
                    background: edit.operatingDays.includes(i + 1) ? "var(--color-accent)" : "var(--color-surface-3)",
                    color: edit.operatingDays.includes(i + 1) ? "#0b1622" : "var(--color-text-muted)",
                  }}
                  onClick={() => toggleDay(i + 1)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Azioni */}
          <div style={s.editActions}>
            <button style={s.cancelBtn} onClick={() => setEditing(false)}>Annulla</button>
            <button style={s.saveBtn} onClick={handleSave}>Salva modifiche</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
                {active.map(r => <RouteCard key={r.id} route={r} />)}
              </section>
            )}
            {suspended.length > 0 && (
              <section style={s.section}>
                <div style={s.sectionTitle}>Sospese ({suspended.length})</div>
                {suspended.map(r => <RouteCard key={r.id} route={r} />)}
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
  headerActions: { display: "flex", gap: "var(--space-2)", alignItems: "center" },
  iconBtn: { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", padding: "2px 6px" },
  statusBtn: { fontSize: "var(--font-size-xs)", fontWeight: 600, background: "none", border: "1px solid", borderRadius: "var(--radius-sm)", padding: "2px 10px", cursor: "pointer" },
  routeMeta: { display: "flex", gap: "var(--space-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", flexWrap: "wrap" as const },
  perfRow: { display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-1)" },
  noPerfNote: { fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)", fontStyle: "italic" },
  editPanel: { borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-2)" },
  editTitle: { fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-accent)", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  editRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" },
  editField: { display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  editLabel: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  editInput: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--font-size-base)", outline: "none", width: "100%" },
  freqRow: { display: "flex", gap: "var(--space-1)" },
  freqBtn: { flex: 1, padding: "var(--space-2) 0", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", fontWeight: 700, border: "none", cursor: "pointer" },
  daysRow: { display: "flex", gap: "var(--space-1)" },
  dayBtn: { flex: 1, padding: "var(--space-2) 0", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", fontWeight: 600, border: "none", cursor: "pointer" },
  editActions: { display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" as const },
  cancelBtn: { background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-muted)", padding: "var(--space-2) var(--space-4)", fontSize: "var(--font-size-sm)", cursor: "pointer" },
  saveBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, border: "none", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-5)", fontSize: "var(--font-size-sm)", cursor: "pointer" },
  emptyCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-6)", textAlign: "center" as const, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" },
  emptyTitle: { fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" },
  emptyText: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", maxWidth: 280 },
  ctaBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  nav: { height: "var(--nav-height)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", display: "flex", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
};
