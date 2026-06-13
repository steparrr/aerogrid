import { useState, useMemo } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import { npcAirlines } from "../data/npcAirlines";
import type { Airport } from "../domain/types";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:"#080E1A", surface:"#0F1829", surface2:"#0A1220",
  border:"#1E2D45", border2:"#0D1729",
  cyan:"#00C8FF", green:"#34D399", amber:"#F59E0B", red:"#F87171",
  purple:"#A78BFA", blue:"#93C5FD", teal:"#2DD4BF", gold:"#F6C343",
  muted:"#64748B", dim:"#374151", text:"#E2E8F0", textDim:"#94A3B8",
};

const TIER_COLOR: Record<string, string> = { A: C.cyan, B: C.green, C: C.muted };
const CONGESTION_COLOR: Record<number, string> = { 1: C.green, 2: C.amber, 3: C.red };
const CONGESTION_LABEL: Record<number, string> = {
  1: "LEVEL 1 — FREE",
  2: "LEVEL 2 — COORDINATO",
  3: "LEVEL 3 — CONGESTIONATO",
};

function congFromLevel(level: number): number {
  if (level > 0.8) return 3;
  if (level > 0.5) return 2;
  return 1;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(Math.round(n));

// ─── MINI SVG PIE ─────────────────────────────────────────────────────────────
function PieDonut({
  data, cx=90, cy=90, r=70, innerR=38, size=180,
  centerLabel, centerSub
}: {
  data: { pct?: number; share?: number; color: string; isPlayer?: boolean }[];
  cx?: number; cy?: number; r?: number; innerR?: number; size?: number;
  centerLabel?: string; centerSub?: string;
}) {
  let cum = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = ((d.pct ?? d.share ?? 0) / 100) * 2 * Math.PI;
    const sa = cum; cum += angle;
    return { ...d, sa, ea: cum };
  });
  const arc = (sa: number, ea: number, or: number, ir: number) => {
    const x1=cx+or*Math.cos(sa),y1=cy+or*Math.sin(sa);
    const x2=cx+or*Math.cos(ea),y2=cy+or*Math.sin(ea);
    const xi1=cx+ir*Math.cos(ea),yi1=cy+ir*Math.sin(ea);
    const xi2=cx+ir*Math.cos(sa),yi2=cy+ir*Math.sin(sa);
    const lg=(ea-sa)>Math.PI?1:0;
    return `M${x1} ${y1} A${or} ${or} 0 ${lg} 1 ${x2} ${y2} L${xi1} ${yi1} A${ir} ${ir} 0 ${lg} 0 ${xi2} ${yi2} Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={arc(s.sa, s.ea, r, innerR)} fill={s.color}
          stroke={C.surface} strokeWidth="1.5"
          opacity={s.isPlayer ? 1 : 0.78}
          style={{ filter: s.isPlayer ? `drop-shadow(0 0 5px ${s.color})` : "none" }}/>
      ))}
      {centerLabel && <>
        <text x={cx} y={cy-6} textAnchor="middle" fill={C.cyan} fontSize="15" fontWeight="800">{centerLabel}</text>
        <text x={cx} y={cy+8} textAnchor="middle" fill={C.muted} fontSize="8">{centerSub}</text>
      </>}
    </svg>
  );
}

// ─── SEASONALITY BAR ─────────────────────────────────────────────────────────
const MONTHS = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const BASE_SEASON = [72,78,91,105,112,128,141,118,108,96,74,87];

function SeasonChart({ factors, currentMonth=5 }: { factors: number[]; currentMonth?: number }) {
  const max = Math.max(...factors);
  return (
    <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:60 }}>
      {factors.map((v, i) => {
        const isCurrent = i === currentMonth;
        const h = (v / max) * 56;
        const color = v >= 120 ? C.cyan : v >= 95 ? C.green : v >= 75 ? C.amber : C.red;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ width:"100%", height:h, background: isCurrent ? C.cyan : color+"88",
              borderRadius:"2px 2px 0 0", border: isCurrent ? `1px solid ${C.cyan}` : "none", position:"relative" }}>
              {isCurrent && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                fontSize:7, color:C.cyan, whiteSpace:"nowrap" as const }}>▼{v}</div>}
            </div>
            <span style={{ fontSize:7, color: isCurrent ? C.cyan : C.dim }}>{MONTHS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── DOMINANCE GAUGE ─────────────────────────────────────────────────────────
function DominanceGauge({ share, threshold=65 }: { share: number; threshold?: number }) {
  const threshPct = threshold;
  return (
    <div>
      <div style={{ height:16, background:C.border2, borderRadius:8, overflow:"hidden", position:"relative" }}>
        <div style={{ height:"100%", width:`${share}%`,
          background:`linear-gradient(90deg,${C.cyan}88,${C.cyan})`, borderRadius:8 }}/>
        <div style={{ position:"absolute", top:0, left:`${threshPct}%`, height:"100%", width:2, background:C.amber }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontSize:9, color:C.cyan, fontWeight:700 }}>{share.toFixed(1)}% tuo</span>
        <span style={{ fontSize:9, color:C.amber }}>Fortress {threshold}%</span>
        <span style={{ fontSize:9, color:C.dim }}>100%</span>
      </div>
      {share >= threshold
        ? <div style={{ marginTop:4, fontSize:9, color:C.green, fontWeight:700 }}>✅ FORTRESS HUB — pricing premium attivo</div>
        : share >= 20
          ? <div style={{ marginTop:4, fontSize:9, color:C.amber }}>⬆ +{(threshold - share).toFixed(1)}% al fortress</div>
          : null
      }
    </div>
  );
}

function StatBox({ label, value, sub, color=C.text, border=C.border }: { label:string; value:string|number; sub?:string; color?:string; border?:string }) {
  return (
    <div style={{ background:C.surface2, borderRadius:8, padding:"10px 12px", borderLeft:`3px solid ${border}` }}>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:800, color, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:C.dim, marginTop:1 }}>{sub}</div>}
    </div>
  );
}

const ThreatBadge = ({ t }: { t: string }) => {
  const cfg: Record<string, { bg:string; color:string; label:string }> = {
    alta:  { bg:"#1A0808", color:C.red,   label:"⚠ ALTA" },
    media: { bg:"#1A1508", color:C.amber, label:"▲ MEDIA" },
    bassa: { bg:"#0A1A10", color:C.green, label:"▼ BASSA" },
  };
  const s = cfg[t] ?? cfg.media;
  return <span style={{ background:s.bg, color:s.color, borderRadius:4, padding:"2px 7px", fontSize:9, fontWeight:700 }}>{s.label}</span>;
};

const ArchBadge = ({ a }: { a: string }) => {
  const cfg: Record<string, { bg:string; color:string; label:string }> = {
    LEGACY_DOMINANT: { bg:"#1A1A30", color:C.blue,  label:"LEGACY DOM." },
    LEGACY_WEAK:     { bg:"#1A1008", color:C.gold,  label:"LEGACY WEAK" },
    LCC:             { bg:"#0A1A10", color:C.green, label:"LCC" },
    ULCC:            { bg:"#2A1A08", color:C.amber, label:"ULCC" },
    GULF_CARRIER:    { bg:"#1A1220", color:C.purple, label:"GULF CARRIER" },
    REGIONAL:        { bg:"#0A1010", color:C.teal,  label:"REGIONAL" },
  };
  const s = cfg[a] ?? { bg:C.surface2, color:C.textDim, label:a };
  return <span style={{ background:s.bg, color:s.color, borderRadius:4, padding:"2px 7px", fontSize:9, fontWeight:700 }}>{s.label}</span>;
};

// ─── DEMAND SEGMENTS helper ───────────────────────────────────────────────────
function computeDemandSegments(ap: Airport) {
  const biz = ap.businessGatewayScore;
  const tour = ap.touristGatewayScore;
  const hub = ap.hubPotentialScore;
  const total = biz + tour + hub;
  const corpPct = Math.round(biz / total * 45 + 10);
  const leisPct = Math.round(tour / total * 45 + 12);
  const vfrPct  = Math.round(15 + (1 - biz) * 5);
  const micePct = Math.round(biz * 12);
  const stuPct  = Math.min(8, Math.round(4 + tour * 5));
  const trPct   = Math.max(2, 100 - corpPct - leisPct - vfrPct - micePct - stuPct);
  const weeklyPax = ap.terminalCapacityPerDay * 7;
  return [
    { id:"corporate", label:"Corporate",  pct:corpPct, pax:Math.round(weeklyPax*corpPct/100), yield:"alto",  elasticity:0.37, color:C.cyan,    icon:"💼" },
    { id:"leisure",   label:"Leisure",    pct:leisPct, pax:Math.round(weeklyPax*leisPct/100), yield:"basso", elasticity:1.89, color:C.green,   icon:"🏖" },
    { id:"vfr",       label:"VFR",        pct:vfrPct,  pax:Math.round(weeklyPax*vfrPct/100),  yield:"basso", elasticity:2.10, color:C.purple,  icon:"👨‍👩‍👧" },
    { id:"mice",      label:"MICE",       pct:micePct, pax:Math.round(weeklyPax*micePct/100), yield:"medio", elasticity:0.95, color:C.amber,   icon:"🎪" },
    { id:"student",   label:"Student",    pct:stuPct,  pax:Math.round(weeklyPax*stuPct/100),  yield:"basso", elasticity:1.60, color:C.gold,    icon:"🎓" },
    { id:"transit",   label:"Transit",    pct:trPct,   pax:Math.round(weeklyPax*trPct/100),   yield:"medio", elasticity:1.20, color:C.teal,    icon:"🔄" },
  ];
}

// ─── SEASONALITY helper ───────────────────────────────────────────────────────
function seasonalityForAirport(ap: Airport): number[] {
  // Southern hemisphere inverts summer/winter
  const lat = ap.coordinates.lat;
  const southern = lat < -20;
  return BASE_SEASON.map((v, i) => {
    if (southern) {
      const shifted = BASE_SEASON[(i + 6) % 12];
      // blend toward equatorial if near equator
      const blend = Math.max(0, Math.min(1, (Math.abs(lat) - 20) / 20));
      return Math.round(v * (1 - blend) + shifted * blend);
    }
    return v;
  });
}

type Level = "airport" | "city" | "region";

const AIRPORT_TABS = ["Panoramica","Domanda","Slot & Competitor","Rotte O/D","Economia"];
const CITY_TABS    = ["Aeroporti","Domanda Città","Competitor Città"];
const REGION_TABS  = ["Panoramica Regione","Rotte Regionali"];

export function AirportConceptual() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState(0);
  const [hovSeg, setHovSeg] = useState<string | null>(null);
  const [hovOD, setHovOD]   = useState<string | null>(null);
  const [level, setLevel]   = useState<Level>("airport");

  const iata = state?.selectedAirportIata ?? state?.hubIata ?? "LHR";
  const ap: Airport | undefined = airports.find(a => a.iata === iata);

  const playerRoutes = useMemo(
    () => (state?.routes ?? []).filter(r => r.originIata === iata || r.destinationIata === iata),
    [state?.routes, iata]
  );

  const npcAtAirport = useMemo(
    () => npcAirlines.filter(npc =>
      npc.baseRoutes.some(rt => rt.startsWith(iata + "-") || rt.endsWith("-" + iata))
    ),
    [iata]
  );

  const cityAirports = useMemo(
    () => ap ? airports.filter(a => a.cityId === ap.cityId && a.iata !== ap.iata) : [],
    [ap]
  );

  const regionAirports = useMemo(
    () => ap ? airports.filter(a => a.continent === ap.continent && a.tier && a.tier !== "C") : [],
    [ap]
  );

  const demandSegs = useMemo(() => ap ? computeDemandSegments(ap) : [], [ap]);
  const seasonality = useMemo(() => ap ? seasonalityForAirport(ap) : BASE_SEASON, [ap]);

  const cong = ap ? congFromLevel(ap.congestionLevel) : 1;
  const isHub = ap?.iata === state?.hubIata;

  // Player slot share estimate
  const playerSlotCount = playerRoutes.reduce((s, r) => s + r.weeklyFrequency, 0);
  const totalWeeklySlots = (ap?.slotCapacityPerDay ?? 100) * 7;
  const playerSharePct = Math.min(49, Math.max(0.5, (playerSlotCount / totalWeeklySlots) * 100));

  // Slot distribution for pie
  const slotPie = useMemo(() => {
    const remaining = 100 - playerSharePct;
    const npcChunk = Math.min(remaining, npcAtAirport.length * 4);
    const othersChunk = remaining - npcChunk;
    const topNPC = npcAtAirport.slice(0, 5).map((npc, i) => ({
      name: npc.name, iata: npc.iataCode, share: npcChunk / Math.max(1, npcAtAirport.slice(0,5).length),
      color: npc.color, isPlayer: false,
    }));
    return [
      { name: state?.airlineName ?? "Tu", iata: "AG", share: playerSharePct, color: C.cyan, isPlayer: true },
      ...topNPC,
      { name: "Altri", iata: "—", share: othersChunk + (npcAtAirport.length > 5 ? npcChunk * (npcAtAirport.length - 5) / Math.max(1, npcAtAirport.length) : 0), color: C.dim, isPlayer: false },
    ].filter(s => s.share > 0);
  }, [playerSharePct, npcAtAirport, state?.airlineName]);

  // O/D routes: player routes + NPC routes involving this airport
  const playerOD = useMemo(() => playerRoutes.map(r => {
    const destIata = r.originIata === iata ? r.destinationIata : r.originIata;
    const destAp = airports.find(a => a.iata === destIata);
    return {
      dest: destIata,
      city: destAp?.name ?? destIata,
      myShare: 30 + Math.round(Math.random() * 20),
      freq: r.weeklyFrequency,
      isActive: true,
      comp: npcAirlines.filter(n => n.baseRoutes.some(rt => rt === `${iata}-${destIata}` || rt === `${destIata}-${iata}`)).length,
    };
  }), [playerRoutes, iata]);

  const npcOD = useMemo(() => {
    const seen = new Set(playerOD.map(r => r.dest));
    const all: typeof playerOD = [];
    for (const npc of npcAtAirport) {
      for (const rt of npc.baseRoutes) {
        const [orig, dest] = rt.split("-");
        const other = orig === iata ? dest : orig === iata ? dest : orig === iata ? dest : null;
        if (!other || seen.has(other)) continue;
        seen.add(other);
        const otherAp = airports.find(a => a.iata === other);
        const comp = npcAirlines.filter(n => n.baseRoutes.some(r => r === rt || r === `${dest}-${orig}`)).length;
        all.push({ dest: other, city: otherAp?.name ?? other, myShare: 0, freq: 0, isActive: false, comp });
        if (all.length >= 12) break;
      }
      if (all.length >= 12) break;
    }
    return all;
  }, [npcAtAirport, playerOD, iata]);

  const allOD = [...playerOD, ...npcOD].slice(0, 12);

  const switchLevel = (l: Level) => { setLevel(l); setTab(0); };
  const currentTabs = level === "airport" ? AIRPORT_TABS : level === "city" ? CITY_TABS : REGION_TABS;

  if (!ap) return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <p style={{ color:C.muted }}>Aeroporto non trovato: {iata}</p>
        <button onClick={() => dispatch({ type:"SET_VIEW", payload:"operations" })}
          style={{ background:C.cyan, color:"#000", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer" }}>
          ← Indietro
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", color:C.text, fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#0A1628", borderBottom:`1px solid ${C.border}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <button onClick={() => dispatch({ type:"SET_VIEW", payload:"operations" })}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:"50%", width:30, height:30,
              cursor:"pointer", color:C.text, fontSize:15 }}>←</button>
          <span style={{ color:C.cyan, fontSize:10, fontWeight:700, letterSpacing:".18em" }}>AEROGRID</span>
          <span style={{ color:C.border }}>|</span>
          <span style={{ color:C.muted, fontSize:10 }}>ANALISI MERCATO · VISTA {level.toUpperCase()}</span>
          <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-physical" })}
            style={{ marginLeft:"auto", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
              color:C.muted, fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
            🏗 Infrastruttura →
          </button>
        </div>

        {/* Level breadcrumb */}
        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
          {[
            { id:"region" as Level, icon:"🌍", label:ap.continent },
            { id:"city" as Level,   icon:"🏙", label:cityAirports.length > 0 ? `${ap.name.split(" ")[0]} Area` : ap.country },
            { id:"airport" as Level,icon:"✈",  label:ap.iata },
          ].map((btn, i) => (
            <span key={btn.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
              {i > 0 && <span style={{ color:C.dim }}>›</span>}
              <button onClick={() => switchLevel(btn.id)} style={{
                padding:"4px 10px", border:`1px solid ${level===btn.id?C.cyan:C.border}`,
                borderRadius:6, cursor:"pointer", fontSize:10, fontWeight:level===btn.id?800:500,
                background:level===btn.id?"#00C8FF12":C.surface2,
                color:level===btn.id?C.cyan:C.muted }}>
                {btn.icon} {btn.label}
              </button>
            </span>
          ))}
        </div>

        {/* Dynamic header stats */}
        {level === "airport" && (
          <div style={{ display:"flex", alignItems:"baseline", gap:14, flexWrap:"wrap" as const }}>
            <div>
              <span style={{ fontSize:22, fontWeight:900 }}>{ap.iata}</span>
              <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>{ap.name}</span>
              {isHub && <span style={{ marginLeft:8, fontSize:9, background:"#00C8FF15", color:C.cyan,
                borderRadius:4, padding:"2px 7px", fontWeight:700 }}>★ HUB</span>}
              <span style={{ marginLeft:6, fontSize:9, background:C.surface2, color:TIER_COLOR[ap.tier ?? "C"],
                borderRadius:4, padding:"2px 7px", fontWeight:700 }}>Tier {ap.tier ?? "C"}</span>
              <span style={{ marginLeft:6, fontSize:9, background:C.surface2,
                color:CONGESTION_COLOR[cong], borderRadius:4, padding:"2px 7px", fontWeight:700 }}>
                {CONGESTION_LABEL[cong]}
              </span>
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:16 }}>
              {[
                ["PAX/ANNO", fmt(ap.terminalCapacityPerDay*365), C.green],
                ["TUO SHARE", playerSharePct > 0.5 ? `${playerSharePct.toFixed(1)}%` : "—", C.cyan],
                ["ROTTE", String(playerRoutes.length), C.cyan],
                ["COMPETITOR", String(npcAtAirport.length), C.amber],
              ].map(([l, v, c]) => (
                <div key={l} style={{ textAlign:"right" as const }}>
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {level === "city" && (
          <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
            <div>
              <span style={{ fontSize:22, fontWeight:900 }}>{ap.name.split(" ")[0]}</span>
              <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>Area Metropolitana · {1 + cityAirports.length} aeroporti</span>
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:16 }}>
              {[["AEROPORTI TUOI", "1/" + (1 + cityAirports.length), C.amber]].map(([l,v,c])=>(
                <div key={l} style={{ textAlign:"right" as const }}>
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {level === "region" && (
          <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
            <div>
              <span style={{ fontSize:22, fontWeight:900 }}>{ap.continent}</span>
              <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>
                {regionAirports.length} aeroporti tier A/B
              </span>
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:16 }}>
              {[["TUO SHARE REG.", playerSharePct < 2 ? "<1%" : `${playerSharePct.toFixed(1)}%`, C.cyan]].map(([l,v,c])=>(
                <div key={l} style={{ textAlign:"right" as const }}>
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ background:"#0A1220", borderBottom:`1px solid ${C.border}`,
        padding:"0 16px", display:"flex", gap:2, overflowX:"auto" as const }}>
        {currentTabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding:"8px 14px", border:"none", cursor:"pointer", background:"transparent", whiteSpace:"nowrap" as const,
            borderBottom: tab===i ? `2px solid ${C.cyan}` : "2px solid transparent",
            color: tab===i ? C.cyan : C.muted, fontSize:11, fontWeight:tab===i?800:500 }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column" as const, gap:14 }}>

        {/* ══ LIVELLO AEROPORTO ══════════════════════════════════════════ */}
        {level === "airport" && (<>

          {/* TAB 0 — PANORAMICA */}
          {tab === 0 && (<>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
              <StatBox label="Slot/giorno" value={fmt(ap.slotCapacityPerDay)} color={C.cyan} border={C.cyan+"66"} />
              <StatBox label="Saturazione" value={`${Math.round(ap.congestionLevel*100)}%`} color={CONGESTION_COLOR[cong]} border={CONGESTION_COLOR[cong]+"66"} />
              <StatBox label="Pista" value={`${ap.runwayLengthM} m`} color={C.text} border={C.border} />
              <StatBox label="Hub Potential" value={`${Math.round(ap.hubPotentialScore*100)}%`} color={C.cyan} border={C.cyan+"66"} />
              <StatBox label="Turismo Score" value={`${Math.round(ap.touristGatewayScore*100)}%`} color={C.green} border={C.green+"66"} />
              <StatBox label="Business Score" value={`${Math.round(ap.businessGatewayScore*100)}%`} color={C.amber} border={C.amber+"66"} />
              <StatBox label="Curfew" value={ap.curfew ? "Sì" : "No"} color={ap.curfew ? C.red : C.green} border={C.border} />
              <StatBox label="Paese" value={ap.country} color={C.textDim} border={C.border} />
            </div>

            <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:10 }}>HUB DOMINANCE — SLOT SHARE</div>
              <DominanceGauge share={playerSharePct} threshold={60} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ background:"#1A0808", border:`1px solid ${C.red}44`, borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.red, marginBottom:6 }}>⚠ ALERT</div>
                {cong === 3 && <div style={{ fontSize:11, color:C.red, marginBottom:3 }}>• Aeroporto congestionato (L3): slot scarsi</div>}
                {npcAtAirport.some(n => n.archetype === "LEGACY_DOMINANT") &&
                  <div style={{ fontSize:11, color:C.red, marginBottom:3 }}>• Carrier legacy dominante presente</div>}
                {ap.curfew && <div style={{ fontSize:11, color:C.red, marginBottom:3 }}>• Curfew limita rotazioni notturne</div>}
                {npcAtAirport.length === 0 && playerRoutes.length === 0 &&
                  <div style={{ fontSize:11, color:C.red }}>• Nessuna rotta da/per questo aeroporto</div>}
              </div>
              <div style={{ background:"#0A1A10", border:`1px solid ${C.green}44`, borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.green, marginBottom:6 }}>💡 OPPORTUNITÀ</div>
                {ap.businessGatewayScore > 0.7 && <div style={{ fontSize:11, color:C.green, marginBottom:3 }}>• Forte mercato corporate — yield elevato</div>}
                {ap.touristGatewayScore > 0.7 && <div style={{ fontSize:11, color:C.green, marginBottom:3 }}>• Alto traffico leisure — load factor stabile</div>}
                {ap.hubPotentialScore > 0.8 && <div style={{ fontSize:11, color:C.green, marginBottom:3 }}>• Eccellente potenziale hub</div>}
                {npcAtAirport.length < 3 && <div style={{ fontSize:11, color:C.green }}>• Competizione bassa — spazio di crescita</div>}
              </div>
            </div>
          </>)}

          {/* TAB 1 — DOMANDA */}
          {tab === 1 && (<>
            <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800 }}>Domanda Totale Aeroporto</div>
                  <div style={{ fontSize:11, color:C.muted }}>pax settimanali stimati</div>
                </div>
                <div style={{ textAlign:"right" as const }}>
                  <div style={{ fontSize:20, fontWeight:900, color:C.cyan }}>{fmt(ap.terminalCapacityPerDay * 7)}</div>
                  <div style={{ fontSize:10, color:C.muted }}>pax/settimana</div>
                </div>
              </div>
              {demandSegs.map(s => (
                <div key={s.id}
                  onMouseEnter={() => setHovSeg(s.id)} onMouseLeave={() => setHovSeg(null)}
                  style={{ padding:"8px 10px", borderRadius:8, marginBottom:6, cursor:"default",
                    background:hovSeg===s.id?C.surface2:"transparent",
                    border:`1px solid ${hovSeg===s.id?s.color+"44":"transparent"}`, transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:14 }}>{s.icon}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:s.color, width:90 }}>{s.label}</span>
                    <div style={{ flex:1, height:8, background:C.border2, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${s.pct}%`, background:s.color, borderRadius:4 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:s.color, width:36, textAlign:"right" as const }}>{s.pct}%</span>
                    <span style={{ fontSize:11, color:C.textDim, width:90, textAlign:"right" as const }}>{fmt(s.pax)} pax</span>
                  </div>
                  {hovSeg === s.id && (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:8 }}>
                      {[["Yield",s.yield],["Elasticità",s.elasticity],["Booking",s.id==="corporate"?"3-14gg":"45-90gg"]].map(([l,v]) => (
                        <div key={l} style={{ background:C.bg, borderRadius:5, padding:"5px 8px" }}>
                          <div style={{ fontSize:9, color:C.muted }}>{String(l).toUpperCase()}</div>
                          <div style={{ fontSize:11, fontWeight:700, color:s.color }}>{String(v)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:14 }}>
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, marginBottom:8 }}>MIX SEGMENTI</div>
                <PieDonut data={demandSegs} centerLabel={fmt(ap.terminalCapacityPerDay * 7)} centerSub="pax/sett"/>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginTop:6 }}>
                  {demandSegs.map(s => (
                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
                      <span style={{ fontSize:9, color:C.textDim, flex:1 }}>{s.label}</span>
                      <span style={{ fontSize:9, color:s.color, fontWeight:700 }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, marginBottom:10 }}>STAGIONALITÀ — 12 MESI</div>
                <SeasonChart factors={seasonality} currentMonth={5}/>
                <div style={{ display:"flex", gap:16, marginTop:8 }}>
                  <span style={{ fontSize:9, color:C.cyan }}>▲ Picco: Luglio</span>
                  <span style={{ fontSize:9, color:C.red }}>▼ Valle: Gennaio</span>
                </div>
              </div>
            </div>
          </>)}

          {/* TAB 2 — SLOT & COMPETITOR */}
          {tab === 2 && (<>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:16, alignItems:"start" }}>
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, marginBottom:8 }}>DISTRIBUZIONE SLOT</div>
                <PieDonut data={slotPie.map(s => ({ ...s, pct: s.share }))}
                  centerLabel={`${playerSharePct.toFixed(0)}%`} centerSub="tuo share"/>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:4, marginTop:8 }}>
                  {slotPie.map(s => (
                    <div key={s.iata} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 6px",
                      borderRadius:5, background:s.isPlayer?C.surface2:"transparent",
                      border:s.isPlayer?`1px solid ${C.cyan}44`:"1px solid transparent" }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                      <span style={{ fontSize:10, flex:1, color:s.isPlayer?C.cyan:C.textDim, fontWeight:s.isPlayer?800:400 }}>
                        {s.iata} {s.name}
                      </span>
                      <span style={{ fontSize:10, fontWeight:700, color:s.color }}>{s.share.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted }}>
                  COMPETITOR ATTIVI ({npcAtAirport.length})
                </div>
                {npcAtAirport.length === 0 && (
                  <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"16px",
                    color:C.muted, fontSize:12 }}>
                    ✅ Nessun competitor NPC opera rotte da/per questo aeroporto.
                  </div>
                )}
                {npcAtAirport.map(co => {
                  const threat = co.reputation > 0.85 ? "alta" : co.reputation > 0.70 ? "media" : "bassa";
                  const routesHere = co.baseRoutes.filter(rt => rt.startsWith(iata+"-") || rt.endsWith("-"+iata)).length;
                  return (
                    <div key={co.id} style={{ background:C.surface, borderRadius:10,
                      border:`1px solid ${C.border}`, padding:"12px 14px",
                      borderLeft:`3px solid ${co.color}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                            <span style={{ fontSize:13, fontWeight:800 }}>{co.name}</span>
                            <ArchBadge a={co.archetype}/>
                          </div>
                          <div style={{ fontSize:10, color:C.muted }}>Hub: {co.hubIata} · {routesHere} rotte da {iata}</div>
                        </div>
                        <ThreatBadge t={threat}/>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                        {[["Pax/anno",`${co.paxMillions}M`,C.green],
                          ["Flotta",String(co.fleetSize),C.textDim],
                          ["Reputaz.",`${Math.round(co.reputation*100)}%`,C.cyan]
                        ].map(([l,v,c])=>(
                          <div key={l} style={{ background:C.surface2, borderRadius:5, padding:"5px 8px" }}>
                            <div style={{ fontSize:8, color:C.muted }}>{l}</div>
                            <div style={{ fontSize:11, fontWeight:700, color:c as string }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>)}

          {/* TAB 3 — ROTTE O/D */}
          {tab === 3 && (<>
            <div style={{ fontSize:11, color:C.muted }}>
              Rotte da/per {ap.iata} · {playerOD.length} attive · {npcOD.length} scoperte
            </div>
            {allOD.map((od, i) => {
              const isHov = hovOD === od.dest;
              return (
                <div key={od.dest}
                  onMouseEnter={() => setHovOD(od.dest)} onMouseLeave={() => setHovOD(null)}
                  style={{ background:isHov?C.surface:C.surface2,
                    border:`1px solid ${od.isActive?(isHov?C.cyan:C.border):(isHov?C.border:C.border2)}`,
                    borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all .15s",
                    borderLeft:od.isActive?`4px solid ${C.cyan}`:`4px solid ${C.dim}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:12, color:C.dim, fontWeight:700, width:24 }}>#{i+1}</span>
                    <div style={{ width:100 }}>
                      <div style={{ fontSize:14, fontWeight:900, color:od.isActive?C.cyan:C.text }}>
                        {iata}→{od.dest}
                      </div>
                      <div style={{ fontSize:10, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, maxWidth:95 }}>
                        {od.city}
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ height:6, background:C.border2, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, width:`${od.isActive?70:30}%`, background:od.isActive?C.cyan:C.dim }}/>
                      </div>
                    </div>
                    {[
                      ["SHARE", od.isActive?`${od.myShare}%`:"—", od.isActive?C.cyan:C.dim],
                      ["COMP.", `${od.comp}✈`, C.textDim],
                      ["FREQ",  od.isActive?`${od.freq}×/sett`:"—", od.isActive?C.green:C.dim],
                    ].map(([l,v,c]) => (
                      <div key={l} style={{ textAlign:"center" as const, minWidth:56 }}>
                        <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                        <div style={{ fontSize:12, fontWeight:800, color:c as string }}>{v}</div>
                      </div>
                    ))}
                    <span style={{ background:od.isActive?"#00C8FF18":C.surface2, color:od.isActive?C.cyan:C.muted,
                      borderRadius:6, padding:"4px 10px", fontSize:10, fontWeight:700,
                      border:`1px solid ${od.isActive?C.cyan:C.border}` }}>
                      {od.isActive ? `ATTIVA ${od.freq}×/sett` : "+ APRI"}
                    </span>
                  </div>
                </div>
              );
            })}
            {allOD.length === 0 && (
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:20,
                color:C.muted, textAlign:"center" as const, fontSize:12 }}>
                Nessuna rotta nota. Apri Studio Rotta per analizzare la domanda.
              </div>
            )}
          </>)}

          {/* TAB 4 — ECONOMIA */}
          {tab === 4 && (<>
            <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>
                STRUTTURA COSTI — {iata} (per movimento A320 equivalente)
              </div>
              {[
                ["Landing fee",    `$${Math.round(ap.baseFees).toLocaleString()}`, Math.round(ap.baseFees/(ap.baseFees+2400+4900+1850+1200+2100)*100), C.red],
                ["Handling fee",   `$${Math.round(ap.handling_fee_base ?? 2400).toLocaleString()}`, 16, C.amber],
                ["Carburante",     `diff. ${(ap.fuel_price_differential??0)>=0?"+":""}${((ap.fuel_price_differential??0)*100).toFixed(0)}%`, 33, "#6EE7B7"],
                ["Tassa pax",      `$${ap.passengerFees}/pax`, 8, C.blue],
                ["Navigazione",    "$1.850", 12, C.purple],
                ["Maint. reserve", "$450", 3, C.textDim],
              ].map(([l, v, p, c]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:10, color:C.textDim, width:140 }}>{l}</span>
                  <div style={{ flex:1, height:8, background:C.border2, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${p}%`, background:c as string, borderRadius:4 }}/>
                  </div>
                  <span style={{ fontSize:10, color:c as string, width:30, textAlign:"right" as const }}>{p}%</span>
                  <span style={{ fontSize:11, fontWeight:700, color:C.text, width:80, textAlign:"right" as const }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
              <StatBox label="Landing fee" value={`$${Math.round(ap.baseFees).toLocaleString()}`} color={C.amber} border={C.amber+"66"} />
              <StatBox label="Tassa pax" value={`$${ap.passengerFees}/pax`} color={C.amber} border={C.border} />
              <StatBox label="Fuel diff." value={`${(ap.fuel_price_differential??0)>=0?"+":""}${((ap.fuel_price_differential??0)*100).toFixed(0)}%`}
                color={(ap.fuel_price_differential??0)>0.15?C.red:C.green} border={C.border} />
              <StatBox label="Slot market" value={(ap.slot_market_price??0)>0 ? `$${fmt(ap.slot_market_price??0)}` : "Libero"} color={C.cyan} border={C.cyan+"66"} />
            </div>
          </>)}
        </>)}

        {/* ══ LIVELLO CITTÀ ════════════════════════════════════════════ */}
        {level === "city" && (<>
          {tab === 0 && (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>AEROPORTI DELL'AREA</div>
                {[ap, ...cityAirports].map(airport => {
                  const hasRoutes = (state?.routes ?? []).some(r => r.originIata === airport.iata || r.destinationIata === airport.iata);
                  const apCong = congFromLevel(airport.congestionLevel);
                  return (
                    <div key={airport.iata}
                      onClick={() => {
                        dispatch({ type:"LOAD_GAME", payload: { ...state!, selectedAirportIata: airport.iata }});
                        setLevel("airport"); setTab(0);
                      }}
                      style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10, padding:"10px 12px",
                        borderRadius:8, cursor:"pointer",
                        background:airport.iata===iata?C.surface2:C.surface,
                        border:`1px solid ${airport.iata===iata?C.cyan:C.border}` }}>
                      <div style={{ minWidth:60 }}>
                        <div style={{ fontSize:16, fontWeight:900, color:TIER_COLOR[airport.tier??"C"] }}>{airport.iata}</div>
                        <div style={{ fontSize:9, color:C.muted }}>Tier {airport.tier ?? "C"}</div>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{airport.name}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{fmt(airport.terminalCapacityPerDay * 365)} pax/anno</div>
                      </div>
                      <span style={{ fontSize:9, background:CONGESTION_COLOR[apCong]+"18",
                        color:CONGESTION_COLOR[apCong], borderRadius:4, padding:"2px 7px", fontWeight:700 }}>
                        L{apCong}
                      </span>
                      {hasRoutes
                        ? <span style={{ background:"#00C8FF18", color:C.cyan, borderRadius:5, padding:"3px 9px", fontSize:10, fontWeight:700 }}>✓ PRESENTE</span>
                        : <span style={{ background:C.surface2, color:C.dim, borderRadius:5, padding:"3px 9px", fontSize:10 }}>— Assente</span>
                      }
                      <span style={{ color:C.muted, fontSize:12 }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 1 && (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
              {[ap, ...cityAirports].map(airport => {
                const segs = computeDemandSegments(airport);
                return (
                  <div key={airport.iata} style={{ background:C.surface, borderRadius:10,
                    border:`1px solid ${C.border}`, padding:"14px 16px" }}>
                    <div style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:10 }}>
                      {airport.iata} — {airport.name}
                    </div>
                    {segs.map(s => (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:12 }}>{s.icon}</span>
                        <span style={{ fontSize:11, color:s.color, width:80 }}>{s.label}</span>
                        <div style={{ flex:1, height:6, background:C.border2, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${s.pct}%`, background:s.color, borderRadius:3 }}/>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:s.color, width:36, textAlign:"right" as const }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 2 && (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
              <div style={{ fontSize:11, color:C.muted }}>NPC che operano su almeno uno degli aeroporti dell'area.</div>
              {npcAtAirport.map(npc => (
                <div key={npc.id} style={{ background:C.surface, borderRadius:10,
                  border:`1px solid ${C.border}`, padding:"12px 14px", borderLeft:`3px solid ${npc.color}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, marginBottom:2 }}>{npc.name}</div>
                      <div style={{ fontSize:10, color:C.muted }}>Hub: {npc.hubIata} · {npc.paxMillions}M pax/anno</div>
                    </div>
                    <ArchBadge a={npc.archetype}/>
                  </div>
                </div>
              ))}
              {npcAtAirport.length === 0 && (
                <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:16,
                  color:C.muted, textAlign:"center" as const }}>
                  Nessun NPC airline opera rotte da questa area.
                </div>
              )}
            </div>
          )}
        </>)}

        {/* ══ LIVELLO REGIONE ══════════════════════════════════════════ */}
        {level === "region" && (<>
          {tab === 0 && (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
                <StatBox label="Aeroporti A/B" value={regionAirports.length} color={C.cyan} border={C.cyan+"66"} />
                <StatBox label="Tuo hub" value={iata} color={C.cyan} border={C.cyan+"66"} />
                <StatBox label="Continent" value={ap.continent} color={C.text} border={C.border} />
                <StatBox label="NPC attivi" value={npcAirlines.filter(n=>n.homeRegion===ap.continent).length} color={C.amber} border={C.amber+"66"} />
              </div>
              <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:10 }}>
                  TOP HUB REGIONALI — {ap.continent}
                </div>
                {regionAirports
                  .sort((a, b) => b.hubPotentialScore - a.hubPotentialScore)
                  .slice(0, 10)
                  .map(airport => {
                    const isSelected = airport.iata === iata;
                    const npcHere = npcAirlines.filter(n => n.hubIata === airport.iata).length;
                    return (
                      <div key={airport.iata}
                        onClick={() => {
                          dispatch({ type:"LOAD_GAME", payload: { ...state!, selectedAirportIata: airport.iata }});
                          switchLevel("airport");
                        }}
                        style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8, padding:"8px 10px",
                          borderRadius:7, cursor:"pointer",
                          background:isSelected?C.surface2:"transparent",
                          border:`1px solid ${isSelected?C.cyan:C.border2}` }}>
                        <span style={{ fontSize:13, fontWeight:800, color:isSelected?C.cyan:C.text, width:46 }}>{airport.iata}</span>
                        <span style={{ fontSize:11, color:C.muted, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{airport.name}</span>
                        <div style={{ width:80, height:6, background:C.border2, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${airport.hubPotentialScore*100}%`, background:isSelected?C.cyan:C.muted, borderRadius:3 }}/>
                        </div>
                        <span style={{ fontSize:10, color:C.amber, width:30, textAlign:"right" as const }}>{npcHere}✈</span>
                        {isSelected && <span style={{ fontSize:9, color:C.cyan, fontWeight:700 }}>★ HUB</span>}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {tab === 1 && (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
              <div style={{ fontSize:11, color:C.muted }}>
                NPC airline con base nel continente {ap.continent}
              </div>
              {npcAirlines
                .filter(n => n.homeRegion === ap.continent)
                .sort((a, b) => b.paxMillions - a.paxMillions)
                .map(npc => (
                  <div key={npc.id} style={{ background:C.surface, borderRadius:10,
                    border:`1px solid ${C.border}`, padding:"12px 14px",
                    borderLeft:`3px solid ${npc.color}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:800, marginBottom:2 }}>{npc.name}</div>
                        <div style={{ fontSize:10, color:C.muted }}>Hub: {npc.hubIata} · {npc.baseRoutes.length} rotte · {npc.fleetSize} aerei</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:900, color:C.green }}>{npc.paxMillions}M</span>
                      <span style={{ fontSize:10, color:C.muted }}>pax/anno</span>
                      <ArchBadge a={npc.archetype}/>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </>)}

      </div>
    </div>
  );
}
