import { useMemo, useState } from "react";
import { useGame } from "../game/gameContext";

import type { GameState, PlayerLevel } from "../domain/types";
import {
  LEVELS,
  checkLevelUp,
  getFeaturePrerequisite,
  getMilestoneProgress,
  getNextLevelProgress,
  getUnlockedFeatures,
  isFeatureUnlocked,
  type Feature,
  type MilestoneProgress,
  type ProgressMetric,
} from "../engine/progressionEngine";

interface Props {
  game: GameState;
}

type Tab = "levels" | "milestones";

const C = {
  bg: "#080E1A",
  surface: "#0F1829",
  surface2: "#0A1220",
  border: "#1E2D45",
  cyan: "#00C8FF",
  green: "#34D399",
  amber: "#F59E0B",
  red: "#F87171",
  text: "#E2E8F0",
  muted: "#94A3B8",
  dim: "#64748B",
} as const;

export function Progression({ game }: Props) {
  const { dispatch } = useGame();
  const [tab, setTab] = useState<Tab>("levels");
  const [selectedLevel, setSelectedLevel] = useState<PlayerLevel>(
    game.player.level,
  );
  const [showLevelUp, setShowLevelUp] = useState(true);
  const levelUp = useMemo(() => checkLevelUp(game), [game]);
  const nextProgress = useMemo(() => getNextLevelProgress(game), [game]);
  const milestones = useMemo(() => getMilestoneProgress(game), [game]);
  const selected = LEVELS[selectedLevel - 1];
  const selectedFeatures = getUnlockedFeatures(selectedLevel);
  const lockedFeatures = LEVELS.flatMap((level) =>
    getUnlockedFeatures(level.level),
  ).filter((feature) => !isFeatureUnlocked(feature.id, game));

  return (
    <div style={styles.page}>
      <style>
        {`@keyframes progression-unlock-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }`}
      </style>
      <header style={styles.header}>
        <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: C.text, fontSize: 16, flexShrink: 0 }} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })} aria-label="Torna indietro">←</button>
        <div>
          <div style={styles.brandLine}>AEROGRID · PROGRESSIONE</div>
          <h1 style={styles.title}>Progressione</h1>
          <div style={styles.subtitle}>Livelli, sblocchi e milestone operative</div>
        </div>
        <div style={styles.headerMetrics}>
          <HeaderMetric
            label="LIVELLO"
            value={`L${game.player.level} ${LEVELS[game.player.level - 1].name}`}
            color={LEVELS[game.player.level - 1].color}
          />
          <HeaderMetric label="TURNO" value={String(game.turn)} />
          <HeaderMetric
            label="ROTTE"
            value={String(game.routes.filter((route) => route.status === "active").length)}
          />
          <HeaderMetric label="AEREI" value={String(game.fleet.length)} />
        </div>
      </header>

      <nav style={styles.tabs} aria-label="Sezioni progressione">
        <TabButton active={tab === "levels"} onClick={() => setTab("levels")}>
          Livelli & Sblocchi
        </TabButton>
        <TabButton
          active={tab === "milestones"}
          onClick={() => setTab("milestones")}
        >
          Milestone
        </TabButton>
      </nav>

      <main style={styles.main}>
        {tab === "levels" ? (
          <>
            <section style={styles.panel}>
              <div style={styles.sectionLabel}>MAPPA PROGRESSIONE</div>
              <div style={styles.levelRail}>
                {LEVELS.map((level, index) => {
                  const reached = level.level <= game.player.level;
                  const current = level.level === game.player.level;
                  return (
                    <div key={level.level} style={styles.levelStep}>
                      <button
                        aria-label={`Livello ${level.level} ${level.name}`}
                        onClick={() => setSelectedLevel(level.level)}
                        style={{
                          ...styles.levelNode,
                          borderColor: reached ? level.color : C.border,
                          color: reached ? level.color : C.dim,
                          background: current ? `${level.color}18` : C.surface2,
                          boxShadow: current ? `0 0 18px ${level.color}44` : "none",
                        }}
                      >
                        {reached && !current ? "✓" : level.level}
                      </button>
                      <span
                        style={{
                          ...styles.levelName,
                          color: reached ? level.color : C.dim,
                        }}
                      >
                        {level.name}
                      </span>
                      {index < LEVELS.length - 1 && (
                        <i
                          style={{
                            ...styles.levelConnector,
                            background:
                              level.level < game.player.level
                                ? level.color
                                : C.border,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {nextProgress ? (
                <div style={styles.nextBlock}>
                  <div style={styles.nextHeading}>
                    <div>
                      <div style={styles.sectionLabel}>
                        PROGRESSO VERSO L{nextProgress.targetLevel}
                      </div>
                      <strong style={{ color: LEVELS[nextProgress.targetLevel - 1].color }}>
                        {nextProgress.targetName}
                      </strong>
                    </div>
                    <span style={styles.percent}>{nextProgress.overallPercent}%</span>
                  </div>
                  <p style={styles.condition}>{nextProgress.condition}</p>
                  <div style={styles.metricGrid}>
                    {nextProgress.metrics.map((item) => (
                      <MetricCard key={item.id} metric={item} />
                    ))}
                  </div>
                  <div style={styles.recommendation}>
                    <span style={styles.recommendationMark}>↗</span>
                    <span>{nextProgress.recommendation}</span>
                  </div>
                </div>
              ) : (
                <div style={styles.recommendation}>
                  Tutti i livelli sono stati raggiunti. AeroGrid opera su scala globale.
                </div>
              )}
            </section>

            <section style={styles.detailGrid}>
              <article style={styles.panel}>
                <div style={styles.levelDetailHeading}>
                  <span
                    style={{
                      ...styles.levelDot,
                      background: selected.color,
                    }}
                  />
                  <div>
                    <div style={{ ...styles.sectionLabel, color: selected.color }}>
                      L{selected.level} {selected.name}
                    </div>
                    <p style={styles.description}>{selected.description}</p>
                  </div>
                </div>
                <div style={styles.featureList}>
                  {selectedFeatures.map((item) => (
                    <FeatureRow key={item.id} feature={item} unlocked />
                  ))}
                </div>
              </article>

              <article style={styles.panel}>
                <div style={styles.sectionLabel}>PROSSIMI SBLOCCHI</div>
                <div style={styles.featureList}>
                  {lockedFeatures.length > 0 ? (
                    lockedFeatures.map((item) => (
                      <FeatureRow
                        key={item.id}
                        feature={item}
                        unlocked={false}
                        prerequisite={getFeaturePrerequisite(item.id, game) ?? ""}
                      />
                    ))
                  ) : (
                    <div style={styles.completeState}>✓ Tutte le feature sono sbloccate.</div>
                  )}
                </div>
              </article>
            </section>
          </>
        ) : (
          <MilestoneTimeline milestones={milestones} turn={game.turn} />
        )}
      </main>

      {levelUp && showLevelUp && (
        <LevelUpCard levelUp={levelUp} onDismiss={() => setShowLevelUp(false)} />
      )}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
  color = C.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={styles.headerMetric}>
      <span style={styles.headerMetricLabel}>{label}</span>
      <strong style={{ ...styles.headerMetricValue, color }}>{value}</strong>
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
      onClick={onClick}
      style={{
        ...styles.tabButton,
        color: active ? C.cyan : C.muted,
        borderBottomColor: active ? C.cyan : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function MetricCard({ metric }: { metric: ProgressMetric }) {
  const progress = Math.min(100, Math.max(0, (metric.current / metric.target) * 100));
  const tone = metric.complete ? C.green : C.amber;

  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTopline}>
        <span>{metric.label}</span>
        <strong style={{ color: tone }}>
          {formatMetric(metric.current, metric.unit)} / {formatMetric(metric.target, metric.unit)}
        </strong>
      </div>
      <div style={styles.progressTrack}>
        <i style={{ ...styles.progressFill, width: `${progress}%`, background: tone }} />
      </div>
    </div>
  );
}

function FeatureRow({
  feature,
  unlocked,
  prerequisite,
}: {
  feature: Feature;
  unlocked: boolean;
  prerequisite?: string;
}) {
  if (unlocked) {
    return (
      <div style={styles.featureActive}>
        <span style={{ color: C.green }}>✓</span>
        <span>
          <strong style={styles.featureTitle}>{feature.label}</strong>
          <small style={styles.featureDescription}>{feature.description}</small>
        </span>
      </div>
    );
  }

  return (
    <button
      aria-label={`${feature.label} · ${prerequisite}`}
      title={prerequisite}
      style={styles.featureLocked}
    >
      <span style={styles.lockMark}>🔒</span>
      <span>
        <strong style={{ ...styles.featureTitle, color: C.muted }}>
          {feature.label}
        </strong>
        <small style={styles.prerequisite}>🔒 {prerequisite}</small>
      </span>
    </button>
  );
}

function MilestoneTimeline({
  milestones,
  turn,
}: {
  milestones: MilestoneProgress[];
  turn: number;
}) {
  const achieved = milestones.filter((item) => item.status === "ACHIEVED").length;
  let currentAssigned = false;

  return (
    <section style={styles.panel}>
      <div style={styles.milestoneHeader}>
        <div>
          <div style={styles.sectionLabel}>TIMELINE MILESTONE</div>
          <h2 style={styles.panelTitle}>Traguardi della compagnia</h2>
        </div>
        <div style={styles.milestoneCount}>
          <strong>{achieved}/{milestones.length}</strong>
          <span>raggiunte · turno {turn}</span>
        </div>
      </div>

      <div style={styles.timeline}>
        {milestones.map((item) => {
          const isCurrent = item.status === "IN_PROGRESS" && !currentAssigned;
          if (isCurrent) currentAssigned = true;
          return (
            <MilestoneItem
              key={item.id}
              milestone={item}
              current={isCurrent}
            />
          );
        })}
      </div>
    </section>
  );
}

function MilestoneItem({
  milestone,
  current,
}: {
  milestone: MilestoneProgress;
  current: boolean;
}) {
  const tone =
    milestone.status === "ACHIEVED"
      ? C.green
      : milestone.status === "LOCKED"
        ? C.dim
        : C.amber;
  const progress = Math.min(100, Math.max(0, (milestone.current / milestone.target) * 100));

  return (
    <article
      style={{
        ...styles.milestone,
        borderColor: `${tone}55`,
        opacity: milestone.status === "LOCKED" ? 0.65 : 1,
      }}
    >
      <i style={{ ...styles.timelineDot, background: tone }} />
      <div style={styles.milestoneTopline}>
        <div>
          <h3 style={{ ...styles.milestoneTitle, color: tone }}>{milestone.title}</h3>
          <p style={styles.description}>{milestone.description}</p>
        </div>
        <span style={{ ...styles.statusBadge, color: tone, borderColor: `${tone}66` }}>
          {milestone.status === "ACHIEVED"
            ? "✓ RAGGIUNTA"
            : milestone.status === "LOCKED"
              ? `🔒 Disponibile al Livello ${milestone.requiredLevel}`
              : current
                ? "IN CORSO"
                : "PROSSIMA"}
        </span>
      </div>

      {milestone.status !== "LOCKED" && milestone.status !== "ACHIEVED" && (
        <div style={styles.milestoneProgress}>
          <div style={styles.metricTopline}>
            <span>Progresso</span>
            <strong style={{ color: tone }}>
              {formatMetric(milestone.current, milestone.unit)} /{" "}
              {formatMetric(milestone.target, milestone.unit)}
            </strong>
          </div>
          <div style={styles.progressTrack}>
            <i style={{ ...styles.progressFill, width: `${progress}%`, background: tone }} />
          </div>
        </div>
      )}

      <div style={styles.reward}>Ricompensa: {milestone.reward}</div>
      {milestone.status === "ACHIEVED" && (
        <blockquote style={{ ...styles.narrative, borderLeftColor: tone }}>
          “{milestone.narrative}”
        </blockquote>
      )}
    </article>
  );
}

function LevelUpCard({
  levelUp,
  onDismiss,
}: {
  levelUp: NonNullable<ReturnType<typeof checkLevelUp>>;
  onDismiss: () => void;
}) {
  const color = LEVELS[levelUp.newLevel - 1].color;

  return (
    <aside
      role="dialog"
      aria-label="Nuovo livello"
      style={{ ...styles.levelUpCard, borderColor: color }}
    >
      <div style={{ ...styles.sectionLabel, color }}>NUOVO LIVELLO</div>
      <h2 style={{ ...styles.levelUpTitle, color }}>{levelUp.title}</h2>
      <p style={styles.description}>{levelUp.description}</p>
      <div style={styles.unlockAnimationList}>
        {levelUp.unlockedFeatures.map((item, index) => (
          <div
            key={item.id}
            style={{
              ...styles.unlockAnimationItem,
              animationDelay: `${index * 70}ms`,
            }}
          >
            <span style={{ color: C.green }}>✓</span> {item.label}
          </div>
        ))}
      </div>
      {levelUp.nextObjective && (
        <div style={styles.nextObjective}>Prossimo obiettivo: {levelUp.nextObjective}</div>
      )}
      <button style={styles.dismissButton} onClick={onDismiss}>
        Continua a giocare
      </button>
    </aside>
  );
}

function formatMetric(value: number, unit: string) {
  if (unit === "$") {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    return `$${(value / 1_000_000).toFixed(value === 0 ? 0 : 1)}M`;
  }
  const displayed = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${displayed}${unit}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "14px clamp(14px, 3vw, 28px)",
    borderBottom: `1px solid ${C.border}`,
    background: "#0A1628",
    flexWrap: "wrap",
  },
  brandLine: {
    color: C.cyan,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 22,
    lineHeight: 1.1,
  },
  subtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 3,
  },
  headerMetrics: {
    display: "flex",
    gap: "clamp(12px, 3vw, 28px)",
    marginLeft: "auto",
    flexWrap: "wrap",
  },
  headerMetric: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    textAlign: "right",
  },
  headerMetricLabel: {
    color: C.dim,
    fontSize: 8,
    fontWeight: 700,
  },
  headerMetricValue: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  },
  tabs: {
    display: "flex",
    padding: "0 clamp(14px, 3vw, 28px)",
    borderBottom: `1px solid ${C.border}`,
    background: C.surface2,
  },
  tabButton: {
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    padding: "11px 14px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  main: {
    width: "min(1180px, 100%)",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "18px clamp(12px, 3vw, 28px) 48px",
  },
  panel: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 14,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  levelRail: {
    display: "flex",
    overflowX: "auto",
    padding: "18px 4px 12px",
  },
  levelStep: {
    position: "relative",
    display: "flex",
    flex: "1 0 112px",
    alignItems: "center",
    flexDirection: "column",
    gap: 6,
  },
  levelNode: {
    position: "relative",
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "2px solid",
    fontWeight: 900,
    cursor: "pointer",
  },
  levelName: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  levelConnector: {
    position: "absolute",
    zIndex: 1,
    top: 21,
    left: "calc(50% + 22px)",
    width: "calc(100% - 44px)",
    height: 2,
  },
  nextBlock: {
    borderTop: `1px solid ${C.border}`,
    paddingTop: 14,
  },
  nextHeading: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  percent: {
    color: C.cyan,
    fontSize: 22,
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  condition: {
    color: C.muted,
    fontSize: 11,
    margin: "6px 0 10px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8,
  },
  metricCard: {
    background: C.surface2,
    borderRadius: 8,
    padding: "9px 10px",
  },
  metricTopline: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: C.muted,
    fontSize: 9,
    fontVariantNumeric: "tabular-nums",
    marginBottom: 5,
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    background: "#070C16",
    overflow: "hidden",
  },
  progressFill: {
    display: "block",
    height: "100%",
    borderRadius: 99,
    transition: "width 300ms ease",
  },
  recommendation: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    borderLeft: `2px solid ${C.cyan}`,
    padding: "8px 10px",
    background: `${C.cyan}0D`,
    color: C.text,
    fontSize: 11,
    lineHeight: 1.5,
  },
  recommendationMark: {
    color: C.cyan,
    fontSize: 15,
    fontWeight: 900,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
    gap: 14,
  },
  levelDetailHeading: {
    display: "flex",
    gap: 9,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  levelDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    marginTop: 3,
    flexShrink: 0,
  },
  description: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 1.5,
    margin: "3px 0 0",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 460,
    overflowY: "auto",
    marginTop: 10,
  },
  featureActive: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 7,
    background: C.surface2,
    padding: "8px 9px",
  },
  featureLocked: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    width: "100%",
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    background: "#070C16",
    padding: "8px 9px",
    textAlign: "left",
    cursor: "pointer",
  },
  featureTitle: {
    display: "block",
    color: C.text,
    fontSize: 10,
  },
  featureDescription: {
    display: "block",
    color: C.muted,
    fontSize: 9,
    marginTop: 2,
  },
  prerequisite: {
    display: "block",
    color: C.amber,
    fontSize: 8,
    lineHeight: 1.45,
    marginTop: 3,
  },
  lockMark: {
    fontSize: 10,
    flexShrink: 0,
  },
  completeState: {
    color: C.green,
    fontSize: 11,
    padding: 10,
  },
  milestoneHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 17,
    margin: "3px 0 0",
  },
  milestoneCount: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    color: C.cyan,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: 12,
  },
  timeline: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    paddingLeft: 19,
    borderLeft: `1px solid ${C.border}`,
  },
  milestone: {
    position: "relative",
    background: C.surface2,
    border: "1px solid",
    borderRadius: 10,
    padding: "12px 13px",
  },
  timelineDot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: "50%",
    left: -24,
    top: 16,
    boxShadow: `0 0 0 4px ${C.bg}`,
  },
  milestoneTopline: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  milestoneTitle: {
    fontSize: 13,
    margin: 0,
  },
  statusBadge: {
    flexShrink: 0,
    border: "1px solid",
    borderRadius: 5,
    padding: "3px 7px",
    fontSize: 8,
    fontWeight: 900,
  },
  milestoneProgress: {
    marginTop: 10,
  },
  reward: {
    color: C.text,
    fontSize: 9,
    marginTop: 9,
  },
  narrative: {
    color: C.muted,
    fontSize: 10,
    fontStyle: "italic",
    borderLeft: "2px solid",
    margin: "9px 0 0",
    paddingLeft: 8,
  },
  levelUpCard: {
    position: "fixed",
    zIndex: 20,
    right: 16,
    bottom: 16,
    width: "min(390px, calc(100vw - 32px))",
    boxSizing: "border-box",
    border: "1px solid",
    borderRadius: 12,
    padding: 16,
    background: "#0A1628",
    boxShadow: "0 18px 60px rgba(0,0,0,.45)",
  },
  levelUpTitle: {
    fontSize: 22,
    margin: "3px 0 0",
  },
  unlockAnimationList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 170,
    overflowY: "auto",
    marginTop: 10,
  },
  unlockAnimationItem: {
    padding: "5px 7px",
    borderRadius: 5,
    background: C.surface,
    color: C.text,
    fontSize: 9,
    animation: "progression-unlock-in 280ms ease both",
  },
  nextObjective: {
    color: C.amber,
    fontSize: 9,
    lineHeight: 1.45,
    marginTop: 10,
  },
  dismissButton: {
    width: "100%",
    border: "none",
    borderRadius: 7,
    background: C.cyan,
    color: C.bg,
    padding: "9px 12px",
    marginTop: 12,
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
};
