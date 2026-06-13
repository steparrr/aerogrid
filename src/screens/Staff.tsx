import { useMemo, useState } from "react";
import { useGame } from "../game/gameContext";

import type { GameState, StaffMetrics } from "../domain/types";
import {
  calculatePilotRequirement,
  calculateStrikeRisk,
  getPilotCost,
  updateUnionMorale,
  type HRAction,
} from "../engine/staffEngine";

interface Props {
  game: GameState;
  onStaffChange?: (staff: StaffMetrics) => void;
}

const MONTHS = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function availablePilots(staff: StaffMetrics) {
  return (
    staff.pilots_available ??
    (staff.pilotsNarrow ?? 0) + (staff.pilotsWide ?? 0)
  );
}

function trainingPilots(staff: StaffMetrics) {
  return staff.pilots_in_training ?? 0;
}

function moraleOf(staff: StaffMetrics) {
  return clamp(staff.union_morale ?? staff.unionMorale ?? 50);
}

function strikeRiskOf(staff: StaffMetrics) {
  const stored = staff.strike_risk ?? staff.strikeRisk;

  if (stored === undefined) {
    return calculateStrikeRisk(staff);
  }

  return clamp(stored <= 1 ? stored * 100 : stored);
}

function monthsBetween(currentDate: string, expiryDate: string) {
  const current = new Date(`${currentDate}T00:00:00Z`);
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const years = expiry.getUTCFullYear() - current.getUTCFullYear();
  const months = expiry.getUTCMonth() - current.getUTCMonth();

  return Math.max(0, years * 12 + months);
}

function contractTurns(staff: StaffMetrics, currentDate: string) {
  if (staff.union_contract_expires_turn !== undefined) {
    return Math.max(0, staff.union_contract_expires_turn);
  }

  return staff.unionContractExpiresDate
    ? monthsBetween(currentDate, staff.unionContractExpiresDate)
    : 24;
}

function moneyCompact(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }

  return `$${Math.round(value)}`;
}

function riskTone(risk: number) {
  if (risk >= 50) return "var(--color-danger)";
  if (risk >= 25) return "var(--color-warning)";
  return "var(--color-success)";
}

function riskLabel(risk: number) {
  if (risk >= 50) return "Rischio sciopero alto";
  if (risk >= 25) return "Rischio sciopero medio";
  return "Rischio sciopero basso";
}

export function Staff({ game, onStaffChange }: Props) {
  const { dispatch } = useGame();
  const [staff, setStaff] = useState<StaffMetrics>(() => ({
    ...game.player.staff,
  }));
  const [additionalAircraft, setAdditionalAircraft] = useState(0);
  const requirement = useMemo(
    () => calculatePilotRequirement(game.fleet),
    [game.fleet],
  );
  const available = availablePilots(staff);
  const training = trainingPilots(staff);
  const morale = moraleOf(staff);
  const strikeRisk = strikeRiskOf(staff);
  const turnsRemaining = contractTurns(staff, game.currentDate);
  const additionalPilots = additionalAircraft * 11;
  const additionalAnnualCost =
    additionalPilots * getPilotCost("NARROW", "JUNIOR");
  const currentAnnualCost =
    requirement.narrow_body * getPilotCost("NARROW", "JUNIOR") +
    requirement.wide_body * getPilotCost("WIDE", "JUNIOR") +
    requirement.wide_lh * getPilotCost("WIDE_LH", "JUNIOR");

  function commitStaff(next: StaffMetrics) {
    setStaff(next);
    onStaffChange?.(next);
  }

  function applyMoraleActions(actions: HRAction[]) {
    commitStaff(updateUnionMorale(staff, actions));
  }

  function hirePilots() {
    commitStaff({ ...staff, pilots_available: available + 5 });
  }

  function startTraining() {
    commitStaff({ ...staff, pilots_in_training: training + 5 });
  }

  function renewContract(generous: boolean) {
    const renewed = {
      ...staff,
      union_contract_expires_turn: 48,
    };
    const actions: HRAction[] = [
      { type: "SALARY_RAISE" },
      { type: "BENEFITS_IMPROVED" },
    ];

    if (generous) {
      actions.push({ type: "PROFIT_SHARING_BONUS" });
    }

    commitStaff(updateUnionMorale(renewed, actions));
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })} aria-label="Torna indietro">←</button>
        <div>
          <h1 style={styles.title}>Staff e sindacati</h1>
          <div style={styles.subtitle}>
            {game.airlineName} · base {game.hubIata}
          </div>
        </div>
        <span style={styles.headerBadge}>HR CONTROL</span>
      </header>

      <main style={styles.main}>
        <section style={styles.kpiGrid} aria-label="Dashboard piloti">
          <MetricCard
            label="Piloti disponibili"
            value={available}
            tone={available >= requirement.total ? "success" : "danger"}
          />
          <MetricCard label="Piloti richiesti" value={requirement.total} />
          <MetricCard label="Piloti in formazione" value={training} tone="info" />
          <MetricCard
            label="Gap operativo"
            value={Math.max(0, requirement.total - available)}
            tone={available >= requirement.total ? "success" : "warning"}
          />
        </section>

        <section style={styles.splitGrid}>
          <article style={styles.panel}>
            <div style={styles.panelHeading}>
              <div>
                <div style={styles.eyebrow}>Relazione industriale</div>
                <h2 style={styles.panelTitle}>Morale sindacato</h2>
              </div>
              <strong
                aria-label="Morale sindacato"
                style={{ ...styles.heroValue, color: riskTone(100 - morale) }}
              >
                {morale}%
              </strong>
            </div>
            <MoraleSparkline morale={morale} />
            <div style={styles.progressTrack}>
              <span
                style={{
                  ...styles.progressFill,
                  width: `${morale}%`,
                  background: riskTone(100 - morale),
                }}
              />
            </div>
            <p style={styles.mutedText}>
              Staff satisfaction alimenta service quality, NPS e ricavi.
            </p>
          </article>

          <article style={styles.panel}>
            <div style={styles.eyebrow}>Contratto collettivo</div>
            <div style={styles.contractRow}>
              <div>
                <div style={styles.statLabel}>Scadenza</div>
                <strong style={styles.contractValue}>{turnsRemaining} turni</strong>
              </div>
              <div style={styles.riskBlock}>
                <div style={styles.statLabel}>{riskLabel(strikeRisk)}</div>
                <strong style={{ ...styles.contractValue, color: riskTone(strikeRisk) }}>
                  {Math.round(strikeRisk)}%
                </strong>
              </div>
            </div>
            <div style={styles.progressTrack}>
              <span
                style={{
                  ...styles.progressFill,
                  width: `${strikeRisk}%`,
                  background: riskTone(strikeRisk),
                }}
              />
            </div>
            <p style={styles.mutedText}>
              Sopra il 50% intervieni prima che lo sciopero cancelli il 70–90%
              dei voli.
            </p>
          </article>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeading}>
            <div>
              <div style={styles.eyebrow}>Leve del giocatore</div>
              <h2 style={styles.panelTitle}>Azioni HR</h2>
            </div>
          </div>
          <div style={styles.actionGrid}>
            <ActionCard
              title="Rinnovo moderato"
              detail="+15 salario · +5 benefit · 48 turni"
              onClick={() => renewContract(false)}
            />
            <ActionCard
              title="Rinnovo generoso"
              detail="Include profit sharing · morale +8 extra"
              onClick={() => renewContract(true)}
            />
            <ActionCard
              title="Assumi 5 piloti"
              detail="Pipeline certificati: 3–4 mesi"
              onClick={hirePilots}
            />
            <ActionCard
              title="Avvia formazione"
              detail="+5 piloti in type rating"
              onClick={startTraining}
            />
            <ActionCard
              title="Comunicazione CEO"
              detail="Morale +3 · nessun costo"
              onClick={() => applyMoraleActions([{ type: "COMMUNICATION_CAMPAIGN" }])}
            />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.projectionHeading}>
            <div>
              <div style={styles.eyebrow}>Scenario flotta</div>
              <h2 style={styles.panelTitle}>Proiezione costi staff 12 mesi</h2>
            </div>
            <label style={styles.scenarioControl}>
              <span>Aerei aggiuntivi</span>
              <input
                aria-label="Aerei aggiuntivi"
                type="number"
                min="0"
                max="50"
                value={additionalAircraft}
                onChange={(event) =>
                  setAdditionalAircraft(
                    clamp(Number(event.target.value) || 0, 0, 50),
                  )
                }
                style={styles.numberInput}
              />
            </label>
          </div>
          <div style={styles.scenarioSummary}>
            <strong>{additionalPilots} piloti aggiuntivi</strong>
            <span>{moneyCompact(additionalAnnualCost)} / anno</span>
          </div>
          <CostProjection
            monthlyBase={(currentAnnualCost + additionalAnnualCost) / 12}
          />
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const colors = {
    default: "var(--color-text)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
    info: "var(--color-info)",
  };

  return (
    <article style={styles.metricCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong aria-label={label} style={{ ...styles.metricValue, color: colors[tone] }}>
        {value}
      </strong>
    </article>
  );
}

function ActionCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={title} style={styles.actionCard} onClick={onClick}>
      <strong style={styles.actionTitle}>{title}</strong>
      <span style={styles.actionDetail}>{detail}</span>
    </button>
  );
}

function MoraleSparkline({ morale }: { morale: number }) {
  const points = [morale - 10, morale - 8, morale - 6, morale - 4, morale - 2, morale]
    .map((value) => clamp(value))
    .map((value, index) => `${index * 20},${100 - value}`)
    .join(" ");

  return (
    <svg
      aria-label="Trend morale 6 mesi"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.sparkline}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CostProjection({ monthlyBase }: { monthlyBase: number }) {
  const values = MONTHS.map((month, index) => ({
    month,
    value: monthlyBase * (1 + (index * 0.035) / 12),
  }));
  const maximum = Math.max(...values.map((item) => item.value), 1);

  return (
    <div style={styles.chart} aria-label="Proiezione mensile costi staff">
      {values.map(({ month, value }) => (
        <div key={month} style={styles.barColumn} title={`${month}: ${moneyCompact(value)}`}>
          <span
            style={{
              ...styles.bar,
              height: `${Math.max(8, (value / maximum) * 100)}%`,
            }}
          />
          <small style={styles.monthLabel}>{month}</small>
        </div>
      ))}
    </div>
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
    padding: "var(--space-3) var(--space-page)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
  },
  backButton: {
    background: "none", border: "1px solid var(--color-border)", borderRadius: "50%",
    width: 32, height: 32, cursor: "pointer", color: "var(--color-text)", fontSize: 16, flexShrink: 0,
  },
  title: { margin: 0, fontSize: "var(--font-size-xl)", lineHeight: 1.1 },
  subtitle: {
    marginTop: 4,
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  headerBadge: {
    padding: "4px 9px",
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--color-accent)",
    color: "var(--color-accent)",
    background: "var(--color-accent-dim)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 800,
  },
  main: {
    width: "min(1180px, 100%)",
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "var(--space-5) var(--space-page) var(--space-8)",
    display: "grid",
    gap: "var(--space-4)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "var(--space-3)",
  },
  metricCard: {
    padding: "var(--space-4)",
    display: "grid",
    gap: "var(--space-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-surface)",
  },
  metricValue: {
    fontSize: "var(--font-size-2xl)",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "var(--space-4)",
  },
  panel: {
    padding: "var(--space-4)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-surface)",
  },
  panelHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    marginBottom: "var(--space-3)",
  },
  eyebrow: {
    color: "var(--color-accent)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 800,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  panelTitle: {
    margin: "4px 0 0",
    fontSize: "var(--font-size-lg)",
  },
  heroValue: {
    fontSize: "var(--font-size-2xl)",
    fontVariantNumeric: "tabular-nums",
  },
  sparkline: {
    width: "100%",
    height: 72,
    display: "block",
    marginBottom: "var(--space-3)",
  },
  progressTrack: {
    display: "block",
    height: 8,
    overflow: "hidden",
    borderRadius: "var(--radius-full)",
    background: "var(--color-surface-3)",
  },
  progressFill: {
    display: "block",
    height: "100%",
    borderRadius: "var(--radius-full)",
    transition: "width var(--transition-normal)",
  },
  mutedText: {
    margin: "var(--space-3) 0 0",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    lineHeight: 1.5,
  },
  contractRow: {
    minHeight: 94,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "var(--space-4)",
  },
  riskBlock: { textAlign: "right" },
  statLabel: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  contractValue: {
    display: "block",
    marginTop: 5,
    fontSize: "var(--font-size-xl)",
    fontVariantNumeric: "tabular-nums",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "var(--space-3)",
  },
  actionCard: {
    minHeight: 94,
    padding: "var(--space-4)",
    display: "grid",
    alignContent: "center",
    gap: "var(--space-2)",
    textAlign: "left",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-surface-2)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  actionTitle: { color: "var(--color-accent)", fontSize: "var(--font-size-base)" },
  actionDetail: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
    lineHeight: 1.4,
  },
  projectionHeading: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "end",
    gap: "var(--space-4)",
  },
  scenarioControl: {
    display: "grid",
    gap: "var(--space-1)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  numberInput: {
    width: 100,
    padding: "8px 10px",
    boxSizing: "border-box",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--color-surface-2)",
    color: "var(--color-text)",
    font: "inherit",
  },
  scenarioSummary: {
    margin: "var(--space-4) 0",
    padding: "var(--space-3)",
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-accent-dim)",
    color: "var(--color-accent)",
    fontVariantNumeric: "tabular-nums",
  },
  chart: {
    height: 150,
    display: "flex",
    alignItems: "end",
    gap: "clamp(3px, 1vw, 10px)",
    paddingTop: "var(--space-3)",
  },
  barColumn: {
    height: "100%",
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "end",
    alignItems: "center",
    gap: 5,
  },
  bar: {
    width: "100%",
    maxWidth: 38,
    borderRadius: "4px 4px 0 0",
    background: "linear-gradient(180deg, var(--color-accent), var(--color-success))",
  },
  monthLabel: {
    color: "var(--color-text-faint)",
    fontSize: "clamp(8px, 1.4vw, 10px)",
  },
};
