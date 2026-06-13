import { useMemo, useState } from "react";
import { BackButton } from "../components/BackButton";

import type {
  GameState,
  OverbookingLevel,
  PricingStrategy,
  Route,
} from "../domain/types";
import {
  BOOKING_CURVES,
  adjustFareClasses,
  calculateBidPrice,
  calculateOverbookingLevel,
  evaluateBookingPace,
  getNoShowRate,
  inferRouteType,
  projectFlightRevenue,
  type BookingPace,
  type FareClass,
} from "../engine/yieldEngine";

interface Props {
  game: GameState;
  onUpdate?: (game: GameState) => void;
}

type MobileSection = "overview" | "detail" | "flash" | "alerts";

const STRATEGIES: ReadonlyArray<{
  id: PricingStrategy;
  label: string;
  impact: string;
}> = [
  {
    id: "YIELD_MAXIMIZER",
    label: "Yield Maximizer",
    impact: "Protegge le classi alte e propone promo solo quando serve.",
  },
  {
    id: "LOAD_MAXIMIZER",
    label: "Load Maximizer",
    impact: "Apre prima le classi basse per aumentare il riempimento.",
  },
  {
    id: "COMPETITOR_MATCH",
    label: "Competitor Match",
    impact: "Mantiene un posizionamento equilibrato rispetto al mercato.",
  },
  {
    id: "PRICE_LEADER",
    label: "Price Leader",
    impact: "Spinge volume e quota con prezzi sotto benchmark.",
  },
  {
    id: "PREMIUM",
    label: "Premium",
    impact: "Difende il floor tariffario e il valore del brand.",
  },
];

const OVERBOOKING_LEVELS: OverbookingLevel[] = [
  "OFF",
  "CONSERVATIVE",
  "MODERATE",
  "AGGRESSIVE",
];

const LOW_FARE_CLASSES = ["Q", "K", "L"] as const;

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function currency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function routeLabel(route: Route) {
  return `${route.originIata} → ${route.destinationIata}`;
}

function currentLoadFactor(route: Route) {
  return Math.max(
    0,
    Math.min(
      1,
      route.load_factor ?? route.performanceHistory.at(-1)?.loadFactor ?? 0,
    ),
  );
}

function paceTone(pace: BookingPace) {
  if (pace === "AHEAD") return "yield-positive";
  if (pace === "BEHIND") return "yield-negative";
  return "yield-neutral";
}

function routeWithPatch(route: Route, patch: Partial<Route>): Route {
  return { ...route, ...patch };
}

function pathFor(values: readonly number[], width = 600, height = 170) {
  if (values.length === 0) return "";

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - Math.max(0, Math.min(1, value)) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function historyPath(route: Route) {
  const history = route.performanceHistory.slice(-12).map((item) => item.loadFactor);
  return history.length > 0 ? pathFor(history) : "";
}

export function YieldManagement({ game, onUpdate }: Props) {
  const activeRoutes = useMemo(
    () => game.routes.filter((route) => route.status === "active"),
    [game.routes],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    activeRoutes[0]?.id ?? null,
  );
  const [mobileSection, setMobileSection] =
    useState<MobileSection>("overview");
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [discount, setDiscount] = useState(15);
  const [durationDays, setDurationDays] = useState(3);
  const [saleClasses, setSaleClasses] = useState<string[]>(["Q", "K"]);
  const [activeSaleRoute, setActiveSaleRoute] = useState<string | null>(null);

  const selected =
    activeRoutes.find((route) => route.id === selectedId) ??
    activeRoutes[0] ??
    null;
  const alerts = useMemo(
    () =>
      activeRoutes.flatMap((route) => {
        const pace = evaluateBookingPace(route, 30);
        const label = routeLabel(route);
        const routeAlerts: Array<{ id: string; message: string; tone: string }> = [];

        if (pace === "BEHIND" && route.performanceHistory.length >= 8) {
          routeAlerts.push({
            id: `${route.id}-behind`,
            message: `${label} è sotto la booking curve da ${route.performanceHistory.length} rilevazioni. Considera una flash sale.`,
            tone: "yield-negative",
          });
        }
        if (pace === "AHEAD" && route.performanceHistory.length >= 15) {
          routeAlerts.push({
            id: `${route.id}-ahead`,
            message: `${label} è sopra la booking curve: chiudi le classi basse e proteggi lo yield.`,
            tone: "yield-positive",
          });
        }

        const overbookingRate =
          calculateOverbookingLevel(route) /
          Math.max(1, route.economySeats + route.businessSeats);
        if (overbookingRate > 0.05) {
          routeAlerts.push({
            id: `${route.id}-overbooking`,
            message: `${label} supera il 5% di overbooking: verifica il rischio e il costo EU261.`,
            tone: "yield-warning",
          });
        }

        return routeAlerts;
      }),
    [activeRoutes],
  );
  const visibleAlerts = alerts.filter(
    (alert) => !dismissedAlerts.includes(alert.id),
  );

  function emitRouteUpdate(routeId: string, patch: Partial<Route>) {
    if (!onUpdate) return;

    const routes = game.routes.map((route) =>
      route.id === routeId ? routeWithPatch(route, patch) : route,
    );
    onUpdate({
      ...game,
      routes,
      player: {
        ...game.player,
        routes: game.player.routes.map((route) =>
          route.id === routeId ? routeWithPatch(route, patch) : route,
        ),
      },
    });
  }

  function runFlashSale() {
    if (!selected) return;

    const multiplier = 1 - discount / 100;
    emitRouteUpdate(selected.id, {
      economyPrice: Math.round(selected.economyPrice * multiplier),
    });
    setActiveSaleRoute(selected.id);
  }

  return (
    <div className="yield-page">
      <style>{YIELD_STYLES}</style>
      <header className="yield-header" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <BackButton />
        <div style={{ flex: 1 }}>
          <div className="yield-kicker">AEROGRID · REVENUE CONTROL</div>
          <h1>Yield Management</h1>
          <p>{game.airlineName} · booking curves e inventario tariffario</p>
        </div>
        <div className="yield-header-metrics">
          <Metric label="Rotte attive" value={String(activeRoutes.length)} />
          <Metric label="Alert" value={String(visibleAlerts.length)} tone="warning" />
          <Metric label="Turno" value={String(game.turn)} />
        </div>
      </header>

      <nav className="yield-mobile-tabs" aria-label="Sezioni Yield Management">
        {(
          [
            ["overview", "Panoramica"],
            ["detail", "Dettaglio"],
            ["flash", "Flash sale"],
            ["alerts", "Alert"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={mobileSection === id ? "active" : ""}
            onClick={() => setMobileSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="yield-layout">
        <section
          className={`yield-panel yield-overview yield-mobile-section ${mobileSection === "overview" ? "active" : ""}`}
        >
          <SectionHeading
            title="Panoramica rotte"
            subtitle="Pace, strategia e valore atteso dei voli attivi"
          />
          {activeRoutes.length === 0 ? (
            <div className="yield-empty">
              Nessuna rotta attiva da monitorare.
            </div>
          ) : (
            <div className="yield-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rotta</th>
                    <th>Load factor</th>
                    <th>Pace</th>
                    <th>Strategia</th>
                    <th>Revenue proiettata</th>
                    <th>Bid price</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRoutes.map((route) => {
                    const pace = evaluateBookingPace(route, 30);
                    const projection = projectFlightRevenue(route);
                    const isSelected = route.id === selected?.id;
                    return (
                      <tr
                        key={route.id}
                        className={isSelected ? "selected" : ""}
                        onClick={() => {
                          setSelectedId(route.id);
                          setMobileSection("detail");
                        }}
                      >
                        <td>
                          <button
                            className="yield-route-link"
                            aria-label={`Apri dettaglio ${routeLabel(route)}`}
                          >
                            <strong>{routeLabel(route)}</strong>
                            <span>{inferRouteType(route)}</span>
                          </button>
                        </td>
                        <td>{percentage(currentLoadFactor(route))}</td>
                        <td>
                          <span className={`yield-status ${paceTone(pace)}`}>
                            {pace}
                          </span>
                        </td>
                        <td>{route.pricing_strategy ?? "COMPETITOR_MATCH"}</td>
                        <td>{currency(projection.projected_revenue)}</td>
                        <td>{currency(calculateBidPrice(route, game.game_date))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <RouteDetail
            route={selected}
            game={game}
            mobileSection={mobileSection}
            onStrategyChange={(pricingStrategy) =>
              emitRouteUpdate(selected.id, { pricing_strategy: pricingStrategy })
            }
            onOverbookingChange={(overbookingLevel) =>
              emitRouteUpdate(selected.id, { overbooking_level: overbookingLevel })
            }
          />
        )}

        <section
          className={`yield-panel yield-flash yield-mobile-section ${mobileSection === "flash" ? "active" : ""}`}
          aria-label="Flash sale"
        >
          <SectionHeading
            title="Flash sale"
            subtitle={selected ? routeLabel(selected) : "Seleziona una rotta"}
          />
          {selected && (
            <>
              <label className="yield-field">
                <span>Sconto <strong>{discount}%</strong></span>
                <input
                  aria-label="Sconto flash sale"
                  type="range"
                  min="5"
                  max="40"
                  step="5"
                  value={discount}
                  onChange={(event) => setDiscount(Number(event.target.value))}
                />
              </label>
              <label className="yield-field">
                <span>Durata</span>
                <select
                  aria-label="Durata flash sale"
                  value={durationDays}
                  onChange={(event) => setDurationDays(Number(event.target.value))}
                >
                  <option value="1">1 giorno</option>
                  <option value="3">3 giorni</option>
                  <option value="7">7 giorni</option>
                </select>
              </label>
              <fieldset className="yield-class-picker">
                <legend>Classi coinvolte</legend>
                {LOW_FARE_CLASSES.map((fareClass) => (
                  <label key={fareClass}>
                    <input
                      type="checkbox"
                      checked={saleClasses.includes(fareClass)}
                      onChange={(event) =>
                        setSaleClasses((current) =>
                          event.target.checked
                            ? [...current, fareClass]
                            : current.filter((item) => item !== fareClass),
                        )
                      }
                    />
                    {fareClass}
                  </label>
                ))}
              </fieldset>
              <FlashSaleEstimate
                route={selected}
                discount={discount}
                durationDays={durationDays}
                classCount={saleClasses.length}
              />
              <button
                className="yield-primary-button"
                disabled={saleClasses.length === 0}
                onClick={runFlashSale}
              >
                Avvia flash sale
              </button>
              {activeSaleRoute === selected.id && (
                <div className="yield-success-message">
                  Flash sale attiva su {saleClasses.join(", ")} per {durationDays} giorni.
                </div>
              )}
            </>
          )}
        </section>

        <section
          className={`yield-panel yield-alerts yield-mobile-section ${mobileSection === "alerts" ? "active" : ""}`}
          aria-label="Alert automatici"
        >
          <SectionHeading
            title="Alert automatici"
            subtitle="Suggerimenti non intrusivi basati sul booking pace"
          />
          {visibleAlerts.length === 0 ? (
            <div className="yield-empty">Nessun alert attivo.</div>
          ) : (
            <div className="yield-alert-list">
              {visibleAlerts.map((alert) => (
                <article key={alert.id} className={`yield-alert ${alert.tone}`}>
                  <p>{alert.message}</p>
                  <button
                    aria-label={`Ignora alert ${alert.id}`}
                    onClick={() =>
                      setDismissedAlerts((current) => [...current, alert.id])
                    }
                  >
                    Ignora
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RouteDetail({
  route,
  game,
  mobileSection,
  onStrategyChange,
  onOverbookingChange,
}: {
  route: Route;
  game: GameState;
  mobileSection: MobileSection;
  onStrategyChange: (strategy: PricingStrategy) => void;
  onOverbookingChange: (level: OverbookingLevel) => void;
}) {
  const pace = evaluateBookingPace(route, 30);
  const routeType = inferRouteType(route);
  const fareUpdate = adjustFareClasses(route, pace);
  const expectedPath = pathFor(BOOKING_CURVES[routeType]);
  const actualPath = historyPath(route);
  const capacity = route.economySeats + route.businessSeats;
  const overbookedSeats = calculateOverbookingLevel(route);
  const overbookingRate = overbookedSeats / Math.max(1, capacity);
  const bumpingRate = Math.max(0, overbookingRate - getNoShowRate(route));
  const eu261Cost = bumpingRate * capacity * route.weeklyFrequency * 4 * 400;
  const activeStrategy = route.pricing_strategy ?? "COMPETITOR_MATCH";
  const strategyInfo = STRATEGIES.find((item) => item.id === activeStrategy);

  return (
    <section
      className={`yield-panel yield-detail yield-mobile-section ${mobileSection === "detail" ? "active" : ""}`}
    >
      <SectionHeading
        title={routeLabel(route)}
        subtitle={`${routeType} · ${route.weeklyFrequency} frequenze/settimana`}
      />

      <div className="yield-detail-kpis">
        <Metric label="Pace" value={pace} tone={pace === "BEHIND" ? "warning" : "default"} />
        <Metric
          label="Bid price"
          value={currency(calculateBidPrice(route, game.game_date))}
        />
        <Metric label="No-show storico" value={percentage(getNoShowRate(route))} />
        <Metric label="Bumping rate" value={percentage(bumpingRate)} tone="warning" />
        <Metric label="EU261 / mese" value={currency(eu261Cost)} tone="warning" />
      </div>

      <div className="yield-subpanel">
        <h3>Booking curve</h3>
        <div className="yield-chart" aria-label="Booking curve attesa e reale">
          <svg viewBox="0 0 600 200" role="img">
            {[0, 0.25, 0.5, 0.75, 1].map((value) => (
              <line
                key={value}
                x1="0"
                y1={170 - value * 170}
                x2="600"
                y2={170 - value * 170}
                className="yield-grid-line"
              />
            ))}
            <path d={expectedPath} className="yield-expected-line" />
            {actualPath && <path d={actualPath} className="yield-actual-line" />}
          </svg>
          <div className="yield-chart-legend">
            <span>Attesa 90 → 1 giorni</span>
            <span>Reale ultime {Math.min(route.performanceHistory.length, 12)} rilevazioni</span>
          </div>
        </div>
      </div>

      <div className="yield-subpanel">
        <h3>Classi tariffarie</h3>
        <div className="yield-fare-grid">
          {fareUpdate.classes.map((fareClass) => (
            <FareClassCell key={fareClass.code} fareClass={fareClass} />
          ))}
        </div>
        <p className="yield-helper">{fareUpdate.reason}</p>
      </div>

      <div className="yield-control-grid">
        <div className="yield-subpanel">
          <h3>Overbooking</h3>
          <div className="yield-segmented">
            {OVERBOOKING_LEVELS.map((level) => (
              <button
                key={level}
                className={(route.overbooking_level ?? "MODERATE") === level ? "active" : ""}
                onClick={() => onOverbookingChange(level)}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="yield-helper">
            Livello ottimale: +{overbookedSeats} posti rispetto alla capacità.
          </p>
        </div>

        <div className="yield-subpanel">
          <label className="yield-field">
            <span>Strategia pricing</span>
            <select
              aria-label="Strategia pricing"
              value={activeStrategy}
              onChange={(event) =>
                onStrategyChange(event.target.value as PricingStrategy)
              }
            >
              {STRATEGIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="yield-helper">{strategyInfo?.impact}</p>
        </div>
      </div>
    </section>
  );
}

function FareClassCell({ fareClass }: { fareClass: FareClass }) {
  return (
    <div className={`yield-fare-cell ${fareClass.is_open ? "open" : "closed"}`}>
      <strong>{fareClass.code}</strong>
      <span>{fareClass.cabin.replace("_", " ")}</span>
      <span>{currency(fareClass.price)}</span>
      <small>{fareClass.is_open ? "APERTA" : "CHIUSA"}</small>
    </div>
  );
}

function FlashSaleEstimate({
  route,
  discount,
  durationDays,
  classCount,
}: {
  route: Route;
  discount: number;
  durationDays: number;
  classCount: number;
}) {
  const projection = projectFlightRevenue(route);
  const recoveryFactor = Math.min(0.12, discount / 250 + durationDays / 500);
  const extraPassengers = Math.round(
    (route.economySeats + route.businessSeats) *
      recoveryFactor *
      (classCount / LOW_FARE_CLASSES.length),
  );
  const discountedFare = route.economyPrice * (1 - discount / 100);
  const incrementalRevenue = Math.round(extraPassengers * discountedFare);
  const cannibalization = Math.round(
    projection.projected_revenue * (discount / 100) * 0.08,
  );

  return (
    <div className="yield-sale-estimate">
      <Metric label="Prenotazioni attese" value={`+${extraPassengers}`} />
      <Metric
        label="Delta revenue"
        value={currency(incrementalRevenue - cannibalization)}
        tone="positive"
      />
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="yield-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "positive";
}) {
  return (
    <div className={`yield-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const YIELD_STYLES = `
.yield-page {
  min-height: 100dvh;
  background: #080e1a;
  color: #e2e8f0;
  font-family: var(--font-family-sans);
}
.yield-page button, .yield-page select, .yield-page input { font: inherit; }
.yield-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px clamp(16px, 3vw, 36px);
  background: #0a1628;
  border-bottom: 1px solid #1e2d45;
}
.yield-header h1 { margin-top: 3px; font-size: clamp(24px, 3vw, 34px); }
.yield-header p, .yield-section-heading p, .yield-helper {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}
.yield-kicker { color: #00c8ff; font-size: 9px; font-weight: 800; letter-spacing: .2em; }
.yield-header-metrics, .yield-detail-kpis, .yield-sale-estimate {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.yield-metric {
  min-width: 98px;
  padding: 8px 10px;
  border: 1px solid #1e2d45;
  border-radius: 8px;
  background: #0a1220;
}
.yield-metric span { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; }
.yield-metric strong { display: block; margin-top: 2px; font-size: 13px; }
.yield-metric.warning strong { color: #f59e0b; }
.yield-metric.positive strong { color: #34d399; }
.yield-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, .8fr);
  grid-template-areas:
    "overview overview"
    "detail flash"
    "detail alerts";
  gap: 14px;
  padding: 14px clamp(12px, 2vw, 24px) 36px;
}
.yield-panel {
  min-width: 0;
  border: 1px solid #1e2d45;
  border-radius: 12px;
  background: #0f1829;
  padding: 16px;
}
.yield-overview { grid-area: overview; }
.yield-detail { grid-area: detail; }
.yield-flash { grid-area: flash; }
.yield-alerts { grid-area: alerts; }
.yield-section-heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.yield-section-heading h2 { font-size: 16px; }
.yield-table-wrap { overflow-x: auto; }
.yield-table-wrap table { width: 100%; min-width: 900px; border-collapse: collapse; }
.yield-table-wrap th {
  padding: 7px 10px;
  color: #64748b;
  font-size: 9px;
  letter-spacing: .08em;
  text-align: left;
  text-transform: uppercase;
}
.yield-table-wrap td {
  padding: 10px;
  border-top: 1px solid #0d1729;
  color: #cbd5e1;
  font-size: 11px;
}
.yield-table-wrap tbody tr { cursor: pointer; transition: background .15s ease; }
.yield-table-wrap tbody tr:hover, .yield-table-wrap tbody tr.selected { background: #0a2234; }
.yield-route-link { color: #e2e8f0; text-align: left; }
.yield-route-link strong, .yield-route-link span { display: block; }
.yield-route-link span { margin-top: 2px; color: #64748b; font-size: 9px; }
.yield-status {
  display: inline-block;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 800;
}
.yield-positive { color: #34d399; border-color: rgba(52,211,153,.35); }
.yield-negative { color: #f87171; border-color: rgba(248,113,113,.35); }
.yield-warning { color: #f59e0b; border-color: rgba(245,158,11,.35); }
.yield-neutral { color: #00c8ff; }
.yield-status.yield-positive { background: rgba(52,211,153,.12); }
.yield-status.yield-negative { background: rgba(248,113,113,.12); }
.yield-status.yield-neutral { background: rgba(0,200,255,.12); }
.yield-detail-kpis { margin-bottom: 14px; }
.yield-subpanel {
  margin-top: 12px;
  padding: 13px;
  border: 1px solid #16253a;
  border-radius: 9px;
  background: #0a1220;
}
.yield-subpanel h3 { margin-bottom: 10px; color: #cbd5e1; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.yield-chart { overflow: hidden; }
.yield-chart svg { width: 100%; min-height: 170px; }
.yield-grid-line { stroke: #172237; stroke-width: 1; }
.yield-expected-line { fill: none; stroke: #64748b; stroke-width: 3; stroke-dasharray: 8 6; }
.yield-actual-line { fill: none; stroke: #00c8ff; stroke-width: 4; }
.yield-chart-legend { display: flex; justify-content: space-between; gap: 10px; color: #64748b; font-size: 9px; }
.yield-fare-grid { display: grid; grid-template-columns: repeat(5, minmax(72px, 1fr)); gap: 6px; }
.yield-fare-cell {
  min-width: 0;
  padding: 8px;
  border: 1px solid #1e2d45;
  border-radius: 7px;
  background: #080e1a;
}
.yield-fare-cell.open { border-color: rgba(52,211,153,.42); background: rgba(52,211,153,.06); }
.yield-fare-cell.closed { opacity: .48; }
.yield-fare-cell strong, .yield-fare-cell span, .yield-fare-cell small { display: block; }
.yield-fare-cell strong { color: #e2e8f0; font-size: 13px; }
.yield-fare-cell span { margin-top: 2px; color: #94a3b8; font-size: 8px; overflow: hidden; text-overflow: ellipsis; }
.yield-fare-cell small { margin-top: 5px; color: #34d399; font-size: 7px; }
.yield-fare-cell.closed small { color: #64748b; }
.yield-control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.yield-segmented { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; }
.yield-segmented button {
  padding: 7px;
  border: 1px solid #1e2d45;
  border-radius: 6px;
  color: #64748b;
  font-size: 8px;
  font-weight: 800;
}
.yield-segmented button.active { border-color: #00c8ff; background: rgba(0,200,255,.1); color: #00c8ff; }
.yield-field { display: grid; gap: 7px; margin-bottom: 12px; color: #94a3b8; font-size: 11px; }
.yield-field span { display: flex; justify-content: space-between; gap: 8px; }
.yield-field select {
  width: 100%;
  padding: 8px;
  border: 1px solid #1e2d45;
  border-radius: 6px;
  background: #080e1a;
  color: #e2e8f0;
  font-size: 10px;
}
.yield-field input[type="range"] { accent-color: #00c8ff; }
.yield-class-picker {
  display: flex;
  gap: 10px;
  margin: 0 0 12px;
  padding: 10px;
  border: 1px solid #1e2d45;
  border-radius: 7px;
  color: #94a3b8;
}
.yield-class-picker legend { padding: 0 5px; color: #64748b; font-size: 9px; }
.yield-class-picker label { display: flex; gap: 4px; align-items: center; font-size: 10px; }
.yield-primary-button {
  width: 100%;
  margin-top: 12px;
  padding: 9px 12px;
  border: 1px solid #00c8ff;
  border-radius: 7px;
  background: rgba(0,200,255,.12);
  color: #00c8ff;
  font-size: 11px;
  font-weight: 800;
}
.yield-primary-button:disabled { cursor: not-allowed; opacity: .4; }
.yield-success-message { margin-top: 9px; color: #34d399; font-size: 10px; line-height: 1.5; }
.yield-alert-list { display: grid; gap: 8px; }
.yield-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px;
  border: 1px solid;
  border-radius: 7px;
  background: #0a1220;
}
.yield-alert p { flex: 1; color: #cbd5e1; font-size: 10px; line-height: 1.5; }
.yield-alert button { color: inherit; font-size: 9px; text-decoration: underline; }
.yield-empty { padding: 24px; color: #64748b; font-size: 11px; text-align: center; }
.yield-mobile-tabs { display: none; }
@media (max-width: 900px) {
  .yield-header { align-items: flex-start; flex-direction: column; }
  .yield-layout { grid-template-columns: 1fr; grid-template-areas: "overview" "detail" "flash" "alerts"; }
  .yield-fare-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 767px) {
  .yield-header { padding: 15px 13px; }
  .yield-header-metrics { width: 100%; }
  .yield-header-metrics .yield-metric { flex: 1; }
  .yield-mobile-tabs {
    position: sticky;
    top: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: #0a1220;
    border-bottom: 1px solid #1e2d45;
  }
  .yield-mobile-tabs button { padding: 10px 3px; color: #64748b; font-size: 9px; }
  .yield-mobile-tabs button.active { color: #00c8ff; box-shadow: inset 0 -2px #00c8ff; }
  .yield-layout { padding: 10px; }
  .yield-mobile-section { display: none; }
  .yield-mobile-section.active { display: block; }
  .yield-panel { padding: 12px; }
  .yield-control-grid { grid-template-columns: 1fr; }
  .yield-fare-grid { grid-template-columns: repeat(3, 1fr); }
  .yield-chart-legend { flex-direction: column; }
}
`;
