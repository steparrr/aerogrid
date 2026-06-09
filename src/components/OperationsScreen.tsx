import type { GameState, GameView, GameNotification } from "../domain/types";

interface Props {
  game: GameState;
  onNavigate: (view: GameView) => void;
}

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)
    return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function weeklyProfitLoss(game: GameState): number {
  const last = game.reports.weekly.at(-1);
  return last ? last.profit : 0;
}

function avgLoadFactor(game: GameState): string {
  if (!game.routes.length) return "—";
  const all = game.routes.flatMap(r => r.performanceHistory.map(p => p.loadFactor));
  if (!all.length) return "—";
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  return `${(avg * 100).toFixed(0)}%`;
}

function severityColor(s: GameNotification["severity"]): string {
  if (s === "error")   return "var(--color-danger)";
  if (s === "warning") return "var(--color-warning)";
  return "var(--color-accent)";
}

function severityBg(s: GameNotification["severity"]): string {
  if (s === "error")   return "var(--color-danger-bg)";
  if (s === "warning") return "var(--color-warning-bg)";
  return "var(--color-info-bg)";
}

export function OperationsScreen({ game, onNavigate }: Props) {
  const pl = weeklyProfitLoss(game);
  const plColor = pl >= 0 ? "var(--color-success)" : "var(--color-danger)";

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.airlineName}>{game.airlineName}</div>
          <div style={styles.headerDate}>{formatDate(game.currentDate)}</div>
        </div>
        <div style={styles.hubBadge}>{game.hubIata}</div>
      </header>

      {/* Corpo scrollabile */}
      <main style={styles.main}>

        {/* KPI grid */}
        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Cassa</div>
            <div style={{ ...styles.kpiValue, color: "var(--color-success)" }}>
              {formatCurrency(game.cash)}
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>P/L settimana</div>
            <div style={{ ...styles.kpiValue, color: plColor }}>
              {pl === 0 ? "—" : formatCurrency(pl)}
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Rotte attive</div>
            <div style={styles.kpiValue}>
              {game.routes.filter(r => r.status === "active").length}
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Aerei</div>
            <div style={styles.kpiValue}>{game.fleet.length}</div>
          </div>

          <div style={{ ...styles.kpiCard, gridColumn: "1 / -1" }}>
            <div style={styles.kpiLabel}>Load factor medio</div>
            <div style={styles.kpiValue}>{avgLoadFactor(game)}</div>
          </div>
        </div>

        {/* Notifiche */}
        {game.notifications.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Notifiche</div>
            <div style={styles.notifList}>
              {game.notifications.slice().reverse().map(n => (
                <div
                  key={n.id}
                  style={{
                    ...styles.notif,
                    background: severityBg(n.severity),
                    borderLeft: `3px solid ${severityColor(n.severity)}`,
                  }}
                >
                  <div style={{ ...styles.notifTitle, color: severityColor(n.severity) }}>
                    {n.title}
                  </div>
                  <div style={styles.notifMsg}>{n.message}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Call to action se è l'inizio */}
        {game.fleet.length === 0 && (
          <section style={styles.section}>
            <div style={styles.emptyCard}>
              <div style={styles.emptyIcon}>✈</div>
              <div style={styles.emptyTitle}>Inizia la tua compagnia</div>
              <p style={styles.emptyText}>
                Non hai ancora nessun aereo. Vai nella sezione Flotta per acquisire il primo aeromobile.
              </p>
              <button
                style={styles.ctaBtn}
                onClick={() => onNavigate("fleet")}
              >
                Vai alla Flotta →
              </button>
            </div>
          </section>
        )}

        <div style={{ height: "var(--nav-height)" }} />
      </main>

      {/* Bottom nav */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(item => {
          const active = game.currentView === item.view;
          return (
            <button
              key={item.view}
              style={{
                ...styles.navBtn,
                color: active ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
              onClick={() => onNavigate(item.view)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  header: {
    height: "var(--header-height)",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 var(--space-page)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  airlineName: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  headerDate: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    marginTop: 2,
  },
  hubBadge: {
    background: "var(--color-accent-dim)",
    color: "var(--color-accent)",
    border: "1px solid var(--color-accent)",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    padding: "2px 10px",
  },
  main: {
    flex: 1,
    padding: "var(--space-4) var(--space-page)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    overflowY: "auto",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-3)",
  },
  kpiCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  kpiLabel: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 500,
  },
  kpiValue: {
    fontSize: "var(--font-size-xl)",
    fontWeight: 700,
    color: "var(--color-text)",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  sectionTitle: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
  },
  notifList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  notif: {
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3) var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  notifTitle: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
  },
  notifMsg: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
  },
  emptyCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-8) var(--space-6)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  emptyIcon: {
    fontSize: "2.5rem",
  },
  emptyTitle: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  emptyText: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    maxWidth: 280,
  },
  ctaBtn: {
    background: "var(--color-accent)",
    color: "#0b1622",
    fontWeight: 700,
    fontSize: "var(--font-size-sm)",
    padding: "var(--space-3) var(--space-6)",
    borderRadius: "var(--radius-md)",
    border: "none",
    cursor: "pointer",
    marginTop: "var(--space-2)",
  },
  nav: {
    height: "var(--nav-height)",
    background: "var(--color-surface)",
    borderTop: "1px solid var(--color-border)",
    display: "flex",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    background: "none",
    border: "none",
    cursor: "pointer",
    transition: "color var(--transition-fast)",
  },
  navIcon: {
    fontSize: "1.25rem",
    lineHeight: 1,
  },
  navLabel: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 500,
  },
};
