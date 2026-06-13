import { useMemo, useState } from "react";
import { useGame } from "../game/gameContext";

import type {
  DistributionChannel,
  GameState,
  PlayerAirline,
  Route,
} from "../domain/types";
import {
  DISTRIBUTION_CHANNELS,
  DISTRIBUTION_CHANNEL_ORDER,
  calculateDistributionSummary,
  initiateNDCMigration,
  optimizeChannelMix,
  rebalanceChannelMix,
  type ChannelMix,
} from "../engine/distributionEngine";

interface Props {
  game?: GameState;
  airline?: PlayerAirline;
  routes?: Route[];
  onMixChange?: (mix: ChannelMix) => void;
  onStartNDCMigration?: () => void;
}

function formatMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function totalAllocation(mix: ChannelMix) {
  return Object.values(mix).reduce((sum, value) => sum + (value ?? 0), 0);
}

function initialMix(airline: PlayerAirline, routes: Route[]) {
  const stored =
    airline.distribution.channel_mix ?? airline.distribution.channelMix;
  return stored && Math.round(totalAllocation(stored)) === 100
    ? stored
    : optimizeChannelMix(airline, routes).mix;
}

export function Distribution({
  game,
  airline: airlineProp,
  routes: routesProp,
  onMixChange,
  onStartNDCMigration,
}: Props) {
  const airline = airlineProp ?? game?.player;
  const routes = routesProp ?? game?.routes ?? airline?.routes ?? [];

  if (!airline) {
    return (
      <main style={styles.page}>
        <section style={styles.empty}>
          <h1 style={styles.title}>Distribuzione</h1>
          <p style={styles.muted}>Dati compagnia non disponibili.</p>
        </section>
      </main>
    );
  }

  return (
    <DistributionDashboard
      airline={airline}
      routes={routes}
      onMixChange={onMixChange}
      onStartNDCMigration={onStartNDCMigration}
    />
  );
}

function DistributionDashboard({
  airline,
  routes,
  onMixChange,
  onStartNDCMigration,
}: {
  airline: PlayerAirline;
  routes: Route[];
  onMixChange?: (mix: ChannelMix) => void;
  onStartNDCMigration?: () => void;
}) {
  const { dispatch } = useGame();
  const [mix, setMix] = useState<ChannelMix>(() => initialMix(airline, routes));
  const summary = useMemo(
    () => calculateDistributionSummary(airline, routes, mix),
    [airline, mix, routes],
  );
  const recommendation = useMemo(
    () => optimizeChannelMix(airline, routes),
    [airline, routes],
  );
  const ndcPlan = useMemo(() => initiateNDCMigration(airline), [airline]);
  const unlockedChannels = DISTRIBUTION_CHANNEL_ORDER.filter(
    (channel) => airline.level >= DISTRIBUTION_CHANNELS[channel].min_level,
  );
  const allocated = totalAllocation(mix);

  function updateChannel(channel: DistributionChannel, value: number) {
    const next = rebalanceChannelMix(mix, channel, value, unlockedChannels);
    setMix(next);
    onMixChange?.(next);
  }

  function applyRecommendation() {
    setMix(recommendation.mix);
    onMixChange?.(recommendation.mix);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })} aria-label="Torna indietro">←</button>
        <div>
          <h1 style={styles.title}>Distribuzione</h1>
          <p style={styles.subtitle}>
            {airline.name} · Livello {airline.level}
          </p>
        </div>
        <div
          style={{
            ...styles.allocationBadge,
            color:
              Math.round(allocated) === 100
                ? "var(--color-success)"
                : "var(--color-danger)",
          }}
        >
          {Math.round(allocated)}% allocato
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.kpiGrid} aria-label="KPI distribuzione">
          <KpiCard
            label="Revenue netta"
            value={formatMoney(summary.net_revenue)}
            detail="mensile, dopo commissioni"
          />
          <KpiCard
            label="Costo distribuzione"
            value={`${summary.distribution_cost_pct.toFixed(1)}%`}
            detail={formatMoney(summary.distribution_cost)}
          />
          <KpiCard
            label="Ancillary medio"
            value={`${formatMoney(summary.ancillary_per_pax)}/pax`}
            detail="ponderato per channel mix"
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.eyebrow}>Channel mix</div>
              <h2 style={styles.sectionTitle}>Allocazione traffico</h2>
            </div>
            <button style={styles.recommendButton} onClick={applyRecommendation}>
              Applica mix ottimale
            </button>
          </div>

          <div style={styles.tableScroller}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.firstHeader}>Canale</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Traffico</th>
                  <th style={styles.tableHeader}>Costo medio</th>
                  <th style={styles.tableHeader}>Yield index</th>
                  <th style={styles.tableHeader}>Net revenue</th>
                  <th style={styles.tableHeader}>Ancillary/pax</th>
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_CHANNEL_ORDER.map((channel) => {
                  const definition = DISTRIBUTION_CHANNELS[channel];
                  const unlocked = airline.level >= definition.min_level;
                  const active =
                    airline.distribution.channels.includes(channel) ||
                    (mix[channel] ?? 0) > 0;
                  const metrics = summary.channels.find(
                    (item) => item.channel === channel,
                  );
                  return (
                    <tr
                      key={channel}
                      style={{
                        ...styles.tableRow,
                        opacity: unlocked ? 1 : 0.55,
                      }}
                    >
                      <td style={styles.channelCell}>
                        <strong style={styles.channelName}>
                          {definition.label}
                        </strong>
                        <span style={styles.channelType}>
                          {definition.passenger_type}
                        </span>
                      </td>
                      <td style={styles.cell}>
                        {unlocked ? (
                          <span
                            style={{
                              ...styles.status,
                              ...(active
                                ? styles.statusActive
                                : styles.statusAvailable),
                            }}
                          >
                            {active ? "Attivo" : "Disponibile"}
                          </span>
                        ) : (
                          <span style={styles.locked}>
                            🔒 Livello {definition.min_level} richiesto
                          </span>
                        )}
                      </td>
                      <td style={styles.sliderCell}>
                        <div style={styles.sliderLine}>
                          <input
                            aria-label={`${definition.label} traffico`}
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={mix[channel] ?? 0}
                            disabled={!unlocked}
                            onChange={(event) =>
                              updateChannel(channel, Number(event.target.value))
                            }
                            style={styles.slider}
                          />
                          <strong style={styles.trafficValue}>
                            {mix[channel] ?? 0}%
                          </strong>
                        </div>
                      </td>
                      <td style={styles.numericCell}>{definition.cost_pct}%</td>
                      <td style={styles.numericCell}>
                        {definition.yield_index}
                      </td>
                      <td style={styles.numericCell}>
                        {metrics ? formatMoney(metrics.net_revenue) : "—"}
                      </td>
                      <td style={styles.numericCell}>
                        {metrics
                          ? `${formatMoney(metrics.ancillary_per_pax)}/pax`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.recommendation}>
          <div>
            <div style={styles.eyebrow}>Raccomandazione engine</div>
            <p style={styles.recommendationText}>{recommendation.reason}</p>
          </div>
          <div style={styles.recommendationMetric}>
            <span>Net yield stimato</span>
            <strong>{recommendation.estimated_net_yield_index.toFixed(1)}</strong>
          </div>
        </section>

        {airline.level >= DISTRIBUTION_CHANNELS.NDC.min_level && (
          <section style={styles.ndcPanel}>
            <div style={styles.ndcHeader}>
              <div>
                <div style={styles.eyebrow}>Tecnologia distributiva</div>
                <h2 style={styles.sectionTitle}>Migrazione NDC</h2>
              </div>
              <span style={styles.ndcSaving}>
                <strong>80%</strong>
                <small>saving costi GDS</small>
              </span>
            </div>
            <p style={styles.ndcCopy}>
              Sostituisce gran parte del GDS legacy mantenendo accesso ad
              agenzie e TMC, con contenuto ricco e ancillary quasi diretto.
            </p>
            <div style={styles.progressTrack} aria-label="Progresso migrazione NDC">
              <div
                style={{
                  ...styles.progressBar,
                  width: `${((6 - ndcPlan.turns_remaining) / 6) * 100}%`,
                }}
              />
            </div>
            <div style={styles.ndcFooter}>
              <span>
                {ndcPlan.turns_remaining} turni rimanenti · investimento{" "}
                {formatMoney(ndcPlan.implementation_cost)}
              </span>
              {ndcPlan.status === "PLANNED" && (
                <button
                  style={styles.ndcButton}
                  disabled={!ndcPlan.eligible}
                  onClick={onStartNDCMigration}
                >
                  Avvia migrazione
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article style={styles.kpiCard}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
      <span style={styles.kpiDetail}>{detail}</span>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    color: "var(--color-text)",
  },
  header: {
    minHeight: "var(--header-height)",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-4)",
    padding: "var(--space-3) var(--space-page)",
  },
  backButton: {
    background: "none", border: "1px solid var(--color-border)", borderRadius: "50%",
    width: 32, height: 32, cursor: "pointer", color: "var(--color-text)", fontSize: 16, flexShrink: 0,
  },
  title: {
    fontSize: "var(--font-size-xl)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    marginTop: "var(--space-1)",
  },
  allocationBadge: {
    border: "1px solid currentColor",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    padding: "var(--space-2) var(--space-3)",
    whiteSpace: "nowrap",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    margin: "0 auto",
    maxWidth: "1200px",
    padding: "var(--space-4) var(--space-page) var(--space-8)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "var(--space-3)",
  },
  kpiCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    padding: "var(--space-4)",
  },
  kpiLabel: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  kpiValue: {
    color: "var(--color-accent)",
    fontSize: "var(--font-size-xl)",
  },
  kpiDetail: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  panel: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-4)",
    padding: "var(--space-4)",
  },
  eyebrow: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    marginBottom: "var(--space-1)",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: "var(--font-size-lg)",
  },
  recommendButton: {
    background: "var(--color-accent-dim)",
    border: "1px solid var(--color-accent)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-accent)",
    fontSize: "var(--font-size-sm)",
    fontWeight: 700,
    padding: "var(--space-2) var(--space-3)",
  },
  tableScroller: {
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    minWidth: "960px",
    width: "100%",
  },
  firstHeader: {
    borderTop: "1px solid var(--color-border)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    padding: "var(--space-3) var(--space-4)",
    textAlign: "left",
    textTransform: "uppercase",
  },
  tableHeader: {
    borderTop: "1px solid var(--color-border)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    padding: "var(--space-3)",
    textAlign: "right",
    textTransform: "uppercase",
  },
  tableRow: {
    borderTop: "1px solid var(--color-border)",
  },
  channelCell: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "165px",
    padding: "var(--space-3) var(--space-4)",
  },
  channelName: {
    fontSize: "var(--font-size-sm)",
  },
  channelType: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  cell: {
    padding: "var(--space-3)",
    whiteSpace: "nowrap",
  },
  numericCell: {
    fontSize: "var(--font-size-sm)",
    padding: "var(--space-3)",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  status: {
    borderRadius: "var(--radius-full)",
    display: "inline-block",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    padding: "3px 8px",
  },
  statusActive: {
    background: "var(--color-success-bg)",
    color: "var(--color-success)",
  },
  statusAvailable: {
    background: "var(--color-info-bg)",
    color: "var(--color-info)",
  },
  locked: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  sliderCell: {
    minWidth: "180px",
    padding: "var(--space-3)",
  },
  sliderLine: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  slider: {
    accentColor: "var(--color-accent)",
    minWidth: "120px",
    width: "100%",
  },
  trafficValue: {
    color: "var(--color-accent)",
    fontSize: "var(--font-size-sm)",
    minWidth: "38px",
    textAlign: "right",
  },
  recommendation: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-4)",
    padding: "var(--space-4)",
  },
  recommendationText: {
    color: "var(--color-text)",
    fontSize: "var(--font-size-sm)",
    lineHeight: 1.5,
    maxWidth: "720px",
  },
  recommendationMetric: {
    color: "var(--color-text-muted)",
    display: "flex",
    flexDirection: "column",
    fontSize: "var(--font-size-xs)",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  ndcPanel: {
    background:
      "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-2) 100%)",
    border: "1px solid var(--color-accent)",
    borderRadius: "var(--radius-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    padding: "var(--space-4)",
  },
  ndcHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-4)",
  },
  ndcSaving: {
    color: "var(--color-success)",
    display: "flex",
    flexDirection: "column",
    textAlign: "right",
  },
  ndcCopy: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    lineHeight: 1.5,
  },
  progressTrack: {
    background: "var(--color-surface-3)",
    borderRadius: "var(--radius-full)",
    height: "8px",
    overflow: "hidden",
  },
  progressBar: {
    background: "var(--color-accent)",
    borderRadius: "var(--radius-full)",
    height: "100%",
  },
  ndcFooter: {
    color: "var(--color-text-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    fontSize: "var(--font-size-xs)",
  },
  ndcButton: {
    background: "var(--color-accent)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-bg)",
    fontSize: "var(--font-size-sm)",
    fontWeight: 700,
    padding: "var(--space-2) var(--space-3)",
  },
  empty: {
    margin: "0 auto",
    maxWidth: "520px",
    padding: "var(--space-8) var(--space-page)",
  },
  muted: {
    color: "var(--color-text-muted)",
    marginTop: "var(--space-2)",
  },
};
