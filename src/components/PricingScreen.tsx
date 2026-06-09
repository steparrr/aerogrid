import { useState } from "react";
import type { GameState, GameView, Route } from "../domain/types";
import { saveGame } from "../game/persistence";

interface Props {
  game: GameState;
  onNavigate: (view: GameView) => void;
  onUpdate: (next: GameState) => void;
}

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

type Strategy = "low" | "balanced" | "premium";

const STRATEGIES: { value: Strategy; label: string; desc: string; color: string }[] = [
  { value: "low",      label: "Low Cost",  desc: "Prezzi bassi, massimo volume, load factor alto",      color: "var(--color-warning)" },
  { value: "balanced", label: "Balanced",  desc: "Equilibrio tra volume e margine. Strategia raccomandata", color: "var(--color-accent)" },
  { value: "premium",  label: "Premium",   desc: "Prezzi alti, minore volume, margine massimo",          color: "var(--color-success)" },
];

const ECONOMY_YIELD_BASE = 0.10;  // $/km
const BUSINESS_YIELD_BASE = 0.28; // $/km

const STRATEGY_MULTIPLIERS: Record<Strategy, { eco: number; biz: number; loadFactor: number }> = {
  low:      { eco: 0.80, biz: 0.85, loadFactor: 0.88 },
  balanced: { eco: 1.00, biz: 1.00, loadFactor: 0.78 },
  premium:  { eco: 1.25, biz: 1.30, loadFactor: 0.64 },
};

function estimatePrice(distanceKm: number, cls: "economy" | "business", strategy: Strategy): number {
  const base = cls === "economy" ? ECONOMY_YIELD_BASE : BUSINESS_YIELD_BASE;
  const mult = STRATEGY_MULTIPLIERS[strategy][cls === "economy" ? "eco" : "biz"];
  // Short-haul premium per km
  const distFactor = distanceKm < 1000 ? 1.3 : distanceKm < 3000 ? 1.0 : 0.75;
  return Math.round(base * distanceKm * mult * distFactor);
}

function getRouteDistance(route: Route): number {
  // Distanza approssimativa basata sul tempo di volo se disponibile,
  // altrimenti stima placeholder. Verrà sostituita quando pricing.ts di Codex sarà pronto.
  const perf = route.performanceHistory.at(-1);
  if (perf && perf.availableSeatKm > 0) {
    const totalSeats = route.economySeats + route.businessSeats;
    return totalSeats > 0 ? Math.round(perf.availableSeatKm / totalSeats) : 2000;
  }
  return 2000; // placeholder
}

function avgLoadFactor(route: Route): number {
  if (!route.performanceHistory.length) return 0;
  const sum = route.performanceHistory.reduce((a, p) => a + p.loadFactor, 0);
  return sum / route.performanceHistory.length;
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }
function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function PricingScreen({ game, onNavigate, onUpdate }: Props) {
  const activeRoutes = game.routes.filter(r => r.status === "active");
  const [selectedId, setSelectedId] = useState<string | null>(activeRoutes[0]?.id ?? null);

  const selected = game.routes.find(r => r.id === selectedId) ?? null;
  const currentStrategy: Strategy = (selected as Route & { pricingStrategy?: Strategy })?.pricingStrategy ?? "balanced";

  function applyStrategy(strategy: Strategy) {
    if (!selected) return;
    const distKm = getRouteDistance(selected);
    const newEco = estimatePrice(distKm, "economy", strategy);
    const newBiz = estimatePrice(distKm, "business", strategy);
    const updatedRoutes = game.routes.map(r =>
      r.id === selected.id
        ? { ...r, economyPrice: newEco, businessPrice: newBiz, pricingStrategy: strategy }
        : r
    );
    const next: GameState = { ...game, routes: updatedRoutes };
    saveGame(next);
    onUpdate(next);
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerTitle}>Pricing</div>
        <div style={s.hubBadge}>{game.hubIata}</div>
      </header>

      <main style={s.main}>
        {activeRoutes.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={s.emptyIcon}>💸</div>
            <div style={s.emptyTitle}>Nessuna rotta attiva</div>
            <p style={s.emptyText}>Apri almeno una rotta per gestire i prezzi.</p>
            <button style={s.ctaBtn} onClick={() => onNavigate("planner")}>
              Vai al Planner →
            </button>
          </div>
        ) : (
          <>
            {/* Selezione rotta */}
            <section style={s.section}>
              <div style={s.sectionTitle}>Seleziona rotta</div>
              <div style={s.routeList}>
                {activeRoutes.map(r => (
                  <button
                    key={r.id}
                    style={{
                      ...s.routeBtn,
                      ...(selectedId === r.id ? s.routeBtnActive : {}),
                    }}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <span style={s.routeCode}>{r.originIata} → {r.destinationIata}</span>
                    <span style={s.routeMeta}>{r.weeklyFrequency}x/sett · LF {pct(avgLoadFactor(r))}</span>
                  </button>
                ))}
              </div>
            </section>

            {selected && (
              <>
                {/* Prezzi attuali */}
                <section style={s.section}>
                  <div style={s.sectionTitle}>Prezzi attuali</div>
                  <div style={s.priceGrid}>
                    <div style={s.priceCard}>
                      <div style={s.priceLabel}>Economy</div>
                      <div style={s.priceValue}>${selected.economyPrice}</div>
                      <div style={s.priceSub}>{selected.economySeats} posti</div>
                    </div>
                    <div style={s.priceCard}>
                      <div style={s.priceLabel}>Business</div>
                      <div style={s.priceValue}>${selected.businessPrice}</div>
                      <div style={s.priceSub}>{selected.businessSeats} posti</div>
                    </div>
                    <div style={s.priceCard}>
                      <div style={s.priceLabel}>Load Factor</div>
                      <div style={{ ...s.priceValue, color: avgLoadFactor(selected) > 0.75 ? "var(--color-success)" : "var(--color-warning)" }}>
                        {pct(avgLoadFactor(selected))}
                      </div>
                      <div style={s.priceSub}>medio storico</div>
                    </div>
                    <div style={s.priceCard}>
                      <div style={s.priceLabel}>Strategia</div>
                      <div style={{ ...s.priceValue, fontSize: "var(--font-size-base)", textTransform: "capitalize" as const }}>
                        {currentStrategy}
                      </div>
                      <div style={s.priceSub}>attiva</div>
                    </div>
                  </div>
                </section>

                {/* Scegli strategia */}
                <section style={s.section}>
                  <div style={s.sectionTitle}>Cambia strategia</div>
                  <div style={s.strategyList}>
                    {STRATEGIES.map(st => {
                      const distKm = getRouteDistance(selected);
                      const newEco = estimatePrice(distKm, "economy", st.value);
                      const newBiz = estimatePrice(distKm, "business", st.value);
                      const estLF  = STRATEGY_MULTIPLIERS[st.value].loadFactor;
                      const estPax = Math.round((selected.economySeats + selected.businessSeats) * estLF * selected.weeklyFrequency / 7);
                      const estRev = Math.round(estPax * newEco * 0.9 + (selected.businessSeats * estLF * newBiz));
                      const active = currentStrategy === st.value;

                      return (
                        <div
                          key={st.value}
                          style={{
                            ...s.stratCard,
                            borderColor: active ? st.color : "var(--color-border)",
                            background: active ? `rgba(${st.value === "low" ? "245,158,11" : st.value === "balanced" ? "56,189,248" : "34,197,94"},0.08)` : "var(--color-surface)",
                          }}
                        >
                          <div style={s.stratHeader}>
                            <span style={{ ...s.stratLabel, color: st.color }}>{st.label}</span>
                            {active && <span style={{ ...s.activeBadge, background: st.color }}>Attiva</span>}
                          </div>
                          <div style={s.stratDesc}>{st.desc}</div>
                          <div style={s.stratPreview}>
                            <span>Eco: <strong>${newEco}</strong></span>
                            <span>Biz: <strong>${newBiz}</strong></span>
                            <span>LF est.: <strong>{pct(estLF)}</strong></span>
                            <span>Rev/giorno: <strong>{fmt(estRev)}</strong></span>
                          </div>
                          {!active && (
                            <button
                              style={{ ...s.applyBtn, borderColor: st.color, color: st.color }}
                              onClick={() => applyStrategy(st.value)}
                            >
                              Applica
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Classi tariffarie */}
                <section style={s.section}>
                  <div style={s.sectionTitle}>Classi tariffarie (simulazione)</div>
                  <FareBucketTable strategy={currentStrategy} baseEco={selected.economyPrice} baseBiz={selected.businessPrice} />
                </section>
              </>
            )}
          </>
        )}
        <div style={{ height: "var(--nav-height)" }} />
      </main>

      <nav style={s.nav}>
        {NAV_ITEMS.map(item => {
          const active = game.currentView === item.view;
          return (
            <button
              key={item.view}
              style={{ ...s.navBtn, color: active ? "var(--color-accent)" : "var(--color-text-muted)" }}
              onClick={() => onNavigate(item.view)}
            >
              <span style={s.navIcon}>{item.icon}</span>
              <span style={s.navLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---- Tabella classi tariffarie ---- */
function FareBucketTable({ strategy, baseEco, baseBiz }: {
  strategy: Strategy; baseEco: number; baseBiz: number;
}) {
  const allocs: Record<Strategy, number[]> = {
    low:      [0.60, 0.30, 0.10],
    balanced: [0.30, 0.50, 0.20],
    premium:  [0.10, 0.40, 0.50],
  };
  const mult = allocs[strategy];

  const buckets = [
    { name: "Economy Saver",    price: Math.round(baseEco * 0.75), alloc: mult[0], eco: true },
    { name: "Economy Standard", price: baseEco,                    alloc: mult[1], eco: true },
    { name: "Economy Flex",     price: Math.round(baseEco * 1.35), alloc: mult[2], eco: true },
    { name: "Business Saver",   price: Math.round(baseBiz * 0.85), alloc: 0.40,   eco: false },
    { name: "Business Flex",    price: baseBiz,                    alloc: 0.60,   eco: false },
  ];

  return (
    <div style={s.bucketsTable}>
      <div style={s.bucketsHeader}>
        <span>Classe</span>
        <span>Prezzo</span>
        <span>% posti</span>
      </div>
      {buckets.map(b => (
        <div key={b.name} style={s.bucketRow}>
          <span style={{ color: b.eco ? "var(--color-text)" : "var(--color-accent)" }}>{b.name}</span>
          <span style={{ fontWeight: 600 }}>${b.price}</span>
          <span style={{ color: "var(--color-text-muted)" }}>{pct(b.alloc)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- Stili ---- */
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" },
  header: {
    height: "var(--header-height)", background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)", display: "flex",
    alignItems: "center", justifyContent: "space-between",
    padding: "0 var(--space-page)", position: "sticky", top: 0, zIndex: 10,
  },
  headerTitle: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  hubBadge: {
    background: "var(--color-accent-dim)", color: "var(--color-accent)",
    border: "1px solid var(--color-accent)", borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 10px",
  },
  main: { flex: 1, padding: "var(--space-4) var(--space-page)", display: "flex", flexDirection: "column", gap: "var(--space-4)", overflowY: "auto" },
  section: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  sectionTitle: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 },
  routeList: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  routeBtn: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    cursor: "pointer", textAlign: "left" as const,
  },
  routeBtnActive: { borderColor: "var(--color-accent)", background: "var(--color-accent-dim)" },
  routeCode: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.03em" },
  routeMeta: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" },
  priceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" },
  priceCard: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)",
    display: "flex", flexDirection: "column", gap: 2,
  },
  priceLabel: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 },
  priceValue: { fontSize: "var(--font-size-xl)", fontWeight: 700, color: "var(--color-text)" },
  priceSub: { fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)" },
  strategyList: { display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  stratCard: {
    border: "1px solid", borderRadius: "var(--radius-md)",
    padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)",
  },
  stratHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  stratLabel: { fontSize: "var(--font-size-base)", fontWeight: 700 },
  activeBadge: {
    fontSize: "var(--font-size-xs)", fontWeight: 700, color: "#0b1622",
    borderRadius: "var(--radius-full)", padding: "2px 8px",
  },
  stratDesc: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" },
  stratPreview: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-1) var(--space-4)",
    fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)",
  },
  applyBtn: {
    background: "transparent", border: "1px solid", borderRadius: "var(--radius-sm)",
    padding: "var(--space-2) var(--space-4)", fontSize: "var(--font-size-sm)",
    fontWeight: 600, cursor: "pointer", marginTop: "var(--space-1)", alignSelf: "flex-start",
  },
  bucketsTable: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", overflow: "hidden",
  },
  bucketsHeader: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
    padding: "var(--space-2) var(--space-4)",
    background: "var(--color-surface-2)",
    fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)",
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
  },
  bucketRow: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
    padding: "var(--space-3) var(--space-4)",
    borderTop: "1px solid var(--color-border)",
    fontSize: "var(--font-size-sm)", color: "var(--color-text)",
    alignItems: "center",
  },
  emptyCard: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-6)",
    textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)",
  },
  emptyIcon: { fontSize: "2.5rem" },
  emptyTitle: { fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" },
  emptyText: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", maxWidth: 280 },
  ctaBtn: {
    background: "var(--color-accent)", color: "#0b1622", fontWeight: 700,
    fontSize: "var(--font-size-sm)", padding: "var(--space-3) var(--space-6)",
    borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", marginTop: "var(--space-2)",
  },
  nav: {
    height: "var(--nav-height)", background: "var(--color-surface)",
    borderTop: "1px solid var(--color-border)", display: "flex",
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
  },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
  navIcon: { fontSize: "1.25rem", lineHeight: 1 },
  navLabel: { fontSize: "var(--font-size-xs)", fontWeight: 500 },
};
