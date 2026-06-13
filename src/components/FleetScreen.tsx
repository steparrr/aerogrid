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

export function FleetScreen() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>("fleet");
  const [acquiring, setAcquiring] = useState<string | null>(null);
  const [acqMode, setAcqMode] = useState<AcqMode>("leased");

  if (!state) return null;

  function acqCost(model: typeof aircraftModels[number]): number {
    if (acqMode === "owned") return model.purchasePrice;
    if (acqMode === "acmi") return ACMI_RATE_PER_HOUR * 100; // deposito 100h
    return model.monthlyLease * 3; // deposito 3 mesi leasing
  }

  function handleAcquire(modelId: string) {
    if (!state) return;
    const model = aircraftModelById.get(modelId);
    if (!model) return;
    const cost = acqCost(model);
    if (state.cash < cost) {
      const label = acqMode === "owned" ? "Prezzo acquisto" : acqMode === "acmi" ? "Deposito ACMI (100h)" : "Deposito leasing";
      alert(`Fondi insufficienti. ${label}: ${fmt(cost)}`);
      return;
    }
    setAcquiring(modelId);
    setTimeout(() => {
      const acquisitionType = acqMode === "acmi" ? "acmi" : acqMode;
      dispatch({ type: "ACQUIRE_AIRCRAFT", payload: { modelId, acquisitionType } });
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
                        <div style={s.cardBadge}>{model.economyCapacity + model.businessCapacity} pax</div>
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
          <div style={s.list}>
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
              const cost = acqCost(model);
              const canAfford = state.cash >= cost;
              const btnColor = acqMode === "owned"
                ? "var(--color-success)"
                : acqMode === "acmi"
                  ? "var(--color-warning)"
                  : "var(--color-accent)";
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
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>dep. {fmt(cost)}</div>
                        </>
                      )}
                      {acqMode === "owned" && (
                        <div style={{ ...s.leasePrice, color: "var(--color-success)" }}>{fmt(model.purchasePrice)}</div>
                      )}
                      {acqMode === "acmi" && (
                        <>
                          <div style={{ ...s.leasePrice, color: "var(--color-warning)" }}>{fmt(ACMI_RATE_PER_HOUR)}/h</div>
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>dep. {fmt(cost)}</div>
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
                      ? "Acquisizione..."
                      : !canAfford
                        ? `Servono ${fmt(cost - state.cash)} in più`
                        : acqMode === "owned"
                          ? `Acquista — ${fmt(model.purchasePrice)}`
                          : acqMode === "acmi"
                            ? `ACMI — dep. ${fmt(cost)}`
                            : `Noleggia — ${fmt(model.monthlyLease)}/mese`}
                  </button>
                </div>
              );
            })}
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
  emptyCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-6)", textAlign: "center" as const, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" },
  emptyTitle: { fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" },
  emptyText: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", maxWidth: 280 },
  ctaBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-sm)", padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  nav: { height: "var(--nav-height)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", display: "flex", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
};
