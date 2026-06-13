import { useState } from "react";
import { useGame } from "../game/gameContext";
import { aircraftModels } from "../data/aircraftModels";
import { aircraftModelById } from "../data/indexes";
import type { GameView } from "../domain/types";

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

const PASSENGER_MODELS = aircraftModels.filter(m => m.role === "passenger");

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

type Tab = "fleet" | "market";
type AcqMode = "leased" | "owned" | "acmi";

const ACMI_RATE_PER_HOUR = 9_000;

function fleetDiscount(qty: number, mode: AcqMode): number {
  if (qty <= 1 || mode === "acmi") return 0;
  const tiers = mode === "owned"
    ? [[2,3,0.03],[4,6,0.06],[7,10,0.10],[11,20,0.15],[21,50,0.20]] as const
    : [[2,3,0.02],[4,6,0.04],[7,10,0.07],[11,20,0.10],[21,50,0.13]] as const;
  for (const [lo, hi, pct] of tiers) if (qty >= lo && qty <= hi) return pct;
  return 0;
}

export function FleetScreen() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>("fleet");
  const [acquiring, setAcquiring] = useState<string | null>(null);
  const [acqMode, setAcqMode] = useState<AcqMode>("leased");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (!state) return null;

  function unitCost(model: typeof aircraftModels[number], qty: number): number {
    const discount = fleetDiscount(qty, acqMode);
    if (acqMode === "owned") return Math.round(model.purchasePrice * (1 - discount));
    if (acqMode === "acmi") return ACMI_RATE_PER_HOUR * 100;
    return Math.round(model.monthlyLease * 3 * (1 - discount));
  }

  function handleAcquire(modelId: string) {
    if (!state) return;
    const model = aircraftModelById.get(modelId);
    if (!model) return;
    const qty = quantities[modelId] ?? 1;
    const total = unitCost(model, qty) * qty;
    if (state.cash < total) return;
    setAcquiring(modelId);
    setTimeout(() => {
      const acquisitionType = acqMode === "acmi" ? "acmi" : acqMode;
      for (let i = 0; i < qty; i++) {
        dispatch({ type: "ACQUIRE_AIRCRAFT", payload: { modelId, acquisitionType } });
      }
      setAcquiring(null);
      setTab("fleet");
    }, 400);
  }

  const utilRate = (h: number) => Math.min(1, h / 16);
  const utilColor = (h: number) => {
    const r = utilRate(h);
    if (r > 0.85) return "var(--color-danger)";
    if (r > 0.60) return "var(--color-success)";
    return "var(--color-text-muted)";
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })}>←</button>
        <div style={s.headerTitle}>Flotta</div>
        <div style={s.headerRight}>
          <span style={s.cashBadge}>{fmt(state.cash)}</span>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === "fleet" ? s.tabActive : {}) }} onClick={() => setTab("fleet")}>
            La mia flotta <span style={s.tabCount}>{state.fleet.length}</span>
          </button>
          <button style={{ ...s.tab, ...(tab === "market" ? s.tabActive : {}) }} onClick={() => setTab("market")}>
            Mercato
          </button>
        </div>

        {/* --- LA MIA FLOTTA --- */}
        {tab === "fleet" && (
          state.fleet.length === 0
            ? <EmptyFleet onGoMarket={() => setTab("market")} />
            : <div style={s.list}>
                {state.fleet.map(ac => {
                  const model = aircraftModelById.get(ac.modelId);
                  if (!model) return null;
                  return (
                    <div key={ac.id} style={s.card}>
                      <div style={s.cardHeader}>
                        <div>
                          <div style={s.modelName}>{model.manufacturer} {model.name}</div>
                          <div style={s.modelFamily}>{model.family} · {ac.acquisitionType === "leased" ? "Dry Lease" : ac.acquisitionType === "acmi" ? "ACMI" : ac.acquisitionType === "sale_leaseback" ? "Sale-Leaseback" : "Proprietà"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          {ac.registration && (
                            <div style={s.regBadge}>{ac.registration}</div>
                          )}
                          <div style={s.cardBadge}>{model.economyCapacity + model.businessCapacity} pax</div>
                        </div>
                      </div>

                      <div style={s.statsGrid}>
                        <Stat label="Range" value={`${model.rangeKm.toLocaleString("it-IT")} km`} />
                        <Stat label="Velocità" value={`${model.cruiseSpeedKmh} km/h`} />
                        <Stat label="Leasing/mese" value={fmt(model.monthlyLease)} />
                        <Stat label="Affidabilità" value={`${(ac.reliability * 100).toFixed(0)}%`} />
                      </div>

                      <div style={s.utilBar}>
                        <div style={s.utilLabel}>
                          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>Utilizzo</span>
                          <span style={{ color: utilColor(ac.utilizationHoursPerDay), fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                            {ac.utilizationHoursPerDay.toFixed(1)}h/giorno
                          </span>
                        </div>
                        <div style={s.utilTrack}>
                          <div style={{
                            ...s.utilFill,
                            width: `${utilRate(ac.utilizationHoursPerDay) * 100}%`,
                            background: utilColor(ac.utilizationHoursPerDay),
                          }} />
                        </div>
                      </div>

                      {ac.assignedRouteIds.length > 0 && (
                        <div style={s.routeTag}>
                          {ac.assignedRouteIds.length} rotta/e assegnata/e
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        )}

        {/* --- MERCATO --- */}
        {tab === "market" && (
          <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" as const, maxWidth: 400 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✈</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>Catalogo Aerei Completo</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 20 }}>
                70+ modelli · Narrowbody, Widebody, Regional, Turboprop<br/>
                CO₂/RPK · CASK · $/seat/h · Confronto fino a 6 aerei · Filtri avanzati
              </div>
              <button
                onClick={() => dispatch({ type: "SET_VIEW", payload: "aircraft-catalog" })}
                style={{ background: "var(--color-accent)", color: "#0A1220", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 14, fontWeight: 800, cursor: "pointer", width: "100%" }}>
                Apri Catalogo Aerei →
              </button>
            </div>
            <div style={{ width: "100%", maxWidth: 400, background: "var(--color-surface)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 10, fontWeight: 700, letterSpacing: "0.08em" }}>ACQUISTO RAPIDO</div>
            {/* Toggle Leasing / Acquisto / ACMI */}
            <div style={s.acqToggle}>
              <button
                style={{ ...s.acqBtn, ...(acqMode === "leased" ? s.acqBtnActive : {}) }}
                onClick={() => setAcqMode("leased")}
              >
                Dry Lease
              </button>
              <button
                style={{ ...s.acqBtn, ...(acqMode === "owned" ? s.acqBtnActive : {}) }}
                onClick={() => setAcqMode("owned")}
              >
                Acquisto
              </button>
              <button
                style={{ ...s.acqBtn, ...(acqMode === "acmi" ? s.acqBtnActive : {}) }}
                onClick={() => setAcqMode("acmi")}
              >
                ACMI
              </button>
            </div>

            <div style={s.marketNote}>
              {acqMode === "leased"
                ? "Dry Lease: deposito 3 mesi, poi canone mensile. Solo l'aereo — crew e manutenzione a tuo carico."
                : acqMode === "owned"
                  ? "Acquisto: pagamento immediato, nessun canone mensile. Puoi fare sale-leaseback in seguito."
                  : `ACMI (wet lease): ${fmt(ACMI_RATE_PER_HOUR)}/h tutto incluso — crew, manutenzione, assicurazione. Solo il carburante è a tuo carico. Deposito 100h.`}
            </div>

            {PASSENGER_MODELS.map(model => {
              const qty = quantities[model.id] ?? 1;
              const discount = fleetDiscount(qty, acqMode);
              const perUnit = unitCost(model, qty);
              const total = perUnit * qty;
              const canAfford = state.cash >= total;
              const btnColor = acqMode === "owned"
                ? "var(--color-success)"
                : acqMode === "acmi"
                  ? "var(--color-warning)"
                  : "var(--color-accent)";
              const setQty = (n: number) => setQuantities(prev => ({ ...prev, [model.id]: Math.max(1, Math.min(50, n)) }));
              return (
                <div key={model.id} style={s.card}>
                  <div style={s.cardHeader}>
                    <div>
                      <div style={s.modelName}>{model.manufacturer} {model.name}</div>
                      <div style={s.modelFamily}>{model.family} · {model.rangeKm.toLocaleString("it-IT")} km</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      {acqMode === "leased" && (
                        <>
                          <div style={s.leasePrice}>{fmt(model.monthlyLease)}/mese</div>
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>dep. {fmt(Math.round(model.monthlyLease * 3))}</div>
                        </>
                      )}
                      {acqMode === "owned" && (
                        <div style={{ ...s.leasePrice, color: "var(--color-success)" }}>{fmt(model.purchasePrice)}</div>
                      )}
                      {acqMode === "acmi" && (
                        <>
                          <div style={{ ...s.leasePrice, color: "var(--color-warning)" }}>{fmt(ACMI_RATE_PER_HOUR)}/h</div>
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>dep. {fmt(ACMI_RATE_PER_HOUR * 100)}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={s.statsGrid}>
                    <Stat label="Economy" value={`${model.economyCapacity} pax`} />
                    <Stat label="Business" value={`${model.businessCapacity} pax`} />
                    <Stat label="Velocità" value={`${model.cruiseSpeedKmh} km/h`} />
                    <Stat label="Pista min." value={`${model.runwayRequirementM} m`} />
                    <Stat label="Carburante" value={`${model.fuelBurnKgPerHour} kg/h`} />
                    <Stat label="Manutenzione" value={`${fmt(model.maintenancePerHour)}/h`} />
                  </div>

                  {/* Contatore quantità */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 4px", padding: "8px 10px", background: "var(--color-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setQty(qty - 1)} style={s.qtyBtn}>−</button>
                      <span style={{ fontSize: 16, fontWeight: 800, minWidth: 24, textAlign: "center" as const, color: "var(--color-text)" }}>{qty}</span>
                      <button onClick={() => setQty(qty + 1)} style={s.qtyBtn}>+</button>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      {discount > 0 && (
                        <div style={{ fontSize: 10, color: "var(--color-success)", fontWeight: 700 }}>−{Math.round(discount * 100)}% fleet</div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 800, color: canAfford ? "var(--color-text)" : "var(--color-danger)" }}>
                        {qty > 1 ? `Totale: ${fmt(total)}` : fmt(perUnit)}
                      </div>
                    </div>
                  </div>

                  <button
                    style={{
                      ...s.acquireBtn,
                      background: btnColor,
                      opacity: canAfford ? 1 : 0.4,
                      cursor: canAfford ? "pointer" : "not-allowed",
                    }}
                    disabled={!canAfford || acquiring === model.id}
                    onClick={() => handleAcquire(model.id)}
                  >
                    {acquiring === model.id
                      ? `Acquisizione${qty > 1 ? ` ×${qty}` : ""}…`
                      : !canAfford
                        ? `Mancano ${fmt(total - state.cash)}`
                        : acqMode === "owned"
                          ? qty > 1 ? `Acquista ×${qty} — ${fmt(total)}` : `Acquista — ${fmt(perUnit)}`
                          : acqMode === "acmi"
                            ? qty > 1 ? `ACMI ×${qty} — dep. ${fmt(total)}` : `ACMI — dep. ${fmt(perUnit)}`
                            : qty > 1 ? `Noleggia ×${qty} — dep. ${fmt(total)}` : `Noleggia — ${fmt(model.monthlyLease)}/mese`}
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}

        <div style={{ height: "var(--nav-height)" }} />
      </main>

      <BottomNav current={state.currentView} dispatch={dispatch} items={NAV_ITEMS} />
    </div>
  );
}

function EmptyFleet({ onGoMarket }: { onGoMarket: () => void }) {
  return (
    <div style={s.emptyCard}>
      <div style={{ fontSize: "2.5rem" }}>✈</div>
      <div style={s.emptyTitle}>Nessun aereo in flotta</div>
      <p style={s.emptyText}>Vai al mercato per noleggiare il tuo primo aeromobile.</p>
      <button style={s.ctaBtn} onClick={onGoMarket}>Vai al mercato →</button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.stat}>
      <span style={s.statLabel}>{label}</span>
      <span style={s.statValue}>{value}</span>
    </div>
  );
}

function BottomNav({ current, dispatch, items }: {
  current: string;
  dispatch: React.Dispatch<import("../game/reducer").GameAction>;
  items: typeof NAV_ITEMS;
}) {
  return (
    <nav style={s.nav}>
      {items.map(item => (
        <button
          key={item.view}
          style={{ ...s.navBtn, color: current === item.view ? "var(--color-accent)" : "var(--color-text-muted)" }}
          onClick={() => dispatch({ type: "SET_VIEW", payload: item.view })}
        >
          <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 500 }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" },
  header: {
    height: "var(--header-height)", background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)", display: "flex",
    alignItems: "center", gap: "var(--space-3)",
    padding: "0 var(--space-page)", position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: { background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", width: 32, height: 32, cursor: "pointer", color: "var(--color-text)", fontSize: 16, flexShrink: 0 },
  headerTitle: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)", flex: 1 },
  acqToggle: { display: "flex", gap: "var(--space-2)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-1)" },
  acqBtn: { flex: 1, padding: "var(--space-2)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", fontWeight: 500, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" },
  acqBtnActive: { background: "var(--color-surface-2)", color: "var(--color-text)", fontWeight: 700 },
  headerRight: { display: "flex", alignItems: "center", gap: "var(--space-2)" },
  cashBadge: {
    background: "var(--color-success-bg)", color: "var(--color-success)",
    border: "1px solid var(--color-success)", borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)", fontWeight: 700, padding: "2px 10px",
  },
  main: { flex: 1, padding: "var(--space-4) var(--space-page)", display: "flex", flexDirection: "column", gap: "var(--space-3)", overflowY: "auto" },
  tabs: { display: "flex", gap: "var(--space-2)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-1)" },
  tab: { flex: 1, padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-sm)", fontWeight: 500, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" },
  tabActive: { background: "var(--color-surface-2)", color: "var(--color-text)" },
  tabCount: { background: "var(--color-surface-3)", borderRadius: "var(--radius-full)", fontSize: "var(--font-size-xs)", fontWeight: 700, padding: "1px 7px", color: "var(--color-text-muted)" },
  list: { display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  marketNote: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", background: "var(--color-info-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)" },
  card: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  modelName: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  modelFamily: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 },
  cardBadge: { background: "var(--color-accent-dim)", color: "var(--color-accent)", borderRadius: "var(--radius-full)", fontSize: "var(--font-size-xs)", fontWeight: 700, padding: "2px 10px", whiteSpace: "nowrap" as const },
  regBadge: { background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", fontSize: "0.65rem", fontWeight: 700, padding: "1px 8px", letterSpacing: "0.08em", whiteSpace: "nowrap" as const, fontFamily: "monospace" },
  leasePrice: { fontSize: "var(--font-size-base)", fontWeight: 700, color: "var(--color-warning)" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1) var(--space-4)" },
  stat: { display: "flex", flexDirection: "column", gap: 1 },
  statLabel: { fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  statValue: { fontSize: "var(--font-size-sm)", fontWeight: 500, color: "var(--color-text)" },
  utilBar: { display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  utilLabel: { display: "flex", justifyContent: "space-between" },
  utilTrack: { height: 4, background: "var(--color-surface-3)", borderRadius: "var(--radius-full)", overflow: "hidden" },
  utilFill: { height: "100%", borderRadius: "var(--radius-full)", transition: "width 0.3s ease" },
  routeTag: { fontSize: "var(--font-size-xs)", color: "var(--color-accent)", background: "var(--color-accent-dim)", borderRadius: "var(--radius-sm)", padding: "2px 8px", alignSelf: "flex-start" as const },
  acquireBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "none", width: "100%" },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text)", fontSize: 18, cursor: "pointer", fontWeight: 700 },
  emptyCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-6)", textAlign: "center" as const, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" },
  emptyTitle: { fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" },
  emptyText: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", maxWidth: 280 },
  ctaBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  nav: { height: "var(--nav-height)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", display: "flex", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
};
