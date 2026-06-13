import { useMemo, useState } from "react";

import {
  getMissionById,
  getMissionStatus,
  MISSIONS,
  type Mission,
  type MissionAvailability,
  type MissionCategory,
  type MissionMedal,
  type MissionProgress,
} from "../engine/missionEngine";

export interface MissionsProps {
  progress?: MissionProgress;
  onStartMission?: (mission: Mission) => void;
}

const CATEGORY_META: Record<
  MissionCategory,
  { icon: string; label: string; color: string }
> = {
  TUTORIAL: { icon: "T", label: "Tutorial", color: "var(--color-accent)" },
  CRISIS: { icon: "C", label: "Crisi", color: "var(--color-danger)" },
  TURNAROUND: { icon: "R", label: "Turnaround", color: "var(--color-warning)" },
  EXPANSION: { icon: "E", label: "Espansione", color: "var(--color-success)" },
  SUSTAINABILITY: {
    icon: "G",
    label: "Sostenibilità",
    color: "var(--color-success)",
  },
};

const MEDAL_META: Record<MissionMedal, { label: string; color: string }> = {
  BRONZE: { label: "Bronzo", color: "#c98552" },
  SILVER: { label: "Argento", color: "#b8c4d4" },
  GOLD: { label: "Oro", color: "#f4c95d" },
};

const STATUS_LABEL: Record<MissionAvailability, string> = {
  LOCKED: "Bloccata",
  AVAILABLE: "Disponibile",
  COMPLETED: "Completata",
};

export function Missions({
  progress = {},
  onStartMission = () => undefined,
}: MissionsProps) {
  const firstSelectable = useMemo(
    () =>
      MISSIONS.find(
        (mission) => getMissionStatus(mission, progress).state !== "LOCKED",
      ) ?? MISSIONS[0],
    [progress],
  );
  const [selectedCode, setSelectedCode] = useState(firstSelectable.code);
  const selectedMission = getMissionById(selectedCode);
  const selectedStatus = getMissionStatus(selectedMission, progress);
  const completedCount = MISSIONS.filter(
    (mission) => getMissionStatus(mission, progress).state === "COMPLETED",
  ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Missioni</h1>
          <p style={styles.subtitle}>
            Scenari guidati per dominare ogni sistema di AeroGrid.
          </p>
        </div>
        <div style={styles.completion}>
          <strong style={styles.completionValue}>{completedCount}/5</strong>
          <span style={styles.completionLabel}>completate</span>
        </div>
      </header>

      <main style={styles.main}>
        <section aria-label="Catalogo missioni" style={styles.catalog}>
          {MISSIONS.map((mission) => {
            const status = getMissionStatus(mission, progress);
            const category = CATEGORY_META[mission.category];
            const selected = selectedCode === mission.code;
            return (
              <button
                key={mission.id}
                aria-label={`${mission.code} ${mission.title}`}
                disabled={status.state === "LOCKED"}
                style={{
                  ...styles.card,
                  ...(selected ? styles.cardSelected : {}),
                  ...(status.state === "LOCKED" ? styles.cardLocked : {}),
                }}
                onClick={() => setSelectedCode(mission.code)}
              >
                <span style={styles.cardTopline}>
                  <span
                    aria-hidden="true"
                    style={{
                      ...styles.categoryIcon,
                      color: category.color,
                      borderColor: category.color,
                    }}
                  >
                    {category.icon}
                  </span>
                  <span style={{ ...styles.categoryLabel, color: category.color }}>
                    {category.label}
                  </span>
                  <span
                    style={{
                      ...styles.status,
                      ...statusStyle(status.state),
                    }}
                  >
                    {STATUS_LABEL[status.state]}
                  </span>
                </span>

                <span style={styles.cardCode}>{mission.code}</span>
                <span style={styles.cardTitle}>{mission.title}</span>
                <span style={styles.cardSubtitle}>{mission.subtitle}</span>

                <span style={styles.cardMeta}>
                  <span aria-label={`${mission.difficulty} stelle`}>
                    {difficultyStars(mission.difficulty)}
                  </span>
                  <span>{mission.turns_limit} turni</span>
                </span>

                {status.best_medal && <Medal medal={status.best_medal} />}
                {status.prerequisite && (
                  <span style={styles.prerequisite}>
                    Completa {status.prerequisite} prima
                  </span>
                )}
              </button>
            );
          })}
        </section>

        <MissionPreview
          mission={selectedMission}
          status={selectedStatus.state}
          medal={selectedStatus.best_medal}
          onStart={() => onStartMission(selectedMission)}
        />
      </main>
    </div>
  );
}

function MissionPreview({
  mission,
  status,
  medal,
  onStart,
}: {
  mission: Mission;
  status: MissionAvailability;
  medal: MissionMedal | null;
  onStart: () => void;
}) {
  const category = CATEGORY_META[mission.category];
  return (
    <section style={styles.preview} aria-label={`Anteprima ${mission.code}`}>
      <div style={styles.previewHeader}>
        <div>
          <div style={{ ...styles.previewCategory, color: category.color }}>
            {mission.code} · {category.label}
          </div>
          <h2 style={styles.previewTitle}>{mission.title}</h2>
          <p style={styles.previewNarrative}>{mission.narrative}</p>
        </div>
        <div style={styles.turnLimit}>
          <strong>{mission.turns_limit}</strong>
          <span>turni</span>
        </div>
      </div>

      <div style={styles.previewGrid}>
        <div>
          <h3 style={styles.sectionTitle}>Obiettivi</h3>
          <div style={styles.objectives}>
            {mission.objectives.map((objective) => (
              <div key={objective.id} style={styles.objective}>
                <span style={styles.objectiveMarker} />
                <span>
                  <strong style={styles.objectiveText}>
                    {objective.description}
                  </strong>
                  <small style={styles.objectiveDeadline}>
                    Entro il turno {objective.deadline_turn}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={styles.sectionTitle}>Valutazione</h3>
          <div style={styles.ratings}>
            <RatingRow medal="BRONZE" condition={mission.bronze_condition} />
            <RatingRow medal="SILVER" condition={mission.silver_condition} />
            <RatingRow medal="GOLD" condition={mission.gold_condition} />
          </div>
        </div>
      </div>

      {mission.tutorial_steps && (
        <div style={styles.tutorial}>
          <h3 style={styles.sectionTitle}>Guida passo-passo</h3>
          <ol style={styles.tutorialList}>
            {mission.tutorial_steps.map((step) => (
              <li key={step} style={styles.tutorialStep}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div style={styles.previewFooter}>
        {status === "AVAILABLE" && (
          <button
            style={styles.startButton}
            onClick={onStart}
            aria-label={`Inizia ${mission.code}`}
          >
            Inizia missione
          </button>
        )}
        {status === "COMPLETED" && medal && (
          <div style={styles.completedMessage}>
            Miglior risultato <Medal medal={medal} />
          </div>
        )}
        {status === "LOCKED" && (
          <div style={styles.lockedMessage}>Missione non ancora disponibile</div>
        )}
      </div>
    </section>
  );
}

function RatingRow({
  medal,
  condition,
}: {
  medal: MissionMedal;
  condition: string;
}) {
  return (
    <div style={styles.ratingRow}>
      <Medal medal={medal} />
      <span style={styles.ratingCondition}>{condition}</span>
    </div>
  );
}

function Medal({ medal }: { medal: MissionMedal }) {
  const meta = MEDAL_META[medal];
  return (
    <span
      style={{
        ...styles.medal,
        color: meta.color,
        borderColor: meta.color,
        background: `${meta.color}18`,
      }}
    >
      {meta.label}
    </span>
  );
}

function difficultyStars(difficulty: Mission["difficulty"]) {
  return `${"★".repeat(difficulty)}${"☆".repeat(3 - difficulty)}`;
}

function statusStyle(status: MissionAvailability) {
  if (status === "COMPLETED") {
    return {
      color: "var(--color-success)",
      background: "var(--color-success-bg)",
    };
  }
  if (status === "LOCKED") {
    return {
      color: "var(--color-text-muted)",
      background: "var(--color-surface-2)",
    };
  }
  return {
    color: "var(--color-accent)",
    background: "var(--color-accent-dim)",
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.12), transparent 30%), var(--color-bg)",
    color: "var(--color-text)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "var(--space-5)",
    padding: "clamp(1.5rem, 4vw, 3.5rem)",
    borderBottom: "1px solid var(--color-border)",
  },
  title: {
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    maxWidth: "36rem",
    marginTop: "var(--space-2)",
    color: "var(--color-text-muted)",
    lineHeight: 1.6,
  },
  completion: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
  },
  completionValue: {
    fontSize: "var(--font-size-2xl)",
    color: "var(--color-accent)",
    fontVariantNumeric: "tabular-nums",
  },
  completionLabel: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
  },
  main: {
    display: "grid",
    gap: "var(--space-8)",
    padding: "clamp(1rem, 4vw, 3.5rem)",
    maxWidth: "90rem",
    margin: "0 auto",
  },
  catalog: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
    gap: "var(--space-4)",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    minHeight: "17rem",
    padding: "var(--space-5)",
    color: "var(--color-text)",
    textAlign: "left",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    transition:
      "transform var(--transition-normal), border-color var(--transition-normal), background var(--transition-normal)",
  },
  cardSelected: {
    transform: "translateY(-3px)",
    borderColor: "var(--color-accent)",
    background:
      "linear-gradient(145deg, var(--color-surface-2), var(--color-surface))",
  },
  cardLocked: {
    cursor: "not-allowed",
    opacity: 0.58,
  },
  cardTopline: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    marginBottom: "var(--space-6)",
  },
  categoryIcon: {
    display: "inline-grid",
    placeItems: "center",
    width: "1.75rem",
    height: "1.75rem",
    border: "1px solid",
    borderRadius: "var(--radius-sm)",
    fontWeight: "var(--font-weight-bold)",
    fontSize: "var(--font-size-sm)",
  },
  categoryLabel: {
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  status: {
    marginLeft: "auto",
    padding: "0.25rem 0.45rem",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-semibold)",
  },
  cardCode: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "0.12em",
  },
  cardTitle: {
    marginTop: "var(--space-1)",
    fontSize: "var(--font-size-xl)",
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "-0.02em",
  },
  cardSubtitle: {
    marginTop: "var(--space-2)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    lineHeight: 1.45,
  },
  cardMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    marginTop: "auto",
    paddingTop: "var(--space-6)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
  },
  prerequisite: {
    marginTop: "var(--space-3)",
    color: "var(--color-warning)",
    fontSize: "var(--font-size-xs)",
  },
  medal: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: "0.2rem 0.5rem",
    border: "1px solid",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-bold)",
  },
  preview: {
    padding: "clamp(1.25rem, 3vw, 2rem)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--space-6)",
    paddingBottom: "var(--space-6)",
    borderBottom: "1px solid var(--color-border)",
  },
  previewCategory: {
    marginBottom: "var(--space-2)",
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  previewTitle: {
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
    letterSpacing: "-0.03em",
  },
  previewNarrative: {
    maxWidth: "52rem",
    marginTop: "var(--space-3)",
    color: "var(--color-text-muted)",
    lineHeight: 1.6,
  },
  turnLimit: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    color: "var(--color-accent)",
    flexShrink: 0,
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
    gap: "var(--space-8)",
    paddingTop: "var(--space-6)",
  },
  sectionTitle: {
    marginBottom: "var(--space-4)",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  objectives: {
    display: "grid",
    gap: "var(--space-3)",
  },
  objective: {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    padding: "var(--space-3)",
    background: "var(--color-surface-2)",
    borderRadius: "var(--radius-md)",
  },
  objectiveMarker: {
    width: "0.55rem",
    height: "0.55rem",
    marginTop: "0.35rem",
    border: "2px solid var(--color-accent)",
    borderRadius: "50%",
    flexShrink: 0,
  },
  objectiveText: {
    display: "block",
    fontSize: "var(--font-size-sm)",
  },
  objectiveDeadline: {
    display: "block",
    marginTop: "var(--space-1)",
    color: "var(--color-text-muted)",
  },
  ratings: {
    display: "grid",
    gap: "var(--space-3)",
  },
  ratingRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: "var(--space-3)",
    paddingBottom: "var(--space-3)",
    borderBottom: "1px solid var(--color-border)",
  },
  ratingCondition: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    lineHeight: 1.45,
  },
  tutorial: {
    marginTop: "var(--space-8)",
    padding: "var(--space-5)",
    background: "var(--color-accent-dim)",
    borderRadius: "var(--radius-md)",
  },
  tutorialList: {
    display: "grid",
    gap: "var(--space-2)",
    margin: 0,
    paddingLeft: "1.25rem",
  },
  tutorialStep: {
    paddingLeft: "var(--space-2)",
    color: "var(--color-text-muted)",
    lineHeight: 1.5,
  },
  previewFooter: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "var(--space-8)",
    paddingTop: "var(--space-5)",
    borderTop: "1px solid var(--color-border)",
  },
  startButton: {
    padding: "0.8rem 1.2rem",
    color: "var(--color-bg)",
    background: "var(--color-accent)",
    borderRadius: "var(--radius-md)",
    fontWeight: "var(--font-weight-bold)",
  },
  completedMessage: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    color: "var(--color-text-muted)",
  },
  lockedMessage: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
  },
};

export const MissionsScreen = Missions;
