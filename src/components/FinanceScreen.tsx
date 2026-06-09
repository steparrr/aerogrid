import type { GameState, GameView, DailyFinancialReport, WeeklyFinancialReport } from "../domain/types";

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

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function profitColor(n: number): string {
  if (n > 0) return "var(--color-success)";
  if (n < 0) return "var(--color-danger)";
  return "var(--color-text-muted)";
}

/* ---- aggregati su tutti i daily report disponibili ---- */
function sumReports(reports: DailyFinancialReport[]) {
  return reports.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      costs:   acc.costs   + r.costs,
      profit:  acc.profit  + r.profit,
      passengers: acc.passengers + r.passengers,
    }),
    { revenue: 0, costs: 0, profit: 0, passengers: 0 },
  );
}

function avgMetric(reports: DailyFinancialReport[], key: "cask" | "rask" | "operatingMargin"): number {
  if (!reports.length) return 0;
  return reports.reduce((a, r) => a + r[key], 0) / reports.length;
}

/* ---- rotte migliori/peggiori ---- */
function routeRanking(game: GameState) {
  return game.routes
    .filter(r => r.performanceHistory.length > 0)
    .map(r => {
      const avg = r.performanceHistory.reduce((a, p) => a + p.profit, 0) / r.performanceHistory.length;
      return { id: r.id, origin: r.originIata, dest: r.destinationIata, avgProfit: avg };
    })
    .sort((a, b) => b.avgProfit - a.avgProfit);
}

/* ---- ultime 7 settimane ---- */
function lastWeeks(reports: WeeklyFinancialReport[], n = 7): WeeklyFinancialReport[] {
  return reports.slice(-n);
}

export function FinanceScreen({ game, onNavigate }: Props) {
  const daily  = game.reports.daily;
  const weekly = game.reports.weekly;

  const todayReport   = daily.at(-1) ?? null;
  const last7days     = daily.slice(-7);
  const weekSummary   = sumReports(last7days);
  const last30days    = daily.slice(-30);
  const monthSummary  = sumReports(last30days);
  const avgCask       = avgMetric(last30days, "cask");
  const avgRask       = avgMetric(last30days, "rask");
  const avgMargin     = avgMetric(last30days, "operatingMargin");
  const routes        = routeRanking(game);
  const recentWeeks   = lastWeeks(weekly);

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerTitle}>Finanze</div>
        <div style={s.hubBadge}>{game.hubIata}</div>
      </header>

      <main style={s.main}>

        {/* Cassa */}
        <div style={s.cashCard}>
          <div style={s.cashLabel}>Cassa disponibile</div>
          <div style={{ ...s.cashValue, color: profitColor(game.cash) }}>
            {fmt(game.cash)}
          </div>
        </div>

        {/* Oggi */}
        {todayReport && (
          <section style={s.section}>
            <div style={s.sectionTitle}>Oggi — {todayReport.date}</div>
            <div style={s.kpiGrid}>
              <KpiCard label="Ricavi"   value={fmt(todayReport.revenue)} />
              <KpiCard label="Costi"    value={fmt(todayReport.costs)} />
              <KpiCard label="Profitto" value={fmt(todayReport.profit)}
                color={profitColor(todayReport.profit)} />
              <KpiCard label="Pax"      value={todayReport.passengers.toLocaleString("it-IT")} />
            </div>
          </section>
        )}

        {/* Ultimi 7 giorni */}
        <section style={s.section}>
          <div style={s.sectionTitle}>Ultimi 7 giorni</div>
          {last7days.length === 0 ? (
            <EmptyState text="Nessun dato disponibile. Avanza il turno per generare report." />
          ) : (
            <div style={s.kpiGrid}>
              <KpiCard label="Ricavi"     value={fmt(weekSummary.revenue)} />
              <KpiCard label="Costi"      value={fmt(weekSummary.costs)} />
              <KpiCard label="Profitto"   value={fmt(weekSummary.profit)}
                color={profitColor(weekSummary.profit)} />
              <KpiCard label="Passeggeri" value={weekSummary.passengers.toLocaleString("it-IT")} />
            </div>
          )}
        </section>

        {/* Ultimi 30 giorni */}
        <section style={s.section}>
          <div style={s.sectionTitle}>Ultimi 30 giorni</div>
          {last30days.length === 0 ? (
            <EmptyState text="Nessun dato ancora." />
          ) : (
            <>
              <div style={s.kpiGrid}>
                <KpiCard label="Ricavi"   value={fmt(monthSummary.revenue)} />
                <KpiCard label="Costi"    value={fmt(monthSummary.costs)} />
                <KpiCard label="Profitto" value={fmt(monthSummary.profit)}
                  color={profitColor(monthSummary.profit)} />
                <KpiCard label="Margine"  value={pct(avgMargin)}
                  color={profitColor(avgMargin)} />
              </div>
              <div style={s.metricRow}>
                <Metric label="CASK" value={`$${avgCask.toFixed(4)}`} hint="Costo per seat-km" />
                <Metric label="RASK" value={`$${avgRask.toFixed(4)}`} hint="Ricavo per seat-km" />
              </div>
            </>
          )}
        </section>

        {/* Storico settimanale */}
        {recentWeeks.length > 0 && (
          <section style={s.section}>
            <div style={s.sectionTitle}>Storico settimanale</div>
            <div style={s.table}>
              <div style={s.tableHeader}>
                <span>Settimana</span>
                <span>Ricavi</span>
                <span>Costi</span>
                <span>Profitto</span>
              </div>
              {recentWeeks.map(w => (
                <div key={w.startDate} style={s.tableRow}>
                  <span style={s.tableDate}>{w.startDate}</span>
                  <span>{fmt(w.revenue)}</span>
                  <span>{fmt(w.costs)}</span>
                  <span style={{ color: profitColor(w.profit) }}>{fmt(w.profit)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rotte migliori / peggiori */}
        {routes.length > 0 && (
          <section style={s.section}>
            <div style={s.sectionTitle}>Performance rotte</div>
            <div style={s.routeList}>
              {routes.slice(0, 3).map((r, i) => (
                <RouteRow key={r.id} rank={i + 1} origin={r.origin} dest={r.dest} profit={r.avgProfit} />
              ))}
              {routes.length > 3 && (
                <>
                  <div style={s.divider} />
                  {routes.slice(-2).map((r, i) => (
                    <RouteRow key={r.id} rank={routes.length - 1 + i} origin={r.origin} dest={r.dest} profit={r.avgProfit} worst />
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        {/* Nessuna attività */}
        {game.routes.length === 0 && (
          <EmptyState text="Nessuna rotta attiva. Apri rotte per vedere i dati finanziari." />
        )}

        <div style={{ height: "var(--nav-height)" }} />
      </main>

      {/* Bottom nav */}
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

/* ---- componenti interni ---- */

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color: color ?? "var(--color-text)" }}>{value}</div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={s.metricValue}>{value}</div>
      <div style={s.metricHint}>{hint}</div>
    </div>
  );
}

function RouteRow({ rank, origin, dest, profit, worst }: {
  rank: number; origin: string; dest: string; profit: number; worst?: boolean;
}) {
  return (
    <div style={s.routeRow}>
      <span style={{ ...s.routeRank, color: worst ? "var(--color-danger)" : "var(--color-success)" }}>
        {worst ? "↓" : "↑"}{rank}
      </span>
      <span style={s.routeCode}>{origin} → {dest}</span>
      <span style={{ color: profitColor(profit), fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
        {fmt(profit)}/giorno
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={s.emptyState}>
      <span style={s.emptyText}>{text}</span>
    </div>
  );
}

/* ---- stili ---- */
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
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
  headerTitle: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
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
  cashCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5) var(--space-6)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  cashLabel: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 500,
  },
  cashValue: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 700,
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
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-2)",
  },
  kpiCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3) var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  kpiLabel: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 500,
  },
  kpiValue: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 700,
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-2)",
  },
  metricCard: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3) var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  metricLabel: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-accent)",
    fontWeight: 700,
    letterSpacing: "0.06em",
  },
  metricValue: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  metricHint: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-faint)",
  },
  table: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
    padding: "var(--space-2) var(--space-4)",
    background: "var(--color-surface-2)",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    gap: "var(--space-2)",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
    padding: "var(--space-3) var(--space-4)",
    borderTop: "1px solid var(--color-border)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text)",
    gap: "var(--space-2)",
    alignItems: "center",
  },
  tableDate: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-xs)",
  },
  routeList: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  },
  routeRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-3) var(--space-4)",
    borderTop: "1px solid var(--color-border)",
  },
  routeRank: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 700,
    width: 24,
    flexShrink: 0,
  },
  routeCode: {
    flex: 1,
    fontSize: "var(--font-size-sm)",
    fontWeight: 500,
    color: "var(--color-text)",
    letterSpacing: "0.03em",
  },
  divider: {
    height: 1,
    background: "var(--color-surface-3)",
    margin: "var(--space-1) 0",
  },
  emptyState: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-6)",
    textAlign: "center",
  },
  emptyText: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
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
  },
  navIcon: { fontSize: "1.25rem", lineHeight: 1 },
  navLabel: { fontSize: "var(--font-size-xs)", fontWeight: 500 },
};
