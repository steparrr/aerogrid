import { useState } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import { aircraftModelById } from "../data/indexes";
import { calculateDistanceKm, calculateBlockTime } from "../simulation/geography";
import { WorldMap } from "./WorldMap";
import type { GameView, RouteDraft } from "../domain/types";

const MAX_WEEKLY_HOURS = 112; // 16h/giorno × 7

const NAV_ITEMS: { view: GameView; icon: string; label: string }[] = [
  { view: "operations", icon: "⚡", label: "Centro" },
  { view: "routes",     icon: "🗺",  label: "Rotte" },
  { view: "fleet",      icon: "✈",  label: "Flotta" },
  { view: "finance",    icon: "💰", label: "Finanze" },
  { view: "planner",    icon: "➕", label: "Planner" },
];

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function RoutePlannerScreen() {
  const { state, dispatch } = useGame();

  const [originIata, setOriginIata]   = useState("");
  const [destIata, setDestIata]       = useState("");
  const [aircraftId, setAircraftId]   = useState("");
  const [frequency, setFrequency]     = useState(3);
  const [operatingDays, setDays]      = useState([1, 2, 3, 4, 5]);
  const [ecoPrice, setEcoPrice]       = useState(0);
  const [bizPrice, setBizPrice]       = useState(0);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(false);

  if (!state) return null;

  const availableAircraft = state.fleet.filter(ac => {
    const m = aircraftModelById.get(ac.modelId);
    return m?.role === "passenger";
  });

  const originAirport = airports.find(a => a.iata === originIata);
  const destAirport   = airports.find(a => a.iata === destIata);
  const selectedAc    = state.fleet.find(ac => ac.id === aircraftId);
  const selectedModel = selectedAc ? aircraftModelById.get(selectedAc.modelId) : null;

  const distanceKm = originAirport && destAirport
    ? Math.round(calculateDistanceKm(originAirport.coordinates, destAirport.coordinates))
    : null;

  // Prezzi suggeriti se non ancora impostati
  const suggestedEco = distanceKm ? Math.round(distanceKm * 0.10) : 0;
  const suggestedBiz = distanceKm ? Math.round(distanceKm * 0.28) : 0;

  // Calcolo utilizzo aereo
  const utilizationInfo = (() => {
    if (!selectedModel || !distanceKm) return null;
    const blockHours = calculateBlockTime(distanceKm, selectedModel.cruiseSpeedKmh);
    const turnaroundH = selectedModel.turnaroundMinutes / 60;
    const hoursPerRotation = blockHours * 2 + turnaroundH;
    const weeklyHoursUsed = hoursPerRotation * frequency;
    const existingHours = selectedAc
      ? state.fleet.find(a => a.id === selectedAc.id)?.utilizationHoursPerDay ?? 0
      : 0;
    const existingWeekly = existingHours * 7;
    const totalWeekly = existingWeekly + weeklyHoursUsed;
    const freeHours = Math.max(0, MAX_WEEKLY_HOURS - totalWeekly);
    const overLimit = totalWeekly > MAX_WEEKLY_HOURS;
    return { weeklyHoursUsed: Math.round(weeklyHoursUsed * 10) / 10, totalWeekly: Math.round(totalWeekly * 10) / 10, freeHours: Math.round(freeHours * 10) / 10, overLimit, blockHours: Math.round(blockHours * 10) / 10 };
  })();

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  function handleOpen() {
    setError("");
    if (!originIata || !destIata) { setError("Scegli aeroporto di origine e destinazione."); return; }
    if (originIata === destIata)  { setError("Origine e destinazione devono essere diversi."); return; }
    if (!aircraftId)              { setError("Seleziona un aereo dalla tua flotta."); return; }
    if (operatingDays.length === 0) { setError("Seleziona almeno un giorno operativo."); return; }
    const finalEco = ecoPrice || suggestedEco;
    const finalBiz = bizPrice || suggestedBiz;
    if (finalEco <= 0 || finalBiz <= 0) { setError("Prezzi non validi."); return; }

    const model = selectedModel;
    if (!model) { setError("Modello aereo non trovato."); return; }

    const draft: RouteDraft = {
      originIata,
      destinationIata: destIata,
      aircraftId,
      weeklyFrequency: frequency,
      operatingDays,
      departureTime: "08:00",
      economySeats: model.economyCapacity,
      businessSeats: model.businessCapacity,
      economyPrice: finalEco,
      businessPrice: finalBiz,
    };

    dispatch({ type: "OPEN_ROUTE", payload: draft });
    setSuccess(true);
    setTimeout(() => {
      dispatch({ type: "SET_VIEW", payload: "routes" });
    }, 1500);
  }

  if (success) {
    return (
      <div style={{ ...s.page, alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <div style={{ fontSize: "3rem" }}>✅</div>
        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: "var(--color-success)" }}>Rotta aperta!</div>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{originIata} → {destIata}</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerTitle}>Apri nuova rotta</div>
        <div style={s.hubBadge}>{state.hubIata}</div>
      </header>

      <main style={s.main}>

        {/* Mappa */}
        <WorldMap
          selectedIatas={[originIata, destIata].filter(Boolean)}
          onAirportClick={iata => {
            if (!originIata) { setOriginIata(iata); return; }
            if (!destIata && iata !== originIata) { setDestIata(iata); return; }
            if (iata === originIata) { setOriginIata(""); return; }
            setDestIata(iata);
          }}
          demandOriginIata={originIata || undefined}
          height={220}
        />

        {/* Step 1 — Aeroporti */}
        <section style={s.section}>
          <div style={s.sectionTitle}>1. Tratta</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Origine</label>
              <select style={s.select} value={originIata} onChange={e => setOriginIata(e.target.value)}>
                <option value="">— scegli —</option>
                {airports.map(a => <option key={a.iata} value={a.iata}>{a.iata} – {a.name.split(" ").slice(0,2).join(" ")}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Destinazione</label>
              <select style={s.select} value={destIata} onChange={e => setDestIata(e.target.value)}>
                <option value="">— scegli —</option>
                {airports.filter(a => a.iata !== originIata).map(a => <option key={a.iata} value={a.iata}>{a.iata} – {a.name.split(" ").slice(0,2).join(" ")}</option>)}
              </select>
            </div>
          </div>
          {distanceKm && (
            <div style={s.distanceBadge}>📍 {distanceKm.toLocaleString("it-IT")} km</div>
          )}
        </section>

        {/* Step 2 — Aereo */}
        <section style={s.section}>
          <div style={s.sectionTitle}>2. Aereo</div>
          {availableAircraft.length === 0 ? (
            <div style={s.warningBox}>
              Nessun aereo in flotta. <button style={s.inlineBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "fleet" })}>Vai alla Flotta →</button>
            </div>
          ) : (
            <select style={s.select} value={aircraftId} onChange={e => setAircraftId(e.target.value)}>
              <option value="">— scegli —</option>
              {availableAircraft.map(ac => {
                const m = aircraftModelById.get(ac.modelId);
                return <option key={ac.id} value={ac.id}>{m?.manufacturer} {m?.name} ({m?.economyCapacity}+{m?.businessCapacity} pax, {m?.rangeKm?.toLocaleString("it-IT")} km)</option>;
              })}
            </select>
          )}
          {selectedModel && distanceKm && selectedModel.rangeKm < distanceKm && (
            <div style={s.warningBox}>⚠ Il range dell'aereo ({selectedModel.rangeKm.toLocaleString("it-IT")} km) è insufficiente per questa rotta.</div>
          )}
          {utilizationInfo && (
            <div style={{ ...s.utilizationBox, borderColor: utilizationInfo.overLimit ? "var(--color-danger)" : "var(--color-border)", background: utilizationInfo.overLimit ? "var(--color-danger-bg)" : "var(--color-surface-2)" }}>
              <div style={s.utilRow}>
                <UtilStat label="Block time" value={`${utilizationInfo.blockHours}h`} />
                <UtilStat label="Ore rotta/sett" value={`${utilizationInfo.weeklyHoursUsed}h`} />
                <UtilStat label="Ore totali/sett" value={`${utilizationInfo.totalWeekly}h / ${MAX_WEEKLY_HOURS}h`} color={utilizationInfo.overLimit ? "var(--color-danger)" : "var(--color-success)"} />
                <UtilStat label="Ore libere/sett" value={`${utilizationInfo.freeHours}h`} color={utilizationInfo.freeHours < 10 ? "var(--color-warning)" : "var(--color-text)"} />
              </div>
              {utilizationInfo.overLimit && <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger)", marginTop: 4 }}>⚠ Utilizzo superiore al massimo consentito (112h/sett). Riduci la frequenza.</div>}
            </div>
          )}
        </section>

        {/* Step 3 — Frequenza */}
        <section style={s.section}>
          <div style={s.sectionTitle}>3. Frequenza</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Voli/settimana</label>
              <select style={s.select} value={frequency} onChange={e => setFrequency(Number(e.target.value))}>
                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
          </div>
          <div style={s.daysRow}>
            {DAYS.map((d, i) => (
              <button
                key={i}
                style={{
                  ...s.dayBtn,
                  background: operatingDays.includes(i + 1) ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: operatingDays.includes(i + 1) ? "#0b1622" : "var(--color-text-muted)",
                }}
                onClick={() => toggleDay(i + 1)}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* Step 4 — Prezzi */}
        <section style={s.section}>
          <div style={s.sectionTitle}>4. Prezzi</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Economy ($)</label>
              <input
                style={s.input}
                type="number"
                placeholder={suggestedEco ? String(suggestedEco) : "es. 350"}
                value={ecoPrice || ""}
                onChange={e => setEcoPrice(Number(e.target.value))}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Business ($)</label>
              <input
                style={s.input}
                type="number"
                placeholder={suggestedBiz ? String(suggestedBiz) : "es. 980"}
                value={bizPrice || ""}
                onChange={e => setBizPrice(Number(e.target.value))}
              />
            </div>
          </div>
          {distanceKm && (
            <div style={s.hint}>Suggeriti: Eco ${suggestedEco} · Biz ${suggestedBiz} (lascia vuoto per usarli)</div>
          )}
        </section>

        {error && <div style={s.errorBox}>{error}</div>}

        <button
          style={{
            ...s.openBtn,
            opacity: !originIata || !destIata || !aircraftId ? 0.45 : 1,
          }}
          onClick={handleOpen}
          disabled={!originIata || !destIata || !aircraftId}
        >
          Apri rotta {originIata && destIata ? `${originIata} → ${destIata}` : ""}
        </button>

        <div style={{ height: "var(--nav-height)" }} />
      </main>

      <nav style={s.nav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            style={{ ...s.navBtn, color: state.currentView === item.view ? "var(--color-accent)" : "var(--color-text-muted)" }}
            onClick={() => dispatch({ type: "SET_VIEW", payload: item.view })}
          >
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function UtilStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: color ?? "var(--color-text)" }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" },
  header: { height: "var(--header-height)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-page)", position: "sticky", top: 0, zIndex: 10 },
  headerTitle: { fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text)" },
  hubBadge: { background: "var(--color-accent-dim)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", borderRadius: "var(--radius-full)", fontSize: "var(--font-size-xs)", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 10px" },
  main: { flex: 1, padding: "var(--space-4) var(--space-page)", display: "flex", flexDirection: "column", gap: "var(--space-5)", overflowY: "auto" },
  section: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  sectionTitle: { fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-accent)", letterSpacing: "0.04em" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" },
  field: { display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  label: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 500 },
  select: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)", padding: "var(--space-3)", fontSize: "var(--font-size-sm)", outline: "none" },
  input: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)", padding: "var(--space-3)", fontSize: "var(--font-size-sm)", outline: "none" },
  distanceBadge: { fontSize: "var(--font-size-sm)", color: "var(--color-accent)", background: "var(--color-accent-dim)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", alignSelf: "flex-start" as const },
  daysRow: { display: "flex", gap: "var(--space-1)" },
  dayBtn: { flex: 1, padding: "var(--space-2) 0", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", fontWeight: 600, border: "none", cursor: "pointer" },
  hint: { fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)" },
  warningBox: { fontSize: "var(--font-size-sm)", color: "var(--color-warning)", background: "var(--color-warning-bg)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)" },
  inlineBtn: { background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", fontWeight: 600, fontSize: "inherit" },
  errorBox: { fontSize: "var(--font-size-sm)", color: "var(--color-danger)", background: "var(--color-danger-bg)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)" },
  openBtn: { background: "var(--color-accent)", color: "#0b1622", fontWeight: 700, fontSize: "var(--font-size-base)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer" },
  nav: { height: "var(--nav-height)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", display: "flex", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer" },
  utilizationBox: { border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" },
  utilRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-3)" },
};
