import { useState } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import type { Airport } from "../domain/types";

const C = {
  bg: "#080E1A", surface: "#0F1829", surface2: "#0A1220",
  border: "#1E2D45", cyan: "#00C8FF", green: "#34D399",
  amber: "#F59E0B", red: "#F87171", muted: "#94A3B8",
  text: "#E2E8F0", dim: "#64748B",
};

const TIER_COLOR: Record<string, string> = { A: C.cyan, B: C.green, C: C.muted };
const CONGESTION_LABEL: Record<number, string> = { 1: "LEVEL 1 — FREE", 2: "LEVEL 2 — COORDINATO", 3: "LEVEL 3 — CONGESTIONATO" };
const CONGESTION_COLOR: Record<number, string> = { 1: C.green, 2: C.amber, 3: C.red };

function congestionFromScore(score: number): number {
  if (score > 0.8) return 3;
  if (score > 0.55) return 2;
  return 1;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtMoney(n: number) {
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

interface DemandBar { label: string; pct: number; color: string; icon: string }

const DEMAND_SEGMENTS: DemandBar[] = [
  { label: "Corporate", pct: 28, color: C.cyan, icon: "💼" },
  { label: "Leisure", pct: 31, color: C.green, icon: "🏖" },
  { label: "VFR", pct: 18, color: "#A78BFA", icon: "👨‍👩‍👧" },
  { label: "MICE", pct: 14, color: C.amber, icon: "🎪" },
  { label: "Student", pct: 6, color: "#FCD34D", icon: "🎓" },
  { label: "Transit", pct: 3, color: C.dim, icon: "🔄" },
];

const TABS = ["Panoramica", "Domanda", "Slot & Competitor", "Economia"];

export function AirportConceptual() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState(0);

  const iata = state?.selectedAirportIata ?? state?.hubIata ?? "FCO";
  const ap: Airport | undefined = airports.find(a => a.iata === iata);

  if (!ap) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>
          <p style={{ color: C.muted }}>Aeroporto non trovato: {iata}</p>
          <button onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })} style={{ background: C.cyan, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>← Indietro</button>
        </div>
      </div>
    );
  }

  const cong = congestionFromScore(ap.congestionLevel);
  const paxM = (ap.terminalCapacityPerDay * 365 / 1_000_000).toFixed(1);
  const isHub = ap.iata === state?.hubIata;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "#0A1628", borderBottom: `1px solid ${C.border}`, padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })}
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: C.text, fontSize: 16 }}
          >←</button>
          <span style={{ color: C.cyan, fontSize: 10, fontWeight: 700, letterSpacing: ".18em" }}>AEROGRID</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ color: C.muted, fontSize: 10 }}>ANALISI MERCATO AEROPORTO</span>
          <button
            onClick={() => dispatch({ type: "SET_VIEW", payload: "airport-physical" })}
            style={{ marginLeft: "auto", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 10, padding: "4px 10px", cursor: "pointer" }}
          >🏗 Infrastruttura →</button>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" as const }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{ap.iata}</span>
            <span style={{ fontSize: 13, color: C.muted, marginLeft: 10 }}>{ap.name}</span>
            {isHub && <span style={{ marginLeft: 10, fontSize: 9, background: "#00C8FF15", color: C.cyan, borderRadius: 4, padding: "2px 8px", fontWeight: 700, border: `1px solid ${C.cyan}44` }}>IL TUO HUB</span>}
            <span style={{ marginLeft: 10, fontSize: 9, background: C.surface2, color: TIER_COLOR[ap.tier ?? "C"], borderRadius: 4, padding: "2px 8px", fontWeight: 700, border: `1px solid ${TIER_COLOR[ap.tier ?? "C"]}44` }}>Tier {ap.tier ?? "C"}</span>
            <span style={{ marginLeft: 8, fontSize: 9, background: C.surface2, color: CONGESTION_COLOR[cong], borderRadius: 4, padding: "2px 8px", fontWeight: 700, border: `1px solid ${CONGESTION_COLOR[cong]}44` }}>{CONGESTION_LABEL[cong]}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
            {[
              ["PAX/ANNO", `${paxM}M`, C.green],
              ["PAESE", ap.country, C.text],
              ["PISTA MAX", `${ap.runwayLengthM}m`, C.muted],
              ["HUB SCORE", `${(ap.hubPotentialScore * 100).toFixed(0)}%`, C.cyan],
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
      <div style={{ background: "#0A1220", borderBottom: `1px solid ${C.border}`, padding: "0 18px", display: "flex", gap: 2 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "9px 16px", border: "none", cursor: "pointer", background: "transparent",
            borderBottom: tab === i ? `2px solid ${C.cyan}` : "2px solid transparent",
            color: tab === i ? C.cyan : C.muted, fontSize: 12, fontWeight: tab === i ? 800 : 500,
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "16px 18px" }}>

        {/* TAB 0 — PANORAMICA */}
        {tab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Passeggeri/anno" value={`${paxM}M`} color={C.green} />
              <StatBox label="Slot/giorno" value={fmt(ap.slotCapacityPerDay)} color={C.cyan} />
              <StatBox label="Pista principale" value={`${ap.runwayLengthM} m`} color={C.text} />
              <StatBox label="Congestion level" value={`L${cong}`} color={CONGESTION_COLOR[cong]} />
              <StatBox label="Hub potential" value={`${(ap.hubPotentialScore * 100).toFixed(0)}%`} color={C.cyan} />
              <StatBox label="Turismo" value={`${(ap.touristGatewayScore * 100).toFixed(0)}%`} color={C.green} />
              <StatBox label="Business" value={`${(ap.businessGatewayScore * 100).toFixed(0)}%`} color={C.amber} />
              <StatBox label="Curfew" value={ap.curfew ? "Sì" : "No"} color={ap.curfew ? C.red : C.green} />
            </div>

            {/* Map position */}
            <div style={{ background: C.surface, borderRadius: 10, padding: 14, display: "flex", gap: 20, flexWrap: "wrap" as const }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>POSIZIONE</div>
                <div style={{ fontSize: 13, color: C.text }}>{ap.continent}</div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  Lat {ap.coordinates.lat.toFixed(3)}, Lon {ap.coordinates.lon.toFixed(3)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>FEES MEDI</div>
                <div style={{ fontSize: 13, color: C.amber }}>{fmtMoney(ap.baseFees)} landing</div>
                <div style={{ fontSize: 11, color: C.dim }}>{fmtMoney(ap.handling_fee_base ?? 0)} handling</div>
                <div style={{ fontSize: 11, color: C.dim }}>${ap.passengerFees}/pax tassa</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>CARBURANTE</div>
                <div style={{ fontSize: 13, color: (ap.fuel_price_differential ?? 0) > 0.2 ? C.red : C.green }}>
                  {(ap.fuel_price_differential ?? 0) >= 0 ? "+" : ""}{((ap.fuel_price_differential ?? 0) * 100).toFixed(0)}% vs benchmark
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1 — DOMANDA */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>SEGMENTI DI DOMANDA — STIMA SETTIMANALE</div>
              {DEMAND_SEGMENTS.map(seg => {
                // Scale demand to pax volume
                const basePax = ap.terminalCapacityPerDay * 7;
                const paxSeg = Math.round(basePax * seg.pct / 100);
                return (
                  <div key={seg.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.text }}>{seg.icon} {seg.label}</span>
                      <span style={{ fontSize: 11, color: seg.color, fontWeight: 700 }}>{fmt(paxSeg)} pax/sett</span>
                    </div>
                    <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${seg.pct}%`, background: seg.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="Elasticità corporate" value="0.37" color={C.cyan} />
              <StatBox label="Elasticità leisure" value="1.89" color={C.green} />
              <StatBox label="Potenziale turismo" value={`${(ap.touristGatewayScore * 100).toFixed(0)}%`} color={C.green} />
              <StatBox label="Potenziale business" value={`${(ap.businessGatewayScore * 100).toFixed(0)}%`} color={C.amber} />
            </div>
          </div>
        )}

        {/* TAB 2 — SLOT & COMPETITOR */}
        {tab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              <StatBox label="Slot totali/giorno" value={fmt(ap.slotCapacityPerDay)} color={C.cyan} />
              <StatBox label="Slot disponibili" value={fmt(ap.slot_pool_available ?? 999)} color={C.green} />
              <StatBox label="Livello coordinamento" value={`L${cong}`} color={CONGESTION_COLOR[cong]} />
              <StatBox label="Mercato secondario" value={(ap.slot_market_price ?? 0) > 0 ? `$${fmt(ap.slot_market_price ?? 0)}` : "N/D"} color={C.amber} />
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>DINAMICA SLOT</div>
              <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>
                {cong === 1 && "Aeroporto non coordinato. Nessuna restrizione sugli slot, operazioni flessibili."}
                {cong === 2 && "Aeroporto coordinato (Level 2). Gli slot vanno richiesti stagionalmente. Pool disponibile con priorità storica."}
                {cong === 3 && "Aeroporto completamente congestionato (Level 3). Slot scarsi, mercato secondario attivo. Fortezza difendibile."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3 — ECONOMIA */}
        {tab === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
              <StatBox label="Landing fee base" value={fmtMoney(ap.baseFees)} color={C.amber} />
              <StatBox label="Tassa pax" value={`$${ap.passengerFees}/pax`} color={C.amber} />
              <StatBox label="Handling base" value={fmtMoney(ap.handling_fee_base ?? 0)} color={C.amber} />
              <StatBox label="Fuel diff." value={`${(ap.fuel_price_differential ?? 0) >= 0 ? "+" : ""}${((ap.fuel_price_differential ?? 0) * 100).toFixed(0)}%`} color={(ap.fuel_price_differential ?? 0) > 0.2 ? C.red : C.green} />
              <StatBox label="Slot market" value={(ap.slot_market_price ?? 0) > 0 ? fmtMoney(ap.slot_market_price ?? 0) : "Libero"} color={C.cyan} />
              <StatBox label="Terminal cap/die" value={fmt(ap.terminalCapacityPerDay)} color={C.text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
