import { useState } from "react";
import { useGame } from "../game/gameContext";
import { aircraftModelById } from "../data/indexes";
import { WorldMap } from "./WorldMap";
import type { GameView, Route } from "../domain/types";

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

const DAYS_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ── Mini route chip (collapsed state) ────────────────────────────────────────
function RouteChip({ route, onClick }: { route: Route; onClick: () => void }) {
  const { state } = useGame();
  const ac    = state?.fleet.find(a => a.id === route.aircraftId);
  const model = ac ? aircraftModelById.get(ac.modelId) : null;
  const last  = route.performanceHistory.at(-1);
  const profit = last?.profit ?? 0;

  return (
    <button onClick={onClick} style={chip.btn}>
      <div style={chip.code}>{route.originIata}<span style={chip.arrow}>→</span>{route.destinationIata}</div>
      {model && <div style={chip.model}>{model.name}</div>}
      {last && (
        <div style={{ ...chip.profit, color: profit >= 0 ? "#22c55e" : "#f87171" }}>
          {fmt(profit)}
        </div>
      )}
    </button>
  );
}

// ── Full route card (expanded state) ─────────────────────────────────────────
function RouteCard({ route, onClose }: { route: Route; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    ecoPrice: route.economyPrice,
    bizPrice: route.businessPrice,
    frequency: route.weeklyFrequency,
    operatingDays: [...route.operatingDays],
  });

  const ac    = state?.fleet.find(a => a.id === route.aircraftId);
  const model = ac ? aircraftModelById.get(ac.modelId) : null;
  const last  = route.performanceHistory.at(-1);
  const profit = last?.profit ?? 0;
  const lf     = last?.loadFactor ?? 0;

  function toggleDay(d: number) {
    setEdit(p => ({
      ...p,
      operatingDays: p.operatingDays.includes(d)
        ? p.operatingDays.filter(x => x !== d)
        : [...p.operatingDays, d].sort(),
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
    <div style={card.wrap}>
      {/* Route header */}
      <div style={card.header}>
        <div style={card.code}>{route.originIata} → {route.destinationIata}</div>
        <div style={card.actions}>
          <button style={{ ...card.iconBtn, color: editing ? "#38bdf8" : "#5a82a8" }}
            onClick={() => setEditing(!editing)}>✏</button>
          <button style={{ ...card.statusBtn,
            color: route.status === "active" ? "#5a82a8" : "#22c55e",
            borderColor: route.status === "active" ? "#243650" : "#22c55e" }}
            onClick={() => dispatch({ type: "SET_ROUTE_STATUS", payload: { routeId: route.id, status: route.status === "active" ? "suspended" : "active" } })}>
            {route.status === "active" ? "Sospendi" : "Riattiva"}
          </button>
          <button style={card.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Meta */}
      <div style={card.meta}>
        {model && <span>{model.manufacturer} {model.name}</span>}
        <span>{route.weeklyFrequency}x/sett</span>
        <span>Eco ${route.economyPrice} · Biz ${route.businessPrice}</span>
      </div>

      {/* Stats */}
      {last ? (
        <div style={card.stats}>
          <Stat label="Load" value={pct(lf)} color={lf > 0.7 ? "#22c55e" : "#f59e0b"} />
          <Stat label="Pax"  value={String(last.passengers)} />
          <Stat label="Profitto" value={fmt(profit)} color={profit >= 0 ? "#22c55e" : "#f87171"} />
          <Stat label="Rev."  value={fmt(last.revenue)} />
        </div>
      ) : (
        <div style={card.noPerf}>Avanza il turno per vedere i dati operativi.</div>
      )}

      {/* Edit panel */}
      {editing && (
        <div style={card.editWrap}>
          <div style={card.editTitle}>MODIFICA ROTTA</div>

          <div style={card.editRow}>
            <EditField label="Economy ($)" value={edit.ecoPrice}
              onChange={v => setEdit(p => ({ ...p, ecoPrice: v }))} />
            <EditField label="Business ($)" value={edit.bizPrice}
              onChange={v => setEdit(p => ({ ...p, bizPrice: v }))} />
          </div>

          <div>
            <div style={card.editLabel}>Frequenza</div>
            <div style={card.freqRow}>
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} style={{
                  ...card.freqBtn,
                  background: edit.frequency === n ? "#38bdf8" : "#0f2035",
                  color: edit.frequency === n ? "#071020" : "#5a82a8",
                }} onClick={() => setEdit(p => ({ ...p, frequency: n }))}>
                  {n}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={card.editLabel}>Giorni operativi</div>
            <div style={card.daysRow}>
              {DAYS_LABELS.map((d, i) => (
                <button key={i} style={{
                  ...card.dayBtn,
                  background: edit.operatingDays.includes(i+1) ? "#38bdf8" : "#0f2035",
                  color: edit.operatingDays.includes(i+1) ? "#071020" : "#5a82a8",
                }} onClick={() => toggleDay(i+1)}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={card.editBtns}>
            <button style={card.cancelBtn} onClick={() => setEditing(false)}>Annulla</button>
            <button style={card.saveBtn} onClick={handleSave}>Salva</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function RoutesScreen() {
  const { state, dispatch } = useGame();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!state) return null;

  const active    = state.routes.filter(r => r.status === "active");
  const suspended = state.routes.filter(r => r.status === "suspended");
  const allRoutes = [...active, ...suspended];
  const expandedRoute = allRoutes.find(r => r.id === expandedId) ?? null;

  function handleChipClick(id: string) {
    setExpandedId(id);
    setSheetOpen(true);
  }

  // Bottom sheet height: expanded = 65vh, collapsed = chip row height (~80px) + handle
  const NAV_H = 56; // px, roughly --nav-height

  return (
    <div style={{ position: "relative", height: "100dvh", overflow: "hidden", background: "#071020" }}>

      {/* ── Full-screen map ─────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, bottom: NAV_H }}>
        <WorldMap
          routes={state.routes}
          fillParent
        />
      </div>

      {/* Empty state overlay when no routes */}
      {allRoutes.length === 0 && (
        <div style={empty.overlay}>
          <div style={empty.icon}>🗺</div>
          <div style={empty.title}>Nessuna rotta aperta</div>
          <p style={empty.text}>Crea la prima rotta dal Route Planner.</p>
          <button style={empty.btn} onClick={() => dispatch({ type: "SET_VIEW", payload: "planner" })}>
            + Apri una rotta
          </button>
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────────── */}
      {allRoutes.length > 0 && (
        <div style={{
          ...sheet.wrap,
          bottom: NAV_H,
          height: sheetOpen ? "65vh" : "auto",
          maxHeight: "75vh",
        }}>
          {/* Drag handle + header row */}
          <button style={sheet.handleArea} onClick={() => {
            if (sheetOpen) { setSheetOpen(false); setExpandedId(null); }
            else setSheetOpen(true);
          }}>
            <div style={sheet.handle} />
            <div style={sheet.sheetTitle}>
              <span style={sheet.titleText}>
                {allRoutes.length} {allRoutes.length === 1 ? "rotta" : "rotte"}
                {active.length > 0 && <span style={sheet.activeBadge}> {active.length} attive</span>}
              </span>
              <span style={sheet.chevron}>{sheetOpen ? "▼" : "▲"}</span>
            </div>
          </button>

          {/* Content */}
          {!sheetOpen ? (
            /* Collapsed: horizontal chip scroll */
            <div style={sheet.chipRow}>
              {allRoutes.map(r => (
                <RouteChip key={r.id} route={r} onClick={() => handleChipClick(r.id)} />
              ))}
              <button style={sheet.newChip} onClick={() => dispatch({ type: "SET_VIEW", payload: "planner" })}>
                + Nuova
              </button>
            </div>
          ) : (
            /* Expanded: full route list or expanded card */
            <div style={sheet.scrollArea}>
              {expandedRoute ? (
                <RouteCard route={expandedRoute} onClose={() => setExpandedId(null)} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {active.length > 0 && (
                    <>
                      <div style={sheet.groupLabel}>ATTIVE</div>
                      {active.map(r => <RouteRow key={r.id} route={r} onClick={() => setExpandedId(r.id)} />)}
                    </>
                  )}
                  {suspended.length > 0 && (
                    <>
                      <div style={sheet.groupLabel}>SOSPESE</div>
                      {suspended.map(r => <RouteRow key={r.id} route={r} onClick={() => setExpandedId(r.id)} />)}
                    </>
                  )}
                  <button style={sheet.addRouteBtn}
                    onClick={() => dispatch({ type: "SET_VIEW", payload: "planner" })}>
                    + Nuova rotta
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
      <nav style={nav.bar}>
        {NAV_ITEMS.map(item => (
          <button key={item.view}
            style={{ ...nav.btn, color: state.currentView === item.view ? "#38bdf8" : "#3a5a7a" }}
            onClick={() => dispatch({ type: "SET_VIEW", payload: item.view })}>
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: "10px", fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── RouteRow (list item in expanded sheet, before drilling in) ────────────────
function RouteRow({ route, onClick }: { route: Route; onClick: () => void }) {
  const { state } = useGame();
  const ac    = state?.fleet.find(a => a.id === route.aircraftId);
  const model = ac ? aircraftModelById.get(ac.modelId) : null;
  const last  = route.performanceHistory.at(-1);
  const profit = last?.profit ?? 0;

  return (
    <button onClick={onClick} style={row.btn}>
      <div style={row.left}>
        <span style={row.code}>{route.originIata} → {route.destinationIata}</span>
        <span style={row.meta}>{model?.name ?? "—"} · {route.weeklyFrequency}x/sett</span>
      </div>
      <div style={row.right}>
        {last && (
          <span style={{ ...row.profit, color: profit >= 0 ? "#22c55e" : "#f87171" }}>{fmt(profit)}</span>
        )}
        <span style={row.lf}>{last ? pct(last.loadFactor) : "—"}</span>
        <span style={row.arrow}>›</span>
      </div>
    </button>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9, color: "#3a5a7a", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color ?? "#c8dff0" }}>{value}</span>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, color: "#3a5a7a", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</label>
      <input
        type="number" min={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ background: "#0a1c30", border: "1px solid #1a3050", borderRadius: 8,
          color: "#c8dff0", padding: "8px 10px", fontSize: 14, outline: "none", width: "100%",
          boxSizing: "border-box" as const }} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sheet: Record<string, React.CSSProperties> = {
  wrap: {
    position: "absolute", left: 0, right: 0,
    background: "rgba(7,16,32,0.97)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid rgba(56,189,248,0.15)",
    borderRadius: "16px 16px 0 0",
    display: "flex", flexDirection: "column",
    transition: "height 0.25s ease",
    zIndex: 20,
    overflow: "hidden",
  },
  handleArea: {
    background: "none", border: "none", cursor: "pointer",
    padding: "10px 16px 8px",
    display: "flex", flexDirection: "column", gap: 6,
    alignItems: "center",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: "rgba(56,189,248,0.25)",
  },
  sheetTitle: {
    width: "100%", display: "flex", justifyContent: "space-between",
    alignItems: "center",
  },
  titleText: {
    fontSize: 13, fontWeight: 600, color: "#c8dff0",
  },
  activeBadge: {
    color: "#22c55e", fontWeight: 700,
  },
  chevron: {
    fontSize: 10, color: "#3a5a7a",
  },
  chipRow: {
    display: "flex", gap: 8,
    overflowX: "auto" as const,
    padding: "4px 16px 14px",
    scrollbarWidth: "none" as const,
  },
  scrollArea: {
    overflowY: "auto" as const,
    flex: 1,
    scrollbarWidth: "none" as const,
  },
  groupLabel: {
    fontSize: 9, color: "#2a4a6a", letterSpacing: "0.08em",
    fontWeight: 700, padding: "8px 16px 4px",
  },
  addRouteBtn: {
    margin: "12px 16px 8px",
    background: "rgba(56,189,248,0.08)",
    border: "1px dashed rgba(56,189,248,0.3)",
    borderRadius: 10, color: "#38bdf8",
    fontSize: 13, fontWeight: 600,
    padding: "12px", cursor: "pointer",
    width: "calc(100% - 32px)",
  },
  newChip: {
    flexShrink: 0,
    background: "rgba(56,189,248,0.08)",
    border: "1px dashed rgba(56,189,248,0.3)",
    borderRadius: 12, color: "#38bdf8",
    fontSize: 12, fontWeight: 600,
    padding: "8px 16px", cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};

const chip: Record<string, React.CSSProperties> = {
  btn: {
    flexShrink: 0,
    background: "rgba(22,44,70,0.9)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 12,
    padding: "8px 14px",
    cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
    minWidth: 90,
  },
  code: { fontSize: 13, fontWeight: 700, color: "#c8dff0" },
  arrow: { color: "#38bdf8", margin: "0 2px" },
  model: { fontSize: 10, color: "#3a5a7a" },
  profit: { fontSize: 12, fontWeight: 700 },
};

const row: Record<string, React.CSSProperties> = {
  btn: {
    width: "100%", display: "flex", justifyContent: "space-between",
    alignItems: "center",
    background: "none", border: "none",
    borderBottom: "1px solid rgba(56,189,248,0.07)",
    padding: "12px 16px", cursor: "pointer",
  },
  left: { display: "flex", flexDirection: "column", gap: 2, textAlign: "left" as const },
  code: { fontSize: 14, fontWeight: 700, color: "#c8dff0" },
  meta: { fontSize: 10, color: "#3a5a7a" },
  right: { display: "flex", alignItems: "center", gap: 12 },
  profit: { fontSize: 13, fontWeight: 700 },
  lf:     { fontSize: 11, color: "#5a82a8" },
  arrow:  { fontSize: 16, color: "#2a4a6a" },
};

const card: Record<string, React.CSSProperties> = {
  wrap: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 18, fontWeight: 800, color: "#c8dff0", letterSpacing: "0.03em" },
  actions: { display: "flex", gap: 6, alignItems: "center" },
  iconBtn: { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", padding: "2px 6px" },
  statusBtn: { fontSize: 10, fontWeight: 700, background: "none", border: "1px solid",
    borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: "#5a82a8" },
  closeBtn: { background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", fontSize: "0.9rem", padding: "2px 6px" },
  meta: { display: "flex", gap: 10, fontSize: 10, color: "#3a5a7a", flexWrap: "wrap" as const },
  stats: { display: "flex", gap: 18, paddingTop: 2 },
  noPerf: { fontSize: 10, color: "#2a4060", fontStyle: "italic" },
  editWrap: { borderTop: "1px solid rgba(56,189,248,0.1)", paddingTop: 14,
    display: "flex", flexDirection: "column", gap: 14 },
  editTitle: { fontSize: 9, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.07em" },
  editLabel: { fontSize: 9, color: "#3a5a7a", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 4 },
  editRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  freqRow: { display: "flex", gap: 4 },
  freqBtn: { flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" },
  daysRow: { display: "flex", gap: 4 },
  dayBtn: { flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer" },
  editBtns: { display: "flex", gap: 8, justifyContent: "flex-end" as const },
  cancelBtn: { background: "none", border: "1px solid #1a3050", borderRadius: 8,
    color: "#5a82a8", padding: "6px 16px", fontSize: 12, cursor: "pointer" },
  saveBtn: { background: "#38bdf8", color: "#071020", fontWeight: 700, border: "none",
    borderRadius: 8, padding: "6px 20px", fontSize: 12, cursor: "pointer" },
};

const empty: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 12, zIndex: 10,
    pointerEvents: "none",
  },
  icon: { fontSize: "3rem" },
  title: { fontSize: 18, fontWeight: 700, color: "#c8dff0" },
  text: { fontSize: 13, color: "#3a5a7a", maxWidth: 260, textAlign: "center" as const },
  btn: {
    pointerEvents: "all",
    background: "#38bdf8", color: "#071020",
    fontWeight: 700, fontSize: 14,
    padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
    marginTop: 8,
  },
};

const nav: Record<string, React.CSSProperties> = {
  bar: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    height: 56,
    background: "rgba(7,16,32,0.97)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid rgba(56,189,248,0.1)",
    display: "flex", zIndex: 30,
  },
  btn: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 2,
    background: "none", border: "none", cursor: "pointer",
    transition: "color 0.15s",
  },
};
