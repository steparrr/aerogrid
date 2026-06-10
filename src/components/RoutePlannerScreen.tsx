import { useState } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import { aircraftModelById } from "../data/indexes";
import { calculateDistanceKm, calculateBlockTime } from "../simulation/geography";
import { WorldMap } from "./WorldMap";
import type { GameView, RouteDraft } from "../domain/types";

const MAX_WEEKLY_HOURS = 112;

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
  const [operatingDays, setDays]      = useState([1, 2, 3]);
  const [ecoPrice, setEcoPrice]       = useState(0);
  const [bizPrice, setBizPrice]       = useState(0);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(false);
  const [sheetOpen, setSheetOpen]     = useState(true);

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

  const suggestedEco = distanceKm ? Math.round(distanceKm * 0.10) : 0;
  const suggestedBiz = distanceKm ? Math.round(distanceKm * 0.28) : 0;

  const utilizationInfo = (() => {
    if (!selectedModel || !distanceKm) return null;
    const blockHours     = calculateBlockTime(distanceKm, selectedModel.cruiseSpeedKmh);
    const turnaroundH    = selectedModel.turnaroundMinutes / 60;
    const hoursPerRot    = blockHours * 2 + turnaroundH * 2; // turnaround a entrambi i capi
    const weeklyHoursNew = hoursPerRot * frequency;
    const existingHours  = selectedAc
      ? (state.fleet.find(a => a.id === selectedAc.id)?.utilizationHoursPerDay ?? 0)
      : 0;
    const totalWeekly    = existingHours * 7 + weeklyHoursNew;
    const freeHours      = Math.max(0, MAX_WEEKLY_HOURS - totalWeekly);
    const overLimit      = totalWeekly > MAX_WEEKLY_HOURS;

    // Limite calendario: ogni rotazione richiede almeno ceil(hoursPerRot/24) giorni
    const gapDays    = Math.max(1, Math.ceil(hoursPerRot / 24));
    const maxFreq    = Math.floor(7 / gapDays);
    const overCalendar = frequency > maxFreq;

    return {
      blockHours:      Math.round(blockHours * 10) / 10,
      hoursPerRot:     Math.round(hoursPerRot * 10) / 10,
      weeklyHoursNew:  Math.round(weeklyHoursNew * 10) / 10,
      totalWeekly:     Math.round(totalWeekly * 10) / 10,
      freeHours:       Math.round(freeHours * 10) / 10,
      overLimit,
      maxFreq,
      overCalendar,
    };
  })();

  function handleFrequencyChange(n: number) {
    setFrequency(n);
    // ricalcola i giorni: prendi i primi n giorni della settimana già selezionati,
    // oppure aggiungi giorni consecutivi se ne mancano
    setDays(prev => {
      const sorted = [...prev].sort();
      if (sorted.length >= n) return sorted.slice(0, n);
      const extras = [1,2,3,4,5,6,7].filter(d => !sorted.includes(d));
      return [...sorted, ...extras.slice(0, n - sorted.length)].sort();
    });
  }

  function toggleDay(d: number) {
    setDays(prev => {
      const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort();
      // mantieni la frequenza allineata al numero di giorni selezionati
      setFrequency(next.length || 1);
      return next.length > 0 ? next : prev; // non permettere 0 giorni
    });
  }

  function handleOpen() {
    setError("");
    if (!originIata || !destIata)          { setError("Scegli aeroporto di origine e destinazione."); return; }
    if (originIata === destIata)           { setError("Origine e destinazione devono essere diversi."); return; }
    if (!aircraftId)                       { setError("Seleziona un aereo dalla tua flotta."); return; }
    if (operatingDays.length === 0)        { setError("Seleziona almeno un giorno operativo."); return; }
    const finalEco = ecoPrice || suggestedEco;
    const finalBiz = bizPrice || suggestedBiz;
    if (finalEco <= 0 || finalBiz <= 0)    { setError("Prezzi non validi."); return; }
    if (!selectedModel)                    { setError("Modello aereo non trovato."); return; }

    const draft: RouteDraft = {
      originIata, destinationIata: destIata, aircraftId,
      weeklyFrequency: frequency, operatingDays,
      departureTime: "08:00",
      economySeats: selectedModel.economyCapacity,
      businessSeats: selectedModel.businessCapacity,
      economyPrice: finalEco, businessPrice: finalBiz,
    };
    dispatch({ type: "OPEN_ROUTE", payload: draft });
    setSuccess(true);
    setTimeout(() => dispatch({ type: "SET_VIEW", payload: "routes" }), 1500);
  }

  const NAV_H = 56;

  if (success) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        background: "#071020", color: "#c8dff0" }}>
        <div style={{ fontSize: "3rem" }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>Rotta aperta!</div>
        <div style={{ fontSize: 14, color: "#3a5a7a" }}>{originIata} → {destIata}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100dvh", overflow: "hidden", background: "#071020" }}>

      {/* ── Full-screen map ─────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, bottom: NAV_H }}>
        <WorldMap
          selectedIatas={[originIata, destIata].filter(Boolean)}
          routes={state.routes}
          onAirportClick={iata => {
            if (!originIata)                        { setOriginIata(iata); return; }
            if (!destIata && iata !== originIata)   { setDestIata(iata); return; }
            if (iata === originIata)                { setOriginIata(""); return; }
            setDestIata(iata);
          }}
          demandOriginIata={originIata || undefined}
          fillParent
        />
      </div>

      {/* Map hint when nothing selected */}
      {!originIata && (
        <div style={hint.wrap}>
          <div style={hint.pill}>Tocca un aeroporto sulla mappa per iniziare</div>
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────────── */}
      <div style={{
        ...sheet.wrap,
        bottom: NAV_H,
        height: sheetOpen ? "62vh" : "auto",
        maxHeight: "80vh",
      }}>
        {/* Drag handle */}
        <button style={sheet.handleArea} onClick={() => setSheetOpen(o => !o)}>
          <div style={sheet.handle} />
          <div style={sheet.sheetTitle}>
            <span style={sheet.titleText}>
              {originIata && destIata
                ? `${originIata} → ${destIata}${distanceKm ? `  ·  ${distanceKm.toLocaleString("it-IT")} km` : ""}`
                : originIata
                ? `${originIata} → scegli destinazione`
                : "Nuova rotta"}
            </span>
            <span style={sheet.chevron}>{sheetOpen ? "▼" : "▲"}</span>
          </div>
        </button>

        {sheetOpen && (
          <div style={sheet.scrollArea}>

            {/* Step 1 — Tratta */}
            <div style={form.section}>
              <div style={form.step}>1. Tratta</div>
              <div style={form.row2}>
                <FormSelect label="Origine" value={originIata} onChange={setOriginIata}>
                  <option value="">— scegli —</option>
                  {airports.map(a => <option key={a.iata} value={a.iata}>{a.iata} – {a.name.split(" ").slice(0,2).join(" ")}</option>)}
                </FormSelect>
                <FormSelect label="Destinazione" value={destIata} onChange={setDestIata}>
                  <option value="">— scegli —</option>
                  {airports.filter(a => a.iata !== originIata).map(a => <option key={a.iata} value={a.iata}>{a.iata} – {a.name.split(" ").slice(0,2).join(" ")}</option>)}
                </FormSelect>
              </div>
              {distanceKm && (
                <div style={form.distBadge}>📍 {distanceKm.toLocaleString("it-IT")} km</div>
              )}
            </div>

            {/* Step 2 — Aereo */}
            <div style={form.section}>
              <div style={form.step}>2. Aereo</div>
              {availableAircraft.length === 0 ? (
                <div style={form.warn}>
                  Nessun aereo in flotta.{" "}
                  <button style={form.inlineBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "fleet" })}>Vai alla Flotta →</button>
                </div>
              ) : (
                <FormSelect label="" value={aircraftId} onChange={setAircraftId}>
                  <option value="">— scegli aereo —</option>
                  {availableAircraft.map(ac => {
                    const m = aircraftModelById.get(ac.modelId);
                    return <option key={ac.id} value={ac.id}>{m?.manufacturer} {m?.name} ({m?.economyCapacity}+{m?.businessCapacity} pax, {m?.rangeKm?.toLocaleString("it-IT")} km)</option>;
                  })}
                </FormSelect>
              )}
              {selectedModel && distanceKm && selectedModel.rangeKm < distanceKm && (
                <div style={form.warn}>⚠ Range insufficiente ({selectedModel.rangeKm.toLocaleString("it-IT")} km).</div>
              )}
              {utilizationInfo && (
                <div style={{ ...form.utilBox, borderColor: (utilizationInfo.overLimit || utilizationInfo.overCalendar) ? "#f87171" : "rgba(56,189,248,0.15)" }}>
                  <div style={form.utilGrid}>
                    <UtilStat label="Block time" value={`${utilizationInfo.blockHours}h`} />
                    <UtilStat label="Ore/rotazione" value={`${utilizationInfo.hoursPerRot}h`} />
                    <UtilStat label="Ore totali/sett" value={`${utilizationInfo.totalWeekly}h / ${MAX_WEEKLY_HOURS}h`}
                      color={utilizationInfo.overLimit ? "#f87171" : "#22c55e"} />
                    <UtilStat label="Ore libere" value={`${utilizationInfo.freeHours}h`}
                      color={utilizationInfo.freeHours < 10 ? "#f59e0b" : "#c8dff0"} />
                  </div>
                  {utilizationInfo.overCalendar && (
                    <div style={{ fontSize: 10, color: "#f87171", marginTop: 6 }}>
                      ⚠ Max {utilizationInfo.maxFreq}x/sett per questa rotta — ogni rotazione occupa {utilizationInfo.hoursPerRot}h ({Math.ceil(utilizationInfo.hoursPerRot / 24)} giorni).
                    </div>
                  )}
                  {utilizationInfo.overLimit && !utilizationInfo.overCalendar && (
                    <div style={{ fontSize: 10, color: "#f87171", marginTop: 6 }}>
                      ⚠ Supera il limite di 112h/sett. Riduci la frequenza.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3 — Frequenza */}
            <div style={form.section}>
              <div style={form.step}>3. Frequenza</div>
              <div style={form.row2half}>
                <FormSelect label="Voli/settimana" value={String(frequency)} onChange={v => handleFrequencyChange(Number(v))}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x</option>)}
                </FormSelect>
              </div>
              <div style={form.daysRow}>
                {DAYS.map((d, i) => (
                  <button key={i} style={{
                    ...form.dayBtn,
                    background: operatingDays.includes(i+1) ? "#38bdf8" : "#0f2035",
                    color: operatingDays.includes(i+1) ? "#071020" : "#3a5a7a",
                  }} onClick={() => toggleDay(i+1)}>{d}</button>
                ))}
              </div>
            </div>

            {/* Step 4 — Prezzi */}
            <div style={form.section}>
              <div style={form.step}>4. Prezzi</div>
              <div style={form.row2}>
                <FormInput label="Economy ($)" value={ecoPrice}
                  placeholder={suggestedEco ? String(suggestedEco) : "es. 350"}
                  onChange={setEcoPrice} />
                <FormInput label="Business ($)" value={bizPrice}
                  placeholder={suggestedBiz ? String(suggestedBiz) : "es. 980"}
                  onChange={setBizPrice} />
              </div>
              {distanceKm && (
                <div style={form.hint}>Suggeriti: Eco ${suggestedEco} · Biz ${suggestedBiz}</div>
              )}
            </div>

            {operatingDays.length !== frequency && (
              <div style={form.warn}>⚠ Giorni selezionati ({operatingDays.length}) ≠ frequenza ({frequency}). Correggi prima di aprire.</div>
            )}
            {error && <div style={form.error}>{error}</div>}

            <button
              style={{ ...form.openBtn, opacity: !originIata || !destIata || !aircraftId ? 0.45 : 1 }}
              onClick={handleOpen}
              disabled={!originIata || !destIata || !aircraftId}
            >
              {originIata && destIata
                ? `Apri rotta ${originIata} → ${destIata}`
                : "Apri rotta"}
            </button>

            <div style={{ height: 24 }} />
          </div>
        )}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
      <nav style={nav.bar}>
        {NAV_ITEMS.map(item => (
          <button key={item.view}
            style={{ ...nav.btn, color: state.currentView === item.view ? "#38bdf8" : "#3a5a7a" }}
            onClick={() => dispatch({ type: "SET_VIEW", payload: item.view })}>
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: "10px", fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function UtilStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "#3a5a7a", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color ?? "#c8dff0" }}>{value}</span>
    </div>
  );
}

function FormSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={form.label}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={form.select}>
        {children}
      </select>
    </div>
  );
}

function FormInput({ label, value, placeholder, onChange }: {
  label: string; value: number; placeholder: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={form.label}>{label}</label>
      <input
        type="number" placeholder={placeholder} value={value || ""}
        onChange={e => onChange(Number(e.target.value))}
        style={form.input} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sheet: Record<string, React.CSSProperties> = {
  wrap: {
    position: "absolute", left: 0, right: 0,
    background: "rgba(7,16,32,0.97)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid rgba(56,189,248,0.15)",
    borderRadius: "16px 16px 0 0",
    display: "flex", flexDirection: "column",
    transition: "height 0.25s ease",
    zIndex: 20, overflow: "hidden",
  },
  handleArea: {
    background: "none", border: "none", cursor: "pointer",
    padding: "10px 16px 8px",
    display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
    flexShrink: 0,
  },
  handle: { width: 36, height: 4, borderRadius: 2, background: "rgba(56,189,248,0.25)" },
  sheetTitle: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  titleText: { fontSize: 13, fontWeight: 600, color: "#c8dff0" },
  chevron: { fontSize: 10, color: "#3a5a7a" },
  scrollArea: { overflowY: "auto" as const, flex: 1, padding: "0 16px", scrollbarWidth: "none" as const },
};

const form: Record<string, React.CSSProperties> = {
  section: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  step: { fontSize: 11, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.05em" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  row2half: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  label: { fontSize: 9, color: "#3a5a7a", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  select: {
    background: "#0a1c30", border: "1px solid #1a3050", borderRadius: 8,
    color: "#c8dff0", padding: "8px 10px", fontSize: 13, outline: "none", width: "100%",
  },
  input: {
    background: "#0a1c30", border: "1px solid #1a3050", borderRadius: 8,
    color: "#c8dff0", padding: "8px 10px", fontSize: 13, outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  },
  distBadge: {
    fontSize: 11, color: "#38bdf8", background: "rgba(56,189,248,0.08)",
    borderRadius: 6, padding: "4px 10px", alignSelf: "flex-start" as const,
  },
  daysRow: { display: "flex", gap: 4 },
  dayBtn: { flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer" },
  hint: { fontSize: 10, color: "#2a4060" },
  warn: { fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.08)", borderRadius: 6, padding: "6px 10px" },
  inlineBtn: { background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: 700, fontSize: "inherit" },
  error: { fontSize: 11, color: "#f87171", background: "rgba(248,113,113,0.08)", borderRadius: 6, padding: "6px 10px" },
  openBtn: {
    background: "#38bdf8", color: "#071020", fontWeight: 800, fontSize: 14,
    padding: "14px", borderRadius: 10, border: "none", cursor: "pointer",
    marginTop: 4, width: "100%",
  },
  utilBox: {
    border: "1px solid", borderRadius: 8, padding: "10px 12px",
    background: "rgba(10,28,48,0.6)",
  },
  utilGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
};

const hint: Record<string, React.CSSProperties> = {
  wrap: {
    position: "absolute", top: 16, left: 0, right: 0,
    display: "flex", justifyContent: "center", zIndex: 10,
    pointerEvents: "none",
  },
  pill: {
    background: "rgba(7,16,32,0.85)", backdropFilter: "blur(8px)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 20, padding: "6px 16px",
    fontSize: 12, color: "#5a82a8",
  },
};

const nav: Record<string, React.CSSProperties> = {
  bar: {
    position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
    background: "rgba(7,16,32,0.97)", backdropFilter: "blur(10px)",
    borderTop: "1px solid rgba(56,189,248,0.1)",
    display: "flex", zIndex: 30,
  },
  btn: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 2,
    background: "none", border: "none", cursor: "pointer",
  },
};
