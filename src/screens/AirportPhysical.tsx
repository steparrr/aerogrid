import { useState } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import type { Airport } from "../domain/types";

const C = {
  bg: "#080E1A", surface: "#0F1829", surface2: "#0A1220",
  border: "#1E2D45", cyan: "#00C8FF", green: "#34D399",
  amber: "#F59E0B", red: "#F87171", gold: "#F6C343",
  muted: "#94A3B8", text: "#E2E8F0", dim: "#64748B",
};

function fmtM(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function StatBox({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.surface, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${color}66` }}>
      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const TABS = ["Infrastruttura", "Lounge & Premium", "Carburante & MRO", "Slot & Gate"];

export function AirportPhysical() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState(0);

  const iata = state?.selectedAirportIata ?? state?.hubIata ?? "FCO";
  const ap: Airport | undefined = airports.find(a => a.iata === iata);

  if (!ap) return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <button onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })} style={{ background: C.cyan, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>← Indietro</button>
    </div>
  );

  const isHub = ap.iata === state?.hubIata;
  const paxM = (ap.terminalCapacityPerDay * 365 / 1_000_000).toFixed(1);

  // Derive infrastructure metrics from airport data
  const runways = ap.runwayLengthM > 3500 ? 3 : ap.runwayLengthM > 3000 ? 2 : 1;
  const widebodyGates = Math.round(ap.terminalCapacityPerDay / 800);
  const narrowbodyGates = Math.round(ap.terminalCapacityPerDay / 400);
  const loungeCapacity = Math.round(ap.terminalCapacityPerDay / 40);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "#0A1628", borderBottom: `1px solid ${C.border}`, padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => dispatch({ type: "SET_VIEW", payload: "airport-conceptual" })}
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: C.text, fontSize: 16 }}
          >←</button>
          <span style={{ color: C.cyan, fontSize: 10, fontWeight: 700, letterSpacing: ".18em" }}>AEROGRID</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ color: C.muted, fontSize: 10 }}>AEROPORTO — INFRASTRUTTURA FISICA</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" as const }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{ap.iata}</span>
            <span style={{ fontSize: 13, color: C.muted, marginLeft: 10 }}>{ap.name}</span>
            {isHub && <span style={{ marginLeft: 10, fontSize: 9, background: "#00C8FF15", color: C.cyan, borderRadius: 4, padding: "2px 8px", fontWeight: 700, border: `1px solid ${C.cyan}44` }}>IL TUO HUB</span>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
            {[
              ["PAX/ANNO", `${paxM}M`, C.green],
              ["PISTE", String(runways), C.text],
              ["PISTA MAX", `${ap.runwayLengthM}m`, C.muted],
              ["CURFEW", ap.curfew ? "Sì" : "No", ap.curfew ? C.red : C.green],
            ].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: "right" as const }}>
                <div style={{ fontSize: 9, color: C.muted }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c as string }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#0A1220", borderBottom: `1px solid ${C.border}`, padding: "0 18px", display: "flex", gap: 2, overflowX: "auto" as const }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "9px 16px", border: "none", cursor: "pointer", background: "transparent",
            borderBottom: tab === i ? `2px solid ${C.cyan}` : "2px solid transparent",
            color: tab === i ? C.cyan : C.muted, fontSize: 12, fontWeight: tab === i ? 800 : 500, whiteSpace: "nowrap" as const,
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "16px 18px" }}>

        {/* TAB 0 — INFRASTRUTTURA */}
        {tab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Piste" value={String(runways)} color={C.cyan} />
              <StatBox label="Lunghezza pista" value={`${ap.runwayLengthM} m`} color={C.text} />
              <StatBox label="Gate widebody" value={String(widebodyGates)} color={C.text} />
              <StatBox label="Gate narrowbody" value={String(narrowbodyGates)} color={C.text} />
              <StatBox label="Cap. terminal/die" value={ap.terminalCapacityPerDay.toLocaleString()} color={C.green} />
              <StatBox label="Categoria max" value={ap.airportSize === "megaHub" ? "F (A380)" : ap.airportSize === "large" ? "E" : "D"} color={C.amber} />
            </div>

            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>LAYOUT PISTE</div>
              {Array.from({ length: runways }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.text, width: 60 }}>RWY {(i + 1).toString().padStart(2, "0")}L</span>
                  <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(ap.runwayLengthM / 4500) * 100}%`, background: C.green, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: C.muted }}>{ap.runwayLengthM}m</span>
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>RESTRIZIONI OPERATIVE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.text }}>Curfew notturno</span>
                  <span style={{ color: ap.curfew ? C.red : C.green }}>{ap.curfew ? "23:00–06:00" : "Nessuno"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.text }}>Categoria aeromobili</span>
                  <span style={{ color: C.cyan }}>Cat. {ap.airportSize === "megaHub" ? "F (A380 capable)" : "E"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.text }}>Operazioni widebody</span>
                  <span style={{ color: ap.airportSize !== "small" ? C.green : C.red }}>{ap.airportSize !== "small" ? "Autorizzate" : "Non autorizzate"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1 — LOUNGE & PREMIUM */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Capacità lounge" value={`${loungeCapacity} pax`} color={C.gold} />
              <StatBox label="Lounge disponibili" value={ap.airportSize === "megaHub" ? "4+" : ap.airportSize === "large" ? "2-3" : "1"} color={C.gold} />
              <StatBox label="NPS lounge medio" value="+72" color={C.green} />
              <StatBox label="Rev. lounge/mese" value={fmtM(loungeCapacity * 150 * 30)} color={C.green} />
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>PORTFOLIO LOUNGE (STIMATO)</div>
              {[
                { tier: "FIRST", name: "Aurum First Lounge", cap: Math.round(loungeCapacity * 0.15), nps: 82, color: C.gold, opex: "$420K/mo" },
                { tier: "BUSINESS", name: "Horizon Business Lounge", cap: Math.round(loungeCapacity * 0.45), nps: 74, color: C.cyan, opex: "$180K/mo" },
                { tier: "FREQUENT FLYER", name: "Silver Circle Lounge", cap: Math.round(loungeCapacity * 0.3), nps: 68, color: "#A78BFA", opex: "$90K/mo" },
                { tier: "DAY PASS", name: "Open Sky Lounge", cap: Math.round(loungeCapacity * 0.1), nps: 61, color: C.green, opex: "$35K/mo" },
              ].map(l => (
                <div key={l.tier} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ width: 90, fontSize: 9, color: l.color, fontWeight: 700 }}>{l.tier}</span>
                  <span style={{ flex: 1, fontSize: 11, color: C.text }}>{l.name}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{l.cap} pax</span>
                  <span style={{ fontSize: 11, color: C.green }}>NPS +{l.nps}</span>
                  <span style={{ fontSize: 10, color: C.red }}>{l.opex}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2 — CARBURANTE & MRO */}
        {tab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Differenziale fuel" value={`${(ap.fuel_price_differential ?? 0) >= 0 ? "+" : ""}${((ap.fuel_price_differential ?? 0) * 100).toFixed(0)}%`} color={(ap.fuel_price_differential ?? 0) > 0.2 ? C.red : C.green} />
              <StatBox label="Autonomia depositi" value="21 giorni" color={C.green} />
              <StatBox label="Fornitori fuel" value={ap.airportSize === "megaHub" ? "4" : ap.airportSize === "large" ? "2" : "1"} color={C.text} />
              <StatBox label="SAF disponibile" value={ap.airportSize !== "small" ? "Sì" : "No"} color={ap.airportSize !== "small" ? C.green : C.muted} />
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>MRO FACILITY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { l: "Hangar A-Check", v: ap.airportSize !== "small" },
                  { l: "Hangar C-Check", v: ap.airportSize === "megaHub" },
                  { l: "Part-out bay", v: ap.airportSize === "megaHub" },
                  { l: "AOG support 24/7", v: ap.airportSize !== "small" },
                ].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.text }}>{r.l}</span>
                    <span style={{ color: r.v ? C.green : C.dim }}>{r.v ? "Disponibile" : "N/D"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3 — SLOT & GATE */}
        {tab === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Slot totali/die" value={ap.slotCapacityPerDay.toLocaleString()} color={C.cyan} />
              <StatBox label="Slot liberi" value={(ap.slot_pool_available ?? ap.slotCapacityPerDay).toLocaleString()} color={C.green} />
              <StatBox label="Prezzo slot" value={(ap.slot_market_price ?? 0) > 0 ? fmtM(ap.slot_market_price ?? 0) : "Libero"} color={C.amber} />
              <StatBox label="Gate totali" value={String(widebodyGates + narrowbodyGates)} color={C.text} />
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>DISTRIBUZIONE GATE</div>
              {[
                { label: "Widebody (Cat. E-F)", count: widebodyGates, color: C.cyan },
                { label: "Narrowbody (Cat. C-D)", count: narrowbodyGates, color: C.green },
                { label: "Regionale/Turboprop", count: Math.round(narrowbodyGates * 0.4), color: C.muted },
              ].map(g => (
                <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 180, fontSize: 11, color: C.text }}>{g.label}</span>
                  <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (g.count / (widebodyGates + narrowbodyGates)) * 100)}%`, background: g.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: g.color, fontWeight: 700 }}>{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
