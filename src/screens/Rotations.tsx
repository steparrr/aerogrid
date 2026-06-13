import { useMemo, useState } from "react";

import { aircraftModelById } from "../data/indexes";
import type { GameState, GameView } from "../domain/types";
import {
  buildDailyRotation,
  calculateUtilization,
  getUtilizationAlert,
  type DailyRotation,
  type FlightLeg,
} from "../engine/rotationsEngine";
import {
  performACheck,
  scheduleNextCheck,
} from "../engine/maintenanceEngine";
import { synchronizeGameState } from "../game/stateSync";

interface Props {
  game: GameState;
  onNavigate: (view: GameView) => void;
  onUpdate?: (game: GameState) => void;
}

type Tab = "gantt" | "utilization" | "alerts";
type Period = "day" | "week" | "month";

const HOURS = [0, 4, 8, 12, 16, 20, 24];
const MINUTES_PER_DAY = 24 * 60;

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function formatMinute(value: number) {
  const normalized = Math.max(0, Math.round(value));
  const hours = Math.floor(normalized / 60) % 24;
  const minutes = normalized % 60;
  const nextDay = normalized >= MINUTES_PER_DAY ? " +1" : "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}${nextDay}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function positionForMinute(value: number) {
  return `${clampPercent((value / MINUTES_PER_DAY) * 100)}%`;
}

function widthForLeg(leg: FlightLeg) {
  const end = Math.min(leg.scheduled_arrival_minute, MINUTES_PER_DAY);
  const start = Math.min(leg.scheduled_departure_minute, MINUTES_PER_DAY);
  return `${clampPercent(((end - start) / MINUTES_PER_DAY) * 100)}%`;
}

function aircraftLabel(game: GameState, aircraftId: string) {
  const aircraft = game.fleet.find((item) => item.id === aircraftId);
  const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
  return aircraft?.registration ?? model?.name ?? aircraftId;
}

function utilizationTone(value: number) {
  if (value > 0.9) return "var(--color-danger)";
  if (value < 0.5) return "var(--color-warning)";
  return "var(--color-success)";
}

function periodMultiplier(period: Period) {
  return period === "day" ? 1 : period === "week" ? 7 : 30;
}

function periodLabel(period: Period) {
  return period === "day" ? "giornaliero" : period === "week" ? "settimanale" : "mensile";
}

export function Rotations({ game, onNavigate, onUpdate }: Props) {
  const rotations = useMemo(
    () =>
      game.fleet.map((aircraft) =>
        buildDailyRotation(aircraft, game.routes),
      ),
    [game.fleet, game.routes],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    rotations[0]?.aircraft_id ?? null,
  );
  const [tab, setTab] = useState<Tab>("gantt");
  const [period, setPeriod] = useState<Period>("day");
  const selected =
    rotations.find((rotation) => rotation.aircraft_id === selectedId) ??
    rotations[0] ??
    null;

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
          <h1 style={styles.title}>Rotazioni</h1>
          <div style={styles.subtitle}>
            {game.airlineName} · {game.currentDate}
          </div>
        </div>
        <div style={styles.hubBadge}>{game.hubIata}</div>
      </header>

      <main style={styles.main}>
        <section style={styles.toolbar}>
          <div style={styles.tabs} aria-label="Viste rotazioni">
            <TabButton active={tab === "gantt"} onClick={() => setTab("gantt")}>
              Gantt
            </TabButton>
            <TabButton
              active={tab === "utilization"}
              onClick={() => setTab("utilization")}
            >
              Utilizzo
            </TabButton>
            <TabButton
              active={tab === "alerts"}
              onClick={() => setTab("alerts")}
            >
              Alert
            </TabButton>
          </div>
          <div style={styles.periods} aria-label="Periodo">
            {(["day", "week", "month"] as const).map((value) => (
              <button
                key={value}
                style={{
                  ...styles.periodButton,
                  ...(period === value ? styles.periodButtonActive : {}),
                }}
                onClick={() => setPeriod(value)}
              >
                {value === "day" ? "Giorno" : value === "week" ? "Settimana" : "Mese"}
              </button>
            ))}
          </div>
        </section>

        {rotations.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyMark}>↻</div>
            <h2 style={styles.emptyTitle}>Nessuna rotazione pianificata</h2>
            <p style={styles.emptyText}>
              Acquisisci un aeromobile e assegnalo a una rotta per costruire il
              programma operativo.
            </p>
            <button style={styles.primaryButton} onClick={() => onNavigate("fleet")}>
              Vai alla Flotta
            </button>
          </section>
        ) : (
          <>
            {tab === "gantt" && (
              <Gantt
                game={game}
                rotations={rotations}
                selectedId={selected?.aircraft_id ?? null}
                onSelect={setSelectedId}
                period={period}
              />
            )}
            {tab === "utilization" && (
              <UtilizationPanel
                game={game}
                rotations={rotations}
                selectedId={selected?.aircraft_id ?? null}
                onSelect={setSelectedId}
                period={period}
              />
            )}
            {tab === "alerts" && (
              <AlertsPanel game={game} rotations={rotations} />
            )}
            {selected && (
              <RotationDetail
                game={game}
                rotation={selected}
                period={period}
                onUpdate={onUpdate}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      style={{ ...styles.tabButton, ...(active ? styles.tabButtonActive : {}) }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Gantt({
  game,
  rotations,
  selectedId,
  onSelect,
  period,
}: {
  game: GameState;
  rotations: DailyRotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  period: Period;
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeading}>
        <div>
          <div style={styles.eyebrow}>Programma {periodLabel(period)}</div>
          <h2 style={styles.panelTitle}>
            Timeline {period === "day" ? "24 ore" : `${period === "week" ? 7 : 30} giorni tipo`}
          </h2>
        </div>
        <div style={styles.legend}>
          <span style={styles.legendItem}><i style={styles.flightDot} />Volo</span>
          <span style={styles.legendItem}><i style={styles.groundDot} />Turnaround</span>
        </div>
      </div>

      <div style={styles.ganttScroller}>
        <div style={styles.gantt}>
          <div style={styles.timeHeader}>
            <span />
            <div style={styles.timeAxis}>
              {HOURS.map((hour) => (
                <span key={hour} style={styles.timeLabel}>
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          {rotations.map((rotation) => (
            <button
              key={rotation.aircraft_id}
              style={{
                ...styles.ganttRow,
                ...(selectedId === rotation.aircraft_id ? styles.ganttRowActive : {}),
              }}
              onClick={() => onSelect(rotation.aircraft_id)}
            >
              <span style={styles.aircraftName}>
                {aircraftLabel(game, rotation.aircraft_id)}
                <small style={styles.aircraftMeta}>
                  {formatHours(rotation.total_block_hours)} ore di volo
                </small>
              </span>
              <span style={styles.track}>
                {HOURS.slice(0, -1).map((hour) => (
                  <i
                    key={hour}
                    style={{
                      ...styles.gridLine,
                      left: `${(hour / 24) * 100}%`,
                    }}
                  />
                ))}
                {rotation.flights.map((flight) => (
                  <span key={flight.id}>
                    <span
                      title={`${flight.origin} → ${flight.destination} ${formatMinute(flight.scheduled_departure_minute)}–${formatMinute(flight.scheduled_arrival_minute)} · delay ${flight.delay_minutes} min`}
                      style={{
                        ...styles.flightBar,
                        ...(flight.delay_minutes > 0 ? styles.delayedBar : {}),
                        left: positionForMinute(flight.scheduled_departure_minute),
                        width: widthForLeg(flight),
                      }}
                    >
                      {flight.origin}-{flight.destination}
                    </span>
                    <span
                      title={`Turnaround ${flight.destination}: ${Math.round(flight.turnaround_minutes)} min`}
                      style={{
                        ...styles.turnaroundBar,
                        left: positionForMinute(flight.scheduled_arrival_minute),
                        width: `${clampPercent((flight.turnaround_minutes / MINUTES_PER_DAY) * 100)}%`,
                      }}
                    />
                  </span>
                ))}
                {game.fleet.find((item) => item.id === rotation.aircraft_id)?.status === "IN_MAINTENANCE" && (
                  <span style={styles.maintenanceBar}>Manutenzione</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function UtilizationPanel({
  game,
  rotations,
  selectedId,
  onSelect,
  period,
}: {
  game: GameState;
  rotations: DailyRotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  period: Period;
}) {
  const multiplier = periodMultiplier(period);

  return (
    <section style={styles.cardGrid}>
      {rotations.map((rotation) => {
        const metrics = calculateUtilization(rotation);
        const progress = clampPercent(metrics.target_achievement_pct * 100);
        const tone = utilizationTone(metrics.target_achievement_pct);

        return (
          <button
            key={rotation.aircraft_id}
            style={{
              ...styles.metricCard,
              ...(selectedId === rotation.aircraft_id ? styles.metricCardActive : {}),
            }}
            onClick={() => onSelect(rotation.aircraft_id)}
          >
            <span style={styles.metricHeader}>
              <strong>{aircraftLabel(game, rotation.aircraft_id)}</strong>
              <span style={{ ...styles.metricValue, color: tone }}>
                {Math.round(progress)}%
              </span>
            </span>
            <span style={styles.progressTrack}>
              <i style={{ ...styles.progressFill, width: `${progress}%`, background: tone }} />
            </span>
            <span style={styles.metricFooter}>
              {formatHours(metrics.block_hours * multiplier)} / {formatHours(metrics.target_block_hours * multiplier)} target {periodLabel(period)}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function AlertsPanel({
  game,
  rotations,
}: {
  game: GameState;
  rotations: DailyRotation[];
}) {
  const alerts = rotations.map((rotation) => ({
    rotation,
    alert: getUtilizationAlert(calculateUtilization(rotation)),
  }));
  const activeAlerts = alerts.filter((item) => item.alert !== null);

  return (
    <section style={styles.alertList}>
      {activeAlerts.length === 0 && (
        <article style={{ ...styles.alertCard, borderLeftColor: "var(--color-success)" }}>
          <div style={styles.alertTopline}>
            <strong>Utilizzo bilanciato</strong>
            <span>Flotta regolare</span>
          </div>
          <p style={styles.alertText}>
            Tutti gli aeromobili operano entro i target giornalieri.
          </p>
        </article>
      )}
      {activeAlerts.map(({ rotation, alert }) => {
        const over = alert === "OVERUTILIZATION";
        const title = over ? "Sovrautilizzo" : "Sottoutilizzo";
        const message = over
          ? "Margine operativo ridotto: valuta più buffer o un aeromobile aggiuntivo."
          : "Capacità disponibile: assegna nuove frequenze o una rotta aggiuntiva.";

        return (
          <article
            key={rotation.aircraft_id}
            style={{
              ...styles.alertCard,
              borderLeftColor: over ? "var(--color-danger)" : "var(--color-warning)",
            }}
          >
            <div style={styles.alertTopline}>
              <strong>{title}</strong>
              <span>{aircraftLabel(game, rotation.aircraft_id)}</span>
            </div>
            <p style={styles.alertText}>{message}</p>
          </article>
        );
      })}
    </section>
  );
}

function RotationDetail({
  game,
  rotation,
  period,
  onUpdate,
}: {
  game: GameState;
  rotation: DailyRotation;
  period: Period;
  onUpdate?: (game: GameState) => void;
}) {
  const metrics = calculateUtilization(rotation);
  const route = game.routes.find((item) => item.id === rotation.flights[0]?.route_id);
  const aircraft = game.fleet.find((item) => item.id === rotation.aircraft_id);
  const maintenance = aircraft ? scheduleNextCheck(aircraft) : null;
  const multiplier = periodMultiplier(period);

  function reassignRoute(routeId: string) {
    if (!onUpdate || !aircraft) return;

    const routes = game.routes.map((item) =>
      item.id === routeId ? { ...item, aircraftId: aircraft.id } : item,
    );
    const fleet = game.fleet.map((item) => ({
      ...item,
      assignedRouteIds: routes
        .filter((candidate) => candidate.aircraftId === item.id)
        .map((candidate) => candidate.id),
    }));

    onUpdate(synchronizeGameState({ ...game, routes, fleet }));
  }

  function performPreventiveCheck() {
    if (!onUpdate || !aircraft) return;

    const result = performACheck(aircraft);
    const fleet = game.fleet.map((item) =>
      item.id === aircraft.id ? result.aircraft : item,
    );
    const notifications = [
      ...game.notifications,
      {
        id: `a-check-${aircraft.id}-${game.turn}`,
        severity: "info" as const,
        title: "A-check completato",
        message: `${aircraftLabel(game, aircraft.id)}: costo $${result.cost.toLocaleString("en-US")}.`,
      },
    ];

    onUpdate(
      synchronizeGameState({
        ...game,
        cash: game.cash - result.cost,
        fleet,
        notifications,
      }),
    );
  }

  return (
    <section style={styles.detailPanel}>
      <div style={styles.eyebrow}>Aeromobile selezionato</div>
      <div style={styles.detailHeading}>
        <h2 style={styles.detailTitle}>{aircraftLabel(game, rotation.aircraft_id)}</h2>
        <span style={styles.routeBadge}>
          {route ? `${route.originIata} → ${route.destinationIata}` : "Non assegnato"}
        </span>
      </div>
      <div style={styles.detailGrid}>
        <DetailStat label="Primo decollo" value={rotation.flights[0] ? formatMinute(rotation.flights[0].scheduled_departure_minute) : "—"} />
        <DetailStat label={`Ore di volo ${periodLabel(period)}`} value={formatHours(metrics.block_hours * multiplier)} />
        <DetailStat label="Prossimo A-check" value={maintenance?.remaining_hours === undefined ? "—" : `${Math.round(maintenance.remaining_hours)}h`} />
        <DetailStat label="FTL equipaggio" value={rotation.ftl_compliant ? "Conforme" : "Warning"} />
      </div>
      <div style={styles.weeklyStrip} aria-label="Utilizzo settimana">
        {Array.from({ length: 7 }, (_, index) => (
          <i
            key={index}
            title={`Giorno ${index + 1}: ${formatHours(metrics.block_hours)}`}
            style={{
              ...styles.weeklyBar,
              height: `${Math.max(16, Math.min(100, metrics.target_achievement_pct * 72 + index * 2))}%`,
              background: utilizationTone(metrics.target_achievement_pct),
            }}
          />
        ))}
      </div>
      <div style={styles.actionGrid}>
        <label style={styles.controlLabel}>
          Riassegna a rotta
          <select
            aria-label="Riassegna a rotta"
            value={route?.id ?? ""}
            style={styles.select}
            onChange={(event) => reassignRoute(event.target.value)}
          >
            <option value="">Nessuna rotta</option>
            {game.routes.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.originIata} → {candidate.destinationIata}
              </option>
            ))}
          </select>
        </label>
        <button
          style={styles.secondaryButton}
          onClick={performPreventiveCheck}
        >
          Esegui A-check preventivo
        </button>
      </div>
    </section>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailStat}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", color: "var(--color-text)" },
  header: {
    minHeight: "var(--header-height)",
    padding: "var(--space-3) var(--space-page)",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface-2)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  title: { margin: 0, fontSize: "var(--font-size-xl)", lineHeight: 1.1 },
  subtitle: { marginTop: 4, color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  hubBadge: {
    marginLeft: "auto",
    padding: "4px 10px",
    borderRadius: "var(--radius-full)",
    color: "var(--color-accent)",
    background: "var(--color-accent-dim)",
    border: "1px solid var(--color-accent)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
  },
  main: {
    width: "min(1180px, 100%)",
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "var(--space-5) var(--space-page) var(--space-8)",
    display: "grid",
    gap: "var(--space-4)",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
  },
  tabs: { display: "flex", gap: "var(--space-1)", padding: 4, borderRadius: "var(--radius-md)", background: "var(--color-surface)" },
  tabButton: {
    border: 0,
    borderRadius: "var(--radius-sm)",
    padding: "8px 14px",
    background: "transparent",
    color: "var(--color-text-muted)",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabButtonActive: { color: "var(--color-bg)", background: "var(--color-accent)" },
  periods: { display: "flex", gap: "var(--space-1)" },
  periodButton: {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-full)",
    padding: "6px 11px",
    background: "transparent",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    cursor: "pointer",
  },
  periodButtonActive: { borderColor: "var(--color-accent)", color: "var(--color-accent)", background: "var(--color-accent-dim)" },
  panel: { border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", overflow: "hidden" },
  panelHeading: { padding: "var(--space-4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", borderBottom: "1px solid var(--color-border)" },
  eyebrow: { color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.09em", fontSize: "var(--font-size-xs)", fontWeight: 700 },
  panelTitle: { margin: "4px 0 0", fontSize: "var(--font-size-lg)" },
  legend: { display: "flex", gap: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  flightDot: { width: 8, height: 8, borderRadius: "var(--radius-full)", background: "var(--color-accent)" },
  groundDot: { width: 8, height: 8, borderRadius: "var(--radius-full)", background: "var(--color-warning)" },
  ganttScroller: { overflowX: "auto" },
  gantt: { minWidth: 760 },
  timeHeader: { display: "grid", gridTemplateColumns: "180px 1fr", minHeight: 36, borderBottom: "1px solid var(--color-border)" },
  timeAxis: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 var(--space-2)", color: "var(--color-text-faint)", fontSize: "var(--font-size-xs)" },
  timeLabel: { transform: "translateX(-50%)" },
  ganttRow: { width: "100%", display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "stretch", padding: 0, border: 0, borderBottom: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", textAlign: "left", cursor: "pointer" },
  ganttRowActive: { background: "var(--color-accent-dim)" },
  aircraftName: { padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: 3, fontWeight: 700, borderRight: "1px solid var(--color-border)" },
  aircraftMeta: { color: "var(--color-text-muted)", fontWeight: 400, fontSize: "var(--font-size-xs)" },
  track: { minHeight: 66, position: "relative", display: "block", overflow: "hidden" },
  gridLine: { position: "absolute", top: 0, bottom: 0, borderLeft: "1px dashed var(--color-border)" },
  flightBar: { position: "absolute", top: 17, minWidth: 2, height: 30, boxSizing: "border-box", padding: "7px 8px", borderRadius: "var(--radius-sm)", color: "var(--color-bg)", background: "linear-gradient(90deg, var(--color-accent), #22c55e)", fontSize: "var(--font-size-xs)", fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap" },
  delayedBar: { background: "var(--color-danger)", color: "var(--color-text)" },
  turnaroundBar: { position: "absolute", top: 21, minWidth: 3, height: 22, borderRadius: "var(--radius-sm)", background: "var(--color-warning)", opacity: 0.8 },
  maintenanceBar: { position: "absolute", left: 0, top: 17, width: "18%", height: 30, boxSizing: "border-box", padding: "7px 8px", borderRadius: "var(--radius-sm)", background: "var(--color-danger)", color: "var(--color-text)", fontSize: "var(--font-size-xs)", fontWeight: 800 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)" },
  metricCard: { padding: "var(--space-4)", display: "grid", gap: "var(--space-3)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", color: "var(--color-text)", textAlign: "left", cursor: "pointer" },
  metricCardActive: { borderColor: "var(--color-accent)", boxShadow: "0 0 0 1px var(--color-accent-dim)" },
  metricHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" },
  metricValue: { fontSize: "var(--font-size-lg)", fontWeight: 800 },
  progressTrack: { height: 8, borderRadius: "var(--radius-full)", background: "var(--color-surface-3)", overflow: "hidden" },
  progressFill: { display: "block", height: "100%", borderRadius: "var(--radius-full)" },
  metricFooter: { color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  alertList: { display: "grid", gap: "var(--space-3)" },
  alertCard: { padding: "var(--space-4)", border: "1px solid var(--color-border)", borderLeft: "4px solid", borderRadius: "var(--radius-md)", background: "var(--color-surface)" },
  alertTopline: { display: "flex", justifyContent: "space-between", gap: "var(--space-3)" },
  alertText: { margin: "var(--space-2) 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" },
  detailPanel: { padding: "var(--space-4)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" },
  detailHeading: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", margin: "var(--space-1) 0 var(--space-4)" },
  detailTitle: { margin: 0, fontSize: "var(--font-size-lg)" },
  routeBadge: { color: "var(--color-accent)", background: "var(--color-accent-dim)", borderRadius: "var(--radius-full)", padding: "4px 9px", fontSize: "var(--font-size-xs)", fontWeight: 700 },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-2)" },
  detailStat: { padding: "var(--space-3)", display: "grid", gap: 4, borderRadius: "var(--radius-md)", background: "var(--color-surface-2)" },
  weeklyStrip: { height: 58, marginTop: "var(--space-3)", padding: "var(--space-2)", display: "flex", alignItems: "end", gap: "var(--space-1)", borderRadius: "var(--radius-md)", background: "var(--color-surface-2)" },
  weeklyBar: { flex: 1, display: "block", maxHeight: "100%", borderRadius: "var(--radius-sm)", opacity: 0.8 },
  actionGrid: { marginTop: "var(--space-3)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", alignItems: "end", gap: "var(--space-3)" },
  controlLabel: { display: "grid", gap: "var(--space-1)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontWeight: 700 },
  select: { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface-2)", color: "var(--color-text)" },
  secondaryButton: { padding: "10px 12px", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-md)", background: "var(--color-warning-bg)", color: "var(--color-warning)", fontWeight: 800, cursor: "pointer" },
  statLabel: { color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  statValue: { fontSize: "var(--font-size-base)" },
  emptyCard: { padding: "var(--space-8)", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" },
  emptyMark: { color: "var(--color-accent)", fontSize: "var(--font-size-2xl)" },
  emptyTitle: { margin: "var(--space-3) 0 var(--space-2)", fontSize: "var(--font-size-xl)" },
  emptyText: { maxWidth: 480, margin: "0 auto var(--space-4)", color: "var(--color-text-muted)" },
  primaryButton: { padding: "9px 15px", border: 0, borderRadius: "var(--radius-md)", color: "var(--color-bg)", background: "var(--color-accent)", fontWeight: 800, cursor: "pointer" },
};
