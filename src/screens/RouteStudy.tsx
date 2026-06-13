import { useMemo, useState } from "react";
import { BackButton } from "../components/BackButton";

import { aircraftModelById } from "../data/indexes";
import type { GameState } from "../domain/types";
import {
  buildRouteStudy,
  type RouteStudyFinance,
  type RouteStudyResult,
  type SlotRiskTone,
} from "../engine/routeStudyEngine";
import type { RouteProposal } from "../simulation/routePlanner";
import { recalculateRouteProposal } from "../simulation/routePlanner";

type Tab = "market" | "competitors" | "finance" | "risks";
type IntelligenceTier = 1 | 2 | 3 | 4;

interface Props {
  game: GameState;
  originIata?: string;
  destinationIata?: string;
  intelligenceTier?: IntelligenceTier;
  onOpenRoute?: (proposal: RouteProposal) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "market", label: "Mercato" },
  { id: "competitors", label: "Competitor" },
  { id: "finance", label: "Finanze" },
  { id: "risks", label: "Rischi" },
];
const SEGMENT_COLORS = [
  "var(--color-accent)",
  "#a78bfa",
  "var(--color-warning)",
  "var(--color-success)",
  "#818cf8",
  "#f472b6",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 1,
  }).format(value);
}

function resolveTier(game: GameState, tier?: IntelligenceTier): IntelligenceTier {
  if (tier) return tier;
  return Math.min(4, Math.max(1, game.player.level)) as IntelligenceTier;
}

function Locked({
  activeTier,
  requiredTier,
  children,
}: {
  activeTier: IntelligenceTier;
  requiredTier: IntelligenceTier;
  children: React.ReactNode;
}) {
  if (activeTier >= requiredTier) return children;
  return (
    <div style={styles.locked}>
      <div style={styles.blurred}>{children}</div>
      <div style={styles.lockOverlay}>🔒 Sblocca T{requiredTier}</div>
    </div>
  );
}

export function RouteStudy({
  game,
  originIata,
  destinationIata,
  intelligenceTier,
  onOpenRoute,
}: Props) {
  const airportOptions = useMemo(
    () =>
      Object.values(game.airports).sort((first, second) =>
        first.iata.localeCompare(second.iata),
      ),
    [game.airports],
  );
  const initialOrigin =
    originIata && game.airports[originIata] ? originIata : game.hubIata;
  const initialDestination =
    destinationIata && game.airports[destinationIata]
      ? destinationIata
      : game.routes.find((route) => route.destinationIata !== initialOrigin)
          ?.destinationIata ??
        airportOptions.find((airport) => airport.iata !== initialOrigin)?.iata ??
        initialOrigin;
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [tab, setTab] = useState<Tab>("market");
  const [showConfig, setShowConfig] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const tier = resolveTier(game, intelligenceTier);
  const study = useMemo(
    () => buildRouteStudy(game, origin, destination),
    [destination, game, origin],
  );

  function chooseOrigin(next: string) {
    setOrigin(next);
    if (next === destination) {
      const fallback = airportOptions.find((airport) => airport.iata !== next);
      if (fallback) setDestination(fallback.iata);
    }
  }

  function chooseDestination(next: string) {
    setDestination(next);
    if (next === origin) {
      const fallback = airportOptions.find((airport) => airport.iata !== next);
      if (fallback) setOrigin(fallback.iata);
    }
  }

  function openRoute() {
    if (study.prerequisites.length > 0 || !study.proposal) {
      setShowPrerequisites(true);
      return;
    }
    setShowConfig(true);
  }

  return (
    <div style={styles.page}>
      <header style={{ ...styles.header, display: "flex", alignItems: "flex-start", gap: 12 }}>
        <BackButton />
        <div style={{ flex: 1 }}>
          <div style={styles.eyebrow}>Network planning</div>
          <h1 style={styles.title}>Studio Rotta</h1>
          <p style={styles.subtitle}>
            Dati reali di domanda, concorrenza, fattibilita e rischio
          </p>
        </div>
        <div style={styles.tierBadge}>Intel T{tier}</div>
      </header>

      <main style={styles.main}>
        <section style={styles.routeSelector}>
          <label style={styles.selectLabel}>
            Origine
            <select
              aria-label="Origine"
              value={origin}
              onChange={(event) => chooseOrigin(event.target.value)}
              style={styles.select}
            >
              {airportOptions.map((airport) => (
                <option key={airport.iata} value={airport.iata}>
                  {airport.iata} · {airport.name}
                </option>
              ))}
            </select>
          </label>
          <div style={styles.routeArrow}>
            <strong>{study.origin.iata} → {study.destination.iata}</strong>
            <span>{formatNumber(study.distanceKm)} km</span>
          </div>
          <label style={styles.selectLabel}>
            Destinazione
            <select
              aria-label="Destinazione"
              value={destination}
              onChange={(event) => chooseDestination(event.target.value)}
              style={styles.select}
            >
              {airportOptions.map((airport) => (
                <option key={airport.iata} value={airport.iata}>
                  {airport.iata} · {airport.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <nav style={styles.tabs} aria-label="Studio rotta">
          {TABS.map((item) => (
            <button
              key={item.id}
              style={{
                ...styles.tab,
                ...(tab === item.id ? styles.tabActive : {}),
              }}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "market" && <MarketTab study={study} tier={tier} />}
        {tab === "competitors" && <CompetitorTab study={study} tier={tier} />}
        {tab === "finance" && <FinanceTab study={study} tier={tier} />}
        {tab === "risks" && <RisksTab study={study} tier={tier} />}
      </main>

      <footer style={styles.footer}>
        <button style={styles.primaryButton} onClick={openRoute}>
          Apri questa rotta →
        </button>
        {(showPrerequisites || study.prerequisites.length > 0) && (
          <div style={styles.prerequisites}>
            {study.prerequisites.length > 0 ? (
              study.prerequisites.map((item) => <span key={item}>⚠ {item}</span>)
            ) : (
              <span>Prerequisiti operativi verificati</span>
            )}
          </div>
        )}
      </footer>

      {showConfig && study.proposal && (
        <RouteConfiguration
          game={game}
          proposal={study.proposal}
          onClose={() => setShowConfig(false)}
          onConfirm={(configuredProposal) => {
            onOpenRoute?.(configuredProposal);
            setShowConfig(false);
          }}
        />
      )}
    </div>
  );
}

function MarketTab({
  study,
  tier,
}: {
  study: RouteStudyResult;
  tier: IntelligenceTier;
}) {
  const [selectedSegment, setSelectedSegment] = useState(
    study.market.segments[0]?.id ?? "corporate",
  );
  const maximumSeasonality = Math.max(
    1,
    ...study.market.seasonality.map(
      (point) => point.segmentFactors[selectedSegment] * 100,
    ),
  );
  return (
    <div style={styles.contentGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.eyebrow}>Domanda di mercato</div>
            <h2 style={styles.metric}>
              {formatNumber(study.market.totalPassengers)} pax/giorno
            </h2>
          </div>
          <div style={styles.quietMetric}>
            Potenziale {formatNumber(study.market.potentialPassengers)}
          </div>
        </div>
        <div style={styles.sectionTitle}>6 segmenti passeggeri</div>
        <Locked activeTier={tier} requiredTier={2}>
          {study.market.segments.map((segment, index) => (
            <div key={segment.id} style={styles.segment}>
              <div style={styles.rowBetween}>
                <span>{segment.label}</span>
                <span>
                  {formatNumber(segment.passengers)} · {formatNumber(segment.share)}%
                </span>
              </div>
              <div style={styles.progress}>
                <span
                  style={{
                    ...styles.progressFill,
                    width: `${segment.share}%`,
                    background: SEGMENT_COLORS[index],
                  }}
                />
              </div>
              <small style={styles.muted}>
                Elasticita {formatNumber(segment.elasticity)}
              </small>
            </div>
          ))}
        </Locked>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Stagionalita 12 mesi</div>
        <Locked activeTier={tier} requiredTier={2}>
          <div style={styles.segmentSelector}>
            {study.market.segments.map((segment) => (
              <button
                key={segment.id}
                style={{
                  ...styles.segmentChip,
                  ...(selectedSegment === segment.id
                    ? styles.segmentChipActive
                    : {}),
                }}
                onClick={() => setSelectedSegment(segment.id)}
              >
                {segment.label}
              </button>
            ))}
          </div>
          <div style={styles.seasonality}>
            {study.market.seasonality.map((point) => (
              <div key={point.month} style={styles.monthColumn}>
                <span
                  title={`${point.label}: ${formatNumber(point.segmentFactors[selectedSegment] * 100)}%`}
                  style={{
                    ...styles.monthBar,
                    height: `${Math.max(
                      8,
                      ((point.segmentFactors[selectedSegment] * 100) /
                        maximumSeasonality) *
                        100,
                    )}%`,
                  }}
                />
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        </Locked>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Driver di domanda</div>
        <Locked activeTier={tier} requiredTier={2}>
          {study.market.drivers.map((driver) => (
            <div key={driver.label} style={styles.dataRow}>
              <span>{driver.label}</span>
              <strong>{driver.value}</strong>
            </div>
          ))}
        </Locked>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Proiezione revenue a ramp-up</div>
        <Locked activeTier={tier} requiredTier={4}>
          {study.finance ? (
            study.finance.ramp.map((point) => (
              <div key={point.month} style={styles.dataRow}>
                <span>Mese {point.month} · LF {formatNumber(point.loadFactor)}%</span>
                <strong>{formatMoney(point.revenue)}</strong>
              </div>
            ))
          ) : (
            <p style={styles.muted}>Serve un aeromobile compatibile.</p>
          )}
        </Locked>
      </section>
    </div>
  );
}

function CompetitorTab({
  study,
  tier,
}: {
  study: RouteStudyResult;
  tier: IntelligenceTier;
}) {
  const visibleCompetitors = study.competitors.slice(0, tier === 1 ? 1 : 3);
  return (
    <div style={styles.contentGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.eyebrow}>{study.routeKey}</div>
            <h2 style={styles.cardTitle}>
              {study.competitors.length} competitor attivi
            </h2>
          </div>
          <div style={styles.quietMetric}>
            Quota player {formatNumber(study.marketShare.withPlayer)}%
          </div>
        </div>
        <p style={styles.muted}>
          Senza ingresso player: {formatNumber(study.marketShare.withoutPlayer)}%
          · con ingresso: {formatNumber(study.marketShare.withPlayer)}%
        </p>
      </section>

      {visibleCompetitors.map((competitor) => (
        <section key={competitor.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.eyebrow}>{competitor.archetype}</div>
              <h2 style={styles.cardTitle}>{competitor.name}</h2>
            </div>
            <strong>
              {formatNumber(competitor.marketShareWithoutPlayer)}% →{" "}
              {formatNumber(competitor.marketShare)}%
            </strong>
          </div>
          <div style={styles.dataRow}>
            <span>Indice frequenza</span>
            <strong>{formatNumber(competitor.frequencyIndex)}</strong>
          </div>
          <Locked activeTier={tier} requiredTier={2}>
            <div style={styles.dataRow}>
              <span>Economy stimata</span>
              <strong>{formatMoney(competitor.economyPrice)}</strong>
            </div>
            <div style={styles.dataRow}>
              <span>Business stimata</span>
              <strong>{formatMoney(competitor.businessPrice)}</strong>
            </div>
          </Locked>
          <Locked activeTier={tier} requiredTier={3}>
            <div style={styles.sectionTitle}>Storico rotta, ultimi 6 eventi</div>
            {competitor.history.length > 0 ? (
              competitor.history.map((event) => (
                <div key={`${event.date}-${event.description}`} style={styles.dataRow}>
                  <span>{event.date}</span>
                  <strong>{event.description}</strong>
                </div>
              ))
            ) : (
              <p style={styles.muted}>Nessuna azione registrata.</p>
            )}
          </Locked>
          <Locked activeTier={tier} requiredTier={4}>
            <div style={styles.response}>
              Risposta attesa: <strong>{responseLabel(competitor.response)}</strong>
            </div>
          </Locked>
        </section>
      ))}

      {study.competitors.length === 0 && (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Nessun competitor attivo registrato</h2>
          <p style={styles.muted}>
            Il GameState non contiene vettori attivi su questa O/D.
          </p>
        </section>
      )}
    </div>
  );
}

function responseLabel(response: RouteStudyResult["competitors"][number]["response"]) {
  switch (response.type) {
    case "PRICE_CUT":
      return `taglio prezzo ${formatNumber(response.pct * 100)}%`;
    case "ADD_FREQUENCY":
      return `+${response.flightsPerWeek} frequenza/sett`;
    case "CAPACITY_DUMP":
      return "aumento aggressivo capacita";
    case "ENTER_ROUTE":
      return "ingresso sulla rotta";
    case "EXIT_ROUTE":
      return "uscita dalla rotta";
    default:
      return "nessuna azione";
  }
}

function FinanceTab({
  study,
  tier,
}: {
  study: RouteStudyResult;
  tier: IntelligenceTier;
}) {
  if (!study.finance) {
    return (
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Business case non disponibile</h2>
        <p style={styles.muted}>
          Serve un aeromobile compatibile in flotta per calcolare costi,
          frequenze e break-even.
        </p>
      </section>
    );
  }
  const finance = study.finance;
  return (
    <div style={styles.contentGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.eyebrow}>Scenario consigliato</div>
            <h2 style={styles.cardTitle}>{aircraftLabel(finance)}</h2>
          </div>
          <strong>{finance.weeklyFrequency} rotazioni/sett</strong>
        </div>
        <div style={styles.kpiGrid}>
          <Kpi label="Revenue / mese" value={formatMoney(finance.revenue.total)} />
          <Kpi label="Costi / mese" value={formatMoney(finance.costs.total)} />
          <Kpi
            label="Margine / mese"
            value={formatMoney(finance.monthlyProfit)}
            tone={finance.monthlyProfit >= 0 ? "success" : "danger"}
          />
          <Kpi
            label="Break-even load factor"
            value={`${formatNumber(finance.breakEvenLoadFactor)}%`}
          />
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Revenue per classe</div>
        <Locked activeTier={tier} requiredTier={2}>
          <MoneyRows
            rows={[
              ["Economy", finance.revenue.economy],
              ["Business", finance.revenue.business],
              ["Premium economy", finance.revenue.premium],
              ["Ancillary", finance.revenue.ancillary],
              ["Cargo", finance.revenue.cargo],
            ]}
          />
        </Locked>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Costi per mese</div>
        <Locked activeTier={tier} requiredTier={2}>
          <MoneyRows
            rows={[
              ["Carburante", finance.costs.fuel],
              ["Leasing allocato", finance.costs.lease],
              ["Equipaggio", finance.costs.crew],
              ["Handling + navigazione", finance.costs.handlingNavigation],
              ["Fee aeroportuali", finance.costs.airportFees],
              ["Manutenzione", finance.costs.maintenance],
            ]}
          />
        </Locked>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Ramp-up e NPV</div>
        <Locked activeTier={tier} requiredTier={4}>
          {finance.ramp.map((point) => (
            <div key={point.month} style={styles.dataRow}>
              <span>Mese {point.month} · LF {formatNumber(point.loadFactor)}%</span>
              <strong>{formatMoney(point.profit)}</strong>
            </div>
          ))}
          <div style={styles.response}>
            NPV semplificato 24 mesi, tasso 0%:{" "}
            <strong>{formatMoney(finance.npv24Months)}</strong>
          </div>
        </Locked>
      </section>
    </div>
  );
}

function aircraftLabel(finance: RouteStudyFinance) {
  return aircraftModelById.get(finance.aircraft)?.name ?? finance.aircraft;
}

function MoneyRows({ rows }: { rows: Array<[string, number | null]> }) {
  return rows.map(([label, value]) => (
    <div key={label} style={styles.dataRow}>
      <span>{label}</span>
      <strong>{value === null ? "Non modellata" : formatMoney(value)}</strong>
    </div>
  ));
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div style={styles.kpi}>
      <small style={styles.muted}>{label}</small>
      <strong
        style={{
          color:
            tone === "success"
              ? "var(--color-success)"
              : tone === "danger"
                ? "var(--color-danger)"
                : "var(--color-text)",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function RisksTab({
  study,
  tier,
}: {
  study: RouteStudyResult;
  tier: IntelligenceTier;
}) {
  return (
    <div style={styles.contentGrid}>
      <section style={styles.card}>
        <div style={styles.sectionTitle}>Score rischio complessivo</div>
        <div style={styles.riskScore}>
          <span
            style={{
              display: "block",
              width: `${study.risks.score}%`,
              height: "100%",
              background: "var(--color-warning)",
            }}
          />
        </div>
        <h2 style={styles.metric}>{study.risks.score} / 100</h2>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}>Slot availability</div>
        <SlotRow
          iata={study.origin.iata}
          tone={study.risks.originSlot.tone}
          detail={study.risks.originSlot.detail}
        />
        <SlotRow
          iata={study.destination.iata}
          tone={study.risks.destinationSlot.tone}
          detail={study.risks.destinationSlot.detail}
        />
      </section>

      <section style={styles.card}>
        <Locked activeTier={tier} requiredTier={2}>
          <div style={styles.dataRow}>
            <span>Stagionalita estrema</span>
            <strong>-{formatNumber(study.risks.seasonalDropPercent)}% picco-valle</strong>
          </div>
        </Locked>
        <Locked activeTier={tier} requiredTier={3}>
          <div style={styles.dataRow}>
            <span>Concentrazione competitor</span>
            <strong>
              {study.risks.dominantCompetitor
                ? `Alta · ${study.risks.dominantCompetitor}`
                : "Nessun LEGACY_DOMINANT"}
            </strong>
          </div>
        </Locked>
        <Locked activeTier={tier} requiredTier={4}>
          <div style={styles.dataRow}>
            <span>Compliance ambientale</span>
            <strong>
              {study.risks.etsApplicable ? "Rotta europea ETS" : "Fuori ETS intra-Europa"}
            </strong>
          </div>
          <p style={styles.muted}>
            Costo ETS non disponibile: il GameState non contiene un prezzo ETS
            di mercato per una stima monetaria.
          </p>
        </Locked>
      </section>
    </div>
  );
}

function SlotRow({
  iata,
  tone,
  detail,
}: {
  iata: string;
  tone: SlotRiskTone;
  detail: string;
}) {
  const color =
    tone === "green"
      ? "var(--color-success)"
      : tone === "red"
        ? "var(--color-danger)"
        : "var(--color-warning)";
  return (
    <div style={styles.slotRow}>
      <span style={{ ...styles.statusDot, background: color }} />
      <div>
        <strong>{iata}</strong>
        <p style={styles.muted}>{detail}</p>
      </div>
    </div>
  );
}

function RouteConfiguration({
  game,
  proposal,
  onClose,
  onConfirm,
}: {
  game: GameState;
  proposal: RouteProposal;
  onClose: () => void;
  onConfirm: (proposal: RouteProposal) => void;
}) {
  const [aircraftId, setAircraftId] = useState(proposal.aircraftId);
  const [weeklyFrequency, setWeeklyFrequency] = useState(
    proposal.weeklyFrequency,
  );
  const [economyPrice, setEconomyPrice] = useState(proposal.economyPrice);
  const [businessPrice, setBusinessPrice] = useState(proposal.businessPrice);
  const [strategy, setStrategy] = useState(
    proposal.pricing_strategy ?? "YIELD_MAXIMIZER",
  );

  function confirm() {
    onConfirm(
      recalculateRouteProposal(
        {
          ...proposal,
          aircraftId,
          weeklyFrequency,
          economyPrice,
          businessPrice,
          pricing_strategy: strategy,
        },
        {
          originIata: proposal.originIata,
          destinationIata: proposal.destinationIata,
          fleet: game.fleet,
          date: game.currentDate,
        },
      ),
    );
  }

  return (
    <div style={styles.modalBackdrop} role="dialog" aria-modal="true">
      <section style={styles.modal}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.eyebrow}>{proposal.originIata} → {proposal.destinationIata}</div>
            <h2 style={styles.cardTitle}>Configura nuova rotta</h2>
          </div>
          <button aria-label="Chiudi" style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <label style={styles.selectLabel}>
          Aeromobile
          <select
            aria-label="Aeromobile"
            value={aircraftId}
            onChange={(event) => setAircraftId(event.target.value)}
            style={styles.select}
          >
            {game.fleet.map((aircraft) => (
              <option key={aircraft.id} value={aircraft.id}>
                {aircraft.registration ?? aircraftModelById.get(aircraft.modelId)?.name ?? aircraft.id}
              </option>
            ))}
          </select>
        </label>
        <div style={styles.formGrid}>
          <label style={styles.selectLabel}>
            Frequenza settimanale
            <input
              aria-label="Frequenza settimanale"
              type="number"
              min={1}
              max={7}
              value={weeklyFrequency}
              onChange={(event) => setWeeklyFrequency(Number(event.target.value))}
              style={styles.select}
            />
          </label>
          <label style={styles.selectLabel}>
            Prezzo economy
            <input
              aria-label="Prezzo economy"
              type="number"
              min={1}
              value={economyPrice}
              onChange={(event) => setEconomyPrice(Number(event.target.value))}
              style={styles.select}
            />
          </label>
          <label style={styles.selectLabel}>
            Prezzo business
            <input
              aria-label="Prezzo business"
              type="number"
              min={1}
              value={businessPrice}
              onChange={(event) => setBusinessPrice(Number(event.target.value))}
              style={styles.select}
            />
          </label>
          <Kpi
            label="Profitto settimanale attuale"
            value={formatMoney(proposal.forecast.profit)}
          />
        </div>
        <label style={styles.selectLabel}>
          Strategia
          <select
            aria-label="Strategia"
            style={styles.select}
            value={strategy}
            onChange={(event) =>
              setStrategy(event.target.value as typeof strategy)
            }
          >
            <option value="YIELD_MAXIMIZER">Yield maximizer</option>
            <option value="LOAD_MAXIMIZER">Load maximizer</option>
            <option value="COMPETITOR_MATCH">Competitor match</option>
          </select>
        </label>
        <div style={styles.modalActions}>
          <button style={styles.secondaryButton} onClick={onClose}>Annulla</button>
          <button style={styles.primaryButton} onClick={confirm}>Conferma apertura</button>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" },
  header: { padding: "var(--space-6) var(--space-page)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center" },
  title: { fontSize: "var(--font-size-2xl)" },
  subtitle: { color: "var(--color-text-muted)", marginTop: "var(--space-1)", fontSize: "var(--font-size-sm)" },
  eyebrow: { color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "var(--font-size-xs)", fontWeight: 700 },
  tierBadge: { padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-full)", background: "var(--color-accent-dim)", color: "var(--color-accent)", fontWeight: 700, whiteSpace: "nowrap" },
  main: { width: "min(1120px, 100%)", margin: "0 auto", padding: "var(--space-4) var(--space-page)", flex: 1 },
  routeSelector: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", border: "1px solid var(--color-border)", alignItems: "end" },
  routeArrow: { color: "var(--color-accent)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)", paddingBottom: "var(--space-2)" },
  selectLabel: { display: "flex", flexDirection: "column", gap: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.08em" },
  select: { color: "var(--color-text)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", minWidth: 0 },
  tabs: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", margin: "var(--space-4) 0", gap: "var(--space-1)", padding: "var(--space-1)", background: "var(--color-surface)", borderRadius: "var(--radius-md)" },
  tab: { padding: "var(--space-3)", color: "var(--color-text-muted)", borderRadius: "var(--radius-sm)" },
  tabActive: { color: "var(--color-text)", background: "var(--color-surface-3)" },
  contentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "var(--space-4)", alignItems: "start" },
  card: { padding: "var(--space-4)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-4)" },
  cardTitle: { fontSize: "var(--font-size-lg)", marginTop: "var(--space-1)" },
  metric: { fontSize: "var(--font-size-2xl)", marginTop: "var(--space-1)" },
  quietMetric: { color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" },
  sectionTitle: { color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "var(--font-size-xs)", fontWeight: 700, margin: "var(--space-3) 0" },
  rowBetween: { display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" },
  segment: { marginBottom: "var(--space-3)" },
  segmentSelector: { display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginBottom: "var(--space-3)" },
  segmentChip: { padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-full)", background: "var(--color-surface-2)", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" },
  segmentChipActive: { background: "var(--color-accent-dim)", color: "var(--color-accent)" },
  progress: { height: 6, borderRadius: "var(--radius-full)", background: "var(--color-surface-3)", overflow: "hidden", margin: "var(--space-2) 0 var(--space-1)" },
  progressFill: { height: "100%", display: "block", borderRadius: "inherit" },
  muted: { color: "var(--color-text-muted)", lineHeight: 1.5 },
  seasonality: { height: 150, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", alignItems: "end", gap: "var(--space-1)" },
  monthColumn: { height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-1)", color: "var(--color-text-muted)" },
  monthBar: { width: "100%", maxWidth: 22, background: "linear-gradient(180deg, var(--color-accent), #2563eb)", borderRadius: "var(--radius-sm) var(--radius-sm) 0 0" },
  dataRow: { display: "flex", justifyContent: "space-between", gap: "var(--space-4)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)", fontSize: "var(--font-size-sm)" },
  locked: { position: "relative", minHeight: 48 },
  blurred: { filter: "blur(4px)", opacity: 0.28, userSelect: "none", pointerEvents: "none" },
  lockOverlay: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--color-warning)", fontWeight: 700, fontSize: "var(--font-size-sm)" },
  response: { marginTop: "var(--space-3)", padding: "var(--space-3)", color: "var(--color-accent)", background: "var(--color-accent-dim)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-sm)" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)", alignItems: "end" },
  kpi: { display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "var(--space-3)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" },
  riskScore: { height: 10, background: "var(--color-surface-3)", borderRadius: "var(--radius-full)", overflow: "hidden", marginBottom: "var(--space-3)" },
  slotRow: { display: "flex", gap: "var(--space-3)", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" },
  statusDot: { width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  footer: { position: "sticky", bottom: 0, padding: "var(--space-3) var(--space-page)", background: "color-mix(in srgb, var(--color-bg) 92%, transparent)", borderTop: "1px solid var(--color-border)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" },
  primaryButton: { padding: "var(--space-3) var(--space-5)", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 700, width: "min(420px, 100%)" },
  secondaryButton: { padding: "var(--space-3) var(--space-5)", borderRadius: "var(--radius-md)", background: "var(--color-surface-3)", color: "var(--color-text)", fontWeight: 700 },
  prerequisites: { color: "var(--color-warning)", display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--font-size-sm)", textAlign: "center" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(3, 8, 16, 0.78)", display: "grid", placeItems: "center", padding: "var(--space-4)", zIndex: 10 },
  modal: { width: "min(560px, 100%)", maxHeight: "90dvh", overflowY: "auto", padding: "var(--space-5)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "var(--space-4)" },
  closeButton: { color: "var(--color-text-muted)", fontSize: "var(--font-size-2xl)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" },
};
