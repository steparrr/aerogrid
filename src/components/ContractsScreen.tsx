import { useState } from "react";
import type { GameState, GameView } from "../domain/types";
import { saveGame } from "../game/persistence";

interface Props {
  game: GameState;
  onNavigate: (view: GameView) => void;
  onUpdate: (next: GameState) => void;
}

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

// Tipi inline finché Codex non aggiunge i tipi ufficiali
type ContractStatus = "available" | "active" | "failed" | "completed";
type Industry = "finance" | "tech" | "energy" | "institutions" | "consulting" | "pharma";

interface CorporateContract {
  id: string;
  companyName: string;
  industry: Industry;
  originCities: string[];
  destinationCities: string[];
  preferredAirports: string[];
  requiredWeeklySeatsEconomy: number;
  requiredWeeklySeatsBusiness: number;
  minimumFrequency: number;
  minimumReputation: number;
  priceDiscount: number;
  contractValue: number;
  durationMonths: number;
  penaltyIfFailed: number;
  renewalProbability: number;
  status: ContractStatus;
  startDate: string | null;
  endDate: string | null;
  winProbability: number;
}

// Seed contratti demo (verrà sostituito dal modulo Codex)
const DEMO_CONTRACTS: CorporateContract[] = [
  {
    id: "corp-finance-1",
    companyName: "Atlantic Capital Group",
    industry: "finance",
    originCities: ["London", "New York"],
    destinationCities: ["Frankfurt", "New York", "London"],
    preferredAirports: ["LHR", "JFK", "FRA"],
    requiredWeeklySeatsEconomy: 20,
    requiredWeeklySeatsBusiness: 12,
    minimumFrequency: 5,
    minimumReputation: 0.6,
    priceDiscount: 0.08,
    contractValue: 480000,
    durationMonths: 6,
    penaltyIfFailed: 50000,
    renewalProbability: 0.72,
    status: "available",
    startDate: null,
    endDate: null,
    winProbability: 0,
  },
  {
    id: "corp-tech-1",
    companyName: "Pacific Tech Ventures",
    industry: "tech",
    originCities: ["San Francisco", "Los Angeles"],
    destinationCities: ["Tokyo", "Seoul", "Singapore"],
    preferredAirports: ["SFO", "LAX", "NRT", "ICN", "SIN"],
    requiredWeeklySeatsEconomy: 40,
    requiredWeeklySeatsBusiness: 8,
    minimumFrequency: 3,
    minimumReputation: 0.55,
    priceDiscount: 0.05,
    contractValue: 620000,
    durationMonths: 12,
    penaltyIfFailed: 80000,
    renewalProbability: 0.65,
    status: "available",
    startDate: null,
    endDate: null,
    winProbability: 0,
  },
  {
    id: "corp-energy-1",
    companyName: "Gulf Energy Partners",
    industry: "energy",
    originCities: ["Dubai", "Doha"],
    destinationCities: ["Riyadh", "Houston", "London"],
    preferredAirports: ["DXB", "DOH", "RUH", "HOU", "LHR"],
    requiredWeeklySeatsEconomy: 15,
    requiredWeeklySeatsBusiness: 18,
    minimumFrequency: 4,
    minimumReputation: 0.65,
    priceDiscount: 0.10,
    contractValue: 750000,
    durationMonths: 12,
    penaltyIfFailed: 100000,
    renewalProbability: 0.80,
    status: "available",
    startDate: null,
    endDate: null,
    winProbability: 0,
  },
  {
    id: "corp-inst-1",
    companyName: "International Policy Forum",
    industry: "institutions",
    originCities: ["Geneva", "Brussels"],
    destinationCities: ["New York", "Washington", "London"],
    preferredAirports: ["ZRH", "LHR", "JFK", "CDG"],
    requiredWeeklySeatsEconomy: 10,
    requiredWeeklySeatsBusiness: 6,
    minimumFrequency: 3,
    minimumReputation: 0.70,
    priceDiscount: 0.12,
    contractValue: 290000,
    durationMonths: 6,
    penaltyIfFailed: 30000,
    renewalProbability: 0.60,
    status: "available",
    startDate: null,
    endDate: null,
    winProbability: 0,
  },
];

const INDUSTRY_LABELS: Record<Industry, { label: string; color: string; icon: string }> = {
  finance:      { label: "Finance",      color: "var(--color-warning)",  icon: "🏦" },
  tech:         { label: "Technology",   color: "var(--color-accent)",   icon: "💻" },
  energy:       { label: "Energy",       color: "var(--color-success)",  icon: "⚡" },
  institutions: { label: "Istituzioni",  color: "#a78bfa",               icon: "🏛" },
  consulting:   { label: "Consulting",   color: "#f472b6",               icon: "📊" },
  pharma:       { label: "Pharma",       color: "#34d399",               icon: "💊" },
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

function winColor(p: number): string {
  if (p >= 0.65) return "var(--color-success)";
  if (p >= 0.35) return "var(--color-warning)";
  return "var(--color-danger)";
}

// Calcolo probabilità di vincita locale (finché Codex non implementa evaluateCorporateBid)
function estimateWinProb(contract: CorporateContract, game: GameState): { prob: number; canBid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const activeRoutes = game.routes.filter(r => r.status === "active");
  const routeIatas = new Set(activeRoutes.flatMap(r => [r.originIata, r.destinationIata]));

  const coversAirport = contract.preferredAirports.some(iata => routeIatas.has(iata));
  if (!coversAirport) reasons.push(`Nessuna rotta verso ${contract.preferredAirports.join(", ")}`);

  const hasFrequency = activeRoutes.some(r =>
    contract.preferredAirports.includes(r.originIata) ||
    contract.preferredAirports.includes(r.destinationIata)
      ? r.weeklyFrequency >= contract.minimumFrequency
      : false
  );
  if (!hasFrequency && coversAirport) reasons.push(`Frequenza minima richiesta: ${contract.minimumFrequency}x/sett`);

  if (game.reputation < contract.minimumReputation)
    reasons.push(`Reputazione insufficiente (${pct(game.reputation)} < ${pct(contract.minimumReputation)})`);

  const hasBusiness = activeRoutes.some(r => r.businessSeats > 0);
  if (contract.requiredWeeklySeatsBusiness > 0 && !hasBusiness)
    reasons.push("Richiede classe business");

  const canBid = reasons.length === 0;
  let prob = canBid ? 0.55 : 0;
  if (canBid && game.reputation > contract.minimumReputation + 0.1) prob += 0.15;
  if (canBid && hasFrequency) prob += 0.10;

  return { prob: Math.min(prob, 0.92), canBid, reasons };
}

export function ContractsScreen({ game, onNavigate, onUpdate }: Props) {
  const [tab, setTab] = useState<"available" | "active">("available");
  const [selected, setSelected] = useState<CorporateContract | null>(null);
  const [bidding, setBidding] = useState<string | null>(null);

  // Usa i contratti dal GameState se disponibili, altrimenti il seed demo
  const gameContracts = (game as GameState & { contracts?: CorporateContract[] }).contracts ?? [];
  const allContracts = gameContracts.length > 0 ? gameContracts : DEMO_CONTRACTS;

  const available = allContracts.filter(c => c.status === "available");
  const active    = allContracts.filter(c => c.status === "active");

  function handleBid(contract: CorporateContract) {
    const { canBid, reasons } = estimateWinProb(contract, game);
    if (!canBid) {
      alert(`Non puoi fare offerta:\n${reasons.join("\n")}`);
      return;
    }
    setBidding(contract.id);
    // Simula breve attesa, poi assegna
    setTimeout(() => {
      const { prob } = estimateWinProb(contract, game);
      const won = Math.random() < prob;
      const today = game.currentDate;
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + contract.durationMonths);

      const updated: CorporateContract = {
        ...contract,
        status: won ? "active" : "available",
        startDate: won ? today : null,
        endDate: won ? endDate.toISOString().split("T")[0]! : null,
        winProbability: prob,
      };

      const deposit = won ? Math.round(contract.contractValue * 0.05) : 0;
      const newContracts = allContracts.map(c => c.id === contract.id ? updated : c);
      const next: GameState & { contracts: CorporateContract[] } = {
        ...game,
        contracts: newContracts,
        cash: won ? game.cash - deposit : game.cash,
        notifications: [
          ...game.notifications,
          {
            id: `contract-${contract.id}-${Date.now()}`,
            severity: won ? "info" as const : "warning" as const,
            title: won ? `Contratto aggiudicato: ${contract.companyName}` : `Offerta non accettata: ${contract.companyName}`,
            message: won
              ? `Contratto da ${fmt(contract.contractValue)} per ${contract.durationMonths} mesi. Deposito: ${fmt(deposit)}.`
              : "La tua offerta non è stata selezionata. Migliora frequenza o reputazione.",
          },
        ],
      };
      saveGame(next);
      onUpdate(next);
      setBidding(null);
      if (won) setTab("active");
    }, 800);
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerTitle}>Contratti Corporate</div>
        <div style={s.hubBadge}>{game.hubIata}</div>
      </header>

      <main style={s.main}>
        {/* Tab */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === "available" ? s.tabActive : {}) }}
            onClick={() => setTab("available")}
          >
            Disponibili <span style={s.tabCount}>{available.length}</span>
          </button>
          <button
            style={{ ...s.tab, ...(tab === "active" ? s.tabActive : {}) }}
            onClick={() => setTab("active")}
          >
            Attivi <span style={s.tabCount}>{active.length}</span>
          </button>
        </div>

        {/* Lista contratti */}
        {tab === "available" && (
          available.length === 0
            ? <EmptyState text="Nessun contratto disponibile al momento." />
            : <div style={s.contractList}>
                {available.map(c => {
                  const { prob, canBid, reasons } = estimateWinProb(c, game);
                  const ind = INDUSTRY_LABELS[c.industry];
                  return (
                    <div
                      key={c.id}
                      style={{
                        ...s.contractCard,
                        borderColor: selected?.id === c.id ? "var(--color-accent)" : "var(--color-border)",
                      }}
                      onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    >
                      <div style={s.contractHeader}>
                        <div style={s.contractLeft}>
                          <span style={s.contractIcon}>{ind.icon}</span>
                          <div>
                            <div style={s.contractName}>{c.companyName}</div>
                            <span style={{ ...s.industryBadge, color: ind.color, borderColor: ind.color }}>
                              {ind.label}
                            </span>
                          </div>
                        </div>
                        <div style={s.contractRight}>
                          <div style={s.contractValue}>{fmt(c.contractValue)}</div>
                          <div style={s.contractDuration}>{c.durationMonths} mesi</div>
                        </div>
                      </div>

                      <div style={s.contractRoutes}>
                        {c.preferredAirports.join(" · ")}
                      </div>

                      <div style={s.contractFooter}>
                        <div style={s.winProb}>
                          <span style={s.winProbLabel}>Prob. vincita</span>
                          <span style={{ ...s.winProbValue, color: canBid ? winColor(prob) : "var(--color-text-faint)" }}>
                            {canBid ? pct(prob) : "—"}
                          </span>
                        </div>
                        <button
                          style={{
                            ...s.bidBtn,
                            opacity: canBid ? 1 : 0.4,
                            cursor: canBid ? "pointer" : "not-allowed",
                          }}
                          onClick={e => { e.stopPropagation(); handleBid(c); }}
                          disabled={!canBid || bidding === c.id}
                        >
                          {bidding === c.id ? "..." : "Fai offerta"}
                        </button>
                      </div>

                      {/* Dettaglio espanso */}
                      {selected?.id === c.id && (
                        <div style={s.detail}>
                          <DetailRow label="Economy richiesta" value={`${c.requiredWeeklySeatsEconomy} posti/sett`} />
                          <DetailRow label="Business richiesta" value={`${c.requiredWeeklySeatsBusiness} posti/sett`} />
                          <DetailRow label="Frequenza minima" value={`${c.minimumFrequency}x/settimana`} />
                          <DetailRow label="Reputazione minima" value={pct(c.minimumReputation)} />
                          <DetailRow label="Sconto offerto" value={pct(c.priceDiscount)} />
                          <DetailRow label="Penale inadempienza" value={fmt(c.penaltyIfFailed)} />
                          <DetailRow label="Prob. rinnovo" value={pct(c.renewalProbability)} />
                          {reasons.length > 0 && (
                            <div style={s.reasonsList}>
                              {reasons.map((r, i) => (
                                <div key={i} style={s.reasonItem}>⚠ {r}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        )}

        {tab === "active" && (
          active.length === 0
            ? <EmptyState text="Nessun contratto attivo. Fai un'offerta nella tab Disponibili." />
            : <div style={s.contractList}>
                {active.map(c => {
                  const ind = INDUSTRY_LABELS[c.industry];
                  const { compliant } = checkCompliance(c, game);
                  return (
                    <div key={c.id} style={{ ...s.contractCard, borderColor: compliant ? "var(--color-success)" : "var(--color-danger)" }}>
                      <div style={s.contractHeader}>
                        <div style={s.contractLeft}>
                          <span style={s.contractIcon}>{ind.icon}</span>
                          <div>
                            <div style={s.contractName}>{c.companyName}</div>
                            <span style={{ ...s.industryBadge, color: ind.color, borderColor: ind.color }}>{ind.label}</span>
                          </div>
                        </div>
                        <div style={s.contractRight}>
                          <div style={{ ...s.contractValue, color: "var(--color-success)" }}>
                            +{fmt(Math.round(c.contractValue / c.durationMonths / 4))}/sett
                          </div>
                          <div style={s.contractDuration}>scade {c.endDate}</div>
                        </div>
                      </div>
                      <div style={s.contractRoutes}>{c.preferredAirports.join(" · ")}</div>
                      <div style={{
                        ...s.complianceBadge,
                        background: compliant ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                        color: compliant ? "var(--color-success)" : "var(--color-danger)",
                      }}>
                        {compliant ? "✓ In regola" : "⚠ Requisiti non soddisfatti"}
                      </div>
                    </div>
                  );
                })}
              </div>
        )}

        <div style={{ height: "var(--nav-height)" }} />
      </main>

      <nav style={s.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = game.currentView === item.view;
          return (
            <button
              key={item.view}
              style={{ ...s.navBtn, color: isActive ? "var(--color-accent)" : "var(--color-text-muted)" }}
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

function checkCompliance(contract: CorporateContract, game: GameState) {
  const activeRoutes = game.routes.filter(r => r.status === "active");
  const coversAirport = contract.preferredAirports.some(iata =>
    activeRoutes.some(r => r.originIata === iata || r.destinationIata === iata)
  );
  return { compliant: coversAirport && game.reputation >= contract.minimumReputation };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={s.emptyState}>
      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{text}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" },
  header: {
    height: "var(--header-height)", background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)", display: "flex",
    alignItems: "center", justifyContent: "space-between",
    padding: "0 var(--space-page)", position: "sticky", top: 0, zIndex: 10,
  },
  headerTitle: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  hubBadge: {
    background: "var(--color-accent-dim)", color: "var(--color-accent)",
    border: "1px solid var(--color-accent)", borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 10px",
  },
  main: { flex: 1, padding: "var(--space-4) var(--space-page)", display: "flex", flexDirection: "column", gap: "var(--space-4)", overflowY: "auto" },
  tabs: { display: "flex", gap: "var(--space-2)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-1)" },
  tab: {
    flex: 1, padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)",
    fontSize: "var(--font-size-sm)", fontWeight: 500, color: "var(--color-text-muted)",
    background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
  },
  tabActive: { background: "var(--color-surface-2)", color: "var(--color-text)" },
  tabCount: {
    background: "var(--color-surface-3)", borderRadius: "var(--radius-full)",
    fontSize: "var(--font-size-xs)", fontWeight: 700, padding: "1px 7px", color: "var(--color-text-muted)",
  },
  contractList: { display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  contractCard: {
    background: "var(--color-surface)", border: "1px solid",
    borderRadius: "var(--radius-md)", padding: "var(--space-4)",
    cursor: "pointer", display: "flex", flexDirection: "column", gap: "var(--space-3)",
  },
  contractHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  contractLeft: { display: "flex", gap: "var(--space-3)", alignItems: "center" },
  contractIcon: { fontSize: "1.5rem" },
  contractName: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  industryBadge: {
    display: "inline-block", fontSize: "var(--font-size-xs)", fontWeight: 600,
    border: "1px solid", borderRadius: "var(--radius-full)", padding: "1px 8px", marginTop: 2,
  },
  contractRight: { textAlign: "right" as const },
  contractValue: { fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text)" },
  contractDuration: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" },
  contractRoutes: { fontSize: "var(--font-size-sm)", color: "var(--color-accent)", fontWeight: 500, letterSpacing: "0.04em" },
  contractFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  winProb: { display: "flex", flexDirection: "column", gap: 2 },
  winProbLabel: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  winProbValue: { fontSize: "var(--font-size-lg)", fontWeight: 700 },
  bidBtn: {
    background: "var(--color-accent)", color: "#0b1622", fontWeight: 700,
    fontSize: "var(--font-size-sm)", padding: "var(--space-2) var(--space-5)",
    borderRadius: "var(--radius-md)", border: "none",
  },
  detail: { borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  detailRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" },
  detailValue: { fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text)" },
  reasonsList: { display: "flex", flexDirection: "column", gap: 4, marginTop: "var(--space-1)" },
  reasonItem: { fontSize: "var(--font-size-xs)", color: "var(--color-warning)" },
  complianceBadge: { borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--font-size-sm)", fontWeight: 600, textAlign: "center" as const },
  emptyState: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "var(--space-6)", textAlign: "center" as const,
  },
  nav: {
    height: "var(--nav-height)", background: "var(--color-surface)",
    borderTop: "1px solid var(--color-border)", display: "flex",
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
  },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
  navIcon: { fontSize: "1.25rem", lineHeight: 1 },
  navLabel: { fontSize: "var(--font-size-xs)", fontWeight: 500 },
};
