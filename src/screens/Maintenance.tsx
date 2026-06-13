import { useMemo, useState } from "react";

import { aircraftModelById } from "../data/indexes";
import type { Aircraft, FuelHedge, GameState, GameView } from "../domain/types";
import {
  calculateAogProbability,
  calculateAOGCost,
  calculateMaintenanceReserve,
  rollAOGEvent,
  scheduleNextCheck,
} from "../engine/maintenanceEngine";
import { synchronizeGameState } from "../game/stateSync";
import {
  evaluateHedgePayoff,
  suggestOptimalHedge,
} from "../simulation/fuelEngine";

interface Props {
  game: GameState;
  onNavigate: (view: GameView) => void;
  onUpdate?: (game: GameState) => void;
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function aircraftName(aircraft: Aircraft) {
  return aircraft.registration ?? aircraftModelById.get(aircraft.modelId)?.name ?? aircraft.modelId;
}

function conditionOf(aircraft: Aircraft) {
  return aircraft.condition ?? Math.round(aircraft.reliability * 100);
}

function conditionColor(condition: number) {
  if (condition >= 90) return "var(--color-success)";
  if (condition >= 70) return "var(--color-warning)";
  return "var(--color-danger)";
}

function monthlyFuelConsumption(game: GameState) {
  return game.fleet.reduce((total, aircraft) => {
    const model = aircraftModelById.get(aircraft.modelId);
    return total + (model?.fuelBurnKgPerHour ?? 0) * aircraft.utilizationHoursPerDay * 30;
  }, 0);
}

export function Maintenance({ game, onNavigate, onUpdate }: Props) {
  const [selectedId, setSelectedId] = useState(game.fleet[0]?.id ?? null);
  const selected = game.fleet.find((aircraft) => aircraft.id === selectedId) ?? game.fleet[0] ?? null;
  const monthlyFuel = useMemo(() => monthlyFuelConsumption(game), [game]);
  const activeAog = useMemo(
    () =>
      game.fleet
        .map((aircraft) => ({ aircraft, event: rollAOGEvent(aircraft) }))
        .find((candidate) => candidate.event !== null) ?? null,
    [game.fleet],
  );

  function addSuggestedHedge() {
    if (!onUpdate) return;

    const hedge = suggestOptimalHedge(
      {
        currentPricePerKg: game.market_fuel_price,
        volatilityEstimate: 0.15,
        trend: "STABLE",
      },
      monthlyFuel,
      game.currentDate,
    );
    const player = {
      ...game.player,
      fuel_hedges: [...game.player.fuel_hedges, hedge],
    };
    onUpdate(synchronizeGameState({ ...game, player }));
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          aria-label="Centro"
          style={styles.backButton}
          onClick={() => onNavigate("operations")}
        >
          ←
        </button>
        <div>
          <h1 style={styles.title}>Manutenzione & Fuel</h1>
          <div style={styles.subtitle}>{game.airlineName} · Turno {game.turn}</div>
        </div>
        <div style={styles.marketPrice}>Fuel ${game.market_fuel_price.toFixed(3)}/kg</div>
      </header>

      <main style={styles.main}>
        {activeAog ? (
          <AogPanel aircraft={activeAog.aircraft} event={activeAog.event!} />
        ) : (
          <section style={styles.okPanel}>
            <strong>Nessun AOG attivo</strong>
            <span>La flotta è disponibile per le operazioni pianificate.</span>
          </section>
        )}

        {game.fleet.length === 0 ? (
          <section style={styles.emptyCard}>
            <h2 style={styles.sectionTitle}>Nessun aeromobile in flotta</h2>
            <p style={styles.muted}>Acquisisci un aeromobile per pianificare manutenzioni e reserve.</p>
            <button style={styles.primaryButton} onClick={() => onNavigate("fleet")}>Vai alla Flotta</button>
          </section>
        ) : (
          <>
            <section style={styles.section}>
              <div style={styles.sectionHeading}>
                <div>
                  <div style={styles.eyebrow}>Fleet health</div>
                  <h2 style={styles.sectionTitle}>Stato manutenzione</h2>
                </div>
                <span style={styles.muted}>{game.fleet.length} aeromobili</span>
              </div>
              <div style={styles.fleetGrid}>
                {game.fleet.map((aircraft) => (
                  <AircraftCard
                    key={aircraft.id}
                    aircraft={aircraft}
                    selected={selected?.id === aircraft.id}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.eyebrow}>Scheduler</div>
              <h2 style={styles.sectionTitle}>Timeline 12 mesi</h2>
              <div style={styles.timelineList}>
                {game.fleet.map((aircraft) => (
                  <ScheduleRow key={aircraft.id} aircraft={aircraft} />
                ))}
              </div>
            </section>

            {selected && <AircraftDetail aircraft={selected} />}
          </>
        )}

        <section style={styles.section}>
          <div style={styles.sectionHeading}>
            <div>
              <div style={styles.eyebrow}>Risk management</div>
              <h2 style={styles.sectionTitle}>Fuel Hedging</h2>
            </div>
            <button style={styles.primaryButton} onClick={addSuggestedHedge}>
              Nuovo Hedge
            </button>
          </div>
          <div style={styles.kpiGrid}>
            <Kpi label="Consumo mensile stimato" value={`${Math.round(monthlyFuel).toLocaleString("it-IT")} kg`} />
            <Kpi label="Prezzo mercato" value={`$${game.market_fuel_price.toFixed(3)}/kg`} />
            <Kpi label="Coperture attive" value={String(game.player.fuel_hedges.filter((hedge) => hedge.status === "ACTIVE").length)} />
          </div>
          <HedgeList
            hedges={game.player.fuel_hedges}
            marketPrice={game.market_fuel_price}
            monthlyFuel={monthlyFuel}
          />
        </section>
      </main>
    </div>
  );
}

function AogPanel({
  aircraft,
  event,
}: {
  aircraft: Aircraft;
  event: NonNullable<ReturnType<typeof rollAOGEvent>>;
}) {
  const cost = calculateAOGCost(event, []);

  return (
    <section style={styles.aogPanel}>
      <div style={styles.eyebrow}>AOG attivo</div>
      <strong>{aircraftName(aircraft)} bloccato</strong>
      <span>{event.duration_minutes} min stimati · costo diretto {formatCurrency(cost.direct_cost)}</span>
      <span>Brand impact: -{cost.brand_score_damage.toFixed(1)}</span>
    </section>
  );
}

function AircraftCard({
  aircraft,
  selected,
  onSelect,
}: {
  aircraft: Aircraft;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const condition = conditionOf(aircraft);
  const schedule = scheduleNextCheck(aircraft);
  const reserve = calculateMaintenanceReserve(aircraft);
  const risk = calculateAogProbability(aircraft);

  return (
    <button
      style={{ ...styles.aircraftCard, ...(selected ? styles.aircraftCardSelected : {}) }}
      onClick={() => onSelect(aircraft.id)}
    >
      <span style={styles.cardHeader}>
        <span>
          <strong>{aircraftName(aircraft)}</strong>
          <small style={styles.muted}>{aircraft.ageYears} anni · {aircraft.acquisitionType}</small>
        </span>
        <strong style={{ color: conditionColor(condition) }}>{condition}%</strong>
      </span>
      <span style={styles.progressTrack}>
        <i style={{ ...styles.progressFill, width: `${condition}%`, background: conditionColor(condition) }} />
      </span>
      <span style={styles.cardStats}>
        <span>Prossimo A-check <strong>{schedule.remaining_hours === undefined ? "—" : `${Math.round(schedule.remaining_hours)}h`}</strong></span>
        <span>C-check <strong>{aircraft.maintenance_next_c_check ?? "—"}T</strong></span>
        <span>Reserve <strong>{formatCurrency(reserve)}/mese</strong></span>
        <span>Rischio AOG <strong>{Math.round(risk * 100)}%</strong></span>
      </span>
    </button>
  );
}

function ScheduleRow({ aircraft }: { aircraft: Aircraft }) {
  const checks = [
    { label: "C", turn: aircraft.maintenance_next_c_check, color: "var(--color-warning)" },
    { label: "D", turn: aircraft.maintenance_next_d_check, color: "var(--color-danger)" },
  ].filter((check) => check.turn !== undefined && check.turn <= 12);

  return (
    <div style={styles.scheduleRow}>
      <strong style={styles.scheduleName}>{aircraftName(aircraft)}</strong>
      <div style={styles.timeline}>
        {Array.from({ length: 13 }, (_, month) => (
          <i key={month} style={{ ...styles.monthTick, left: `${(month / 12) * 100}%` }} />
        ))}
        {checks.map((check) => (
          <span
            key={check.label}
            title={`${check.label}-check tra ${check.turn} turni`}
            style={{
              ...styles.checkMarker,
              left: `${Math.min(100, ((check.turn ?? 0) / 12) * 100)}%`,
              background: check.color,
            }}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AircraftDetail({ aircraft }: { aircraft: Aircraft }) {
  return (
    <section style={styles.section}>
      <div style={styles.eyebrow}>Aeromobile selezionato</div>
      <h2 style={styles.sectionTitle}>{aircraftName(aircraft)}</h2>
      <div style={styles.kpiGrid}>
        <Kpi label="Ore da A-check" value={`${Math.round(aircraft.flight_hours_since_a_check ?? 0)}h`} />
        <Kpi label="Cicli engine" value={String(aircraft.cycles_since_engine_overhaul ?? 0)} />
        <Kpi label="Reserve accumulata" value={formatCurrency(aircraft.maintenance_reserve_balance ?? 0)} />
        <Kpi label="Status" value={aircraft.status ?? "OPERATIONAL"} />
      </div>
    </section>
  );
}

function HedgeList({
  hedges,
  marketPrice,
  monthlyFuel,
}: {
  hedges: FuelHedge[];
  marketPrice: number;
  monthlyFuel: number;
}) {
  if (hedges.length === 0) {
    return <p style={styles.muted}>Nessuna copertura attiva. Crea un hedge suggerito dal forecast corrente.</p>;
  }

  return (
    <div style={styles.hedgeList}>
      {hedges.map((hedge, index) => {
        const dailyCovered = (monthlyFuel * hedge.coveragePct) / 100 / 30;
        const payoff = evaluateHedgePayoff(hedge, marketPrice, dailyCovered);
        return (
          <article key={`${hedge.type}-${index}`} style={styles.hedgeCard}>
            <strong>{hedge.type.replace("_", " ")}</strong>
            <span>{hedge.coveragePct}% · strike ${hedge.strikePrice.toFixed(3)} · {hedge.durationMonths} mesi</span>
            <strong style={{ color: payoff >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
              Payoff {formatCurrency(payoff)}/giorno
            </strong>
          </article>
        );
      })}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", color: "var(--color-text)" },
  header: { minHeight: "var(--header-height)", padding: "var(--space-3) var(--space-page)", display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 10 },
  backButton: { width: 36, height: 36, border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", background: "var(--color-surface-2)", color: "var(--color-text)", cursor: "pointer" },
  title: { margin: 0, fontSize: "var(--font-size-xl)" },
  subtitle: { marginTop: 3, color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  marketPrice: { marginLeft: "auto", color: "var(--color-warning)", fontSize: "var(--font-size-xs)", fontWeight: 800 },
  main: { width: "min(1180px, 100%)", boxSizing: "border-box", margin: "0 auto", padding: "var(--space-5) var(--space-page) var(--space-8)", display: "grid", gap: "var(--space-4)" },
  section: { padding: "var(--space-4)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" },
  sectionHeading: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" },
  eyebrow: { color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "var(--font-size-xs)", fontWeight: 800 },
  sectionTitle: { margin: "3px 0 var(--space-3)", fontSize: "var(--font-size-lg)" },
  muted: { display: "block", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  okPanel: { padding: "var(--space-3) var(--space-4)", display: "flex", justifyContent: "space-between", gap: "var(--space-3)", border: "1px solid var(--color-border)", borderLeft: "4px solid var(--color-success)", borderRadius: "var(--radius-md)", background: "var(--color-success-bg)", color: "var(--color-text-muted)" },
  aogPanel: { padding: "var(--space-4)", display: "grid", gap: "var(--space-1)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)", background: "var(--color-danger-bg)" },
  fleetGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-3)" },
  aircraftCard: { padding: "var(--space-4)", display: "grid", gap: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface-2)", color: "var(--color-text)", textAlign: "left", cursor: "pointer" },
  aircraftCardSelected: { borderColor: "var(--color-accent)", boxShadow: "0 0 0 1px var(--color-accent-dim)" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "var(--space-3)" },
  progressTrack: { height: 6, borderRadius: "var(--radius-full)", background: "var(--color-surface-3)", overflow: "hidden" },
  progressFill: { display: "block", height: "100%", borderRadius: "var(--radius-full)" },
  cardStats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  timelineList: { display: "grid", gap: "var(--space-2)" },
  scheduleRow: { display: "grid", gridTemplateColumns: "150px 1fr", gap: "var(--space-3)", alignItems: "center" },
  scheduleName: { fontSize: "var(--font-size-xs)" },
  timeline: { height: 30, position: "relative", borderRadius: "var(--radius-sm)", background: "var(--color-surface-2)", overflow: "hidden" },
  monthTick: { position: "absolute", top: 0, bottom: 0, borderLeft: "1px dashed var(--color-border)" },
  checkMarker: { position: "absolute", top: 5, width: 20, height: 20, transform: "translateX(-50%)", display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", color: "var(--color-bg)", fontSize: "var(--font-size-xs)", fontWeight: 900 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-2)" },
  kpi: { padding: "var(--space-3)", display: "grid", gap: 3, borderRadius: "var(--radius-md)", background: "var(--color-surface-2)" },
  kpiLabel: { color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  kpiValue: { fontVariantNumeric: "tabular-nums", fontSize: "var(--font-size-base)" },
  hedgeList: { marginTop: "var(--space-3)", display: "grid", gap: "var(--space-2)" },
  hedgeCard: { padding: "var(--space-3)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-2)", borderRadius: "var(--radius-md)", background: "var(--color-surface-2)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  emptyCard: { padding: "var(--space-8)", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" },
  primaryButton: { padding: "9px 13px", border: 0, borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800, cursor: "pointer" },
};
