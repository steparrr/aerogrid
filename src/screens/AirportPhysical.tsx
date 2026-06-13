import { useState, useMemo } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import type { Airport } from "../domain/types";

const C = {
  bg:"#080E1A", surface:"#0F1829", surface2:"#0A1220",
  border:"#1E2D45", border2:"#0D1729",
  cyan:"#00C8FF", green:"#34D399", amber:"#F59E0B", red:"#F87171",
  purple:"#A78BFA", blue:"#93C5FD", teal:"#2DD4BF", gold:"#F6C343",
  muted:"#64748B", dim:"#374151", text:"#E2E8F0", textDim:"#94A3B8",
};

const LOUNGE_TYPES = [
  { id:"economy_plus", label:"Economy Plus Lounge",  icon:"☕", color:C.teal,   cost:2_000_000,  paxDay:400,  revenue:18, unlockLevel:1 },
  { id:"business",     label:"Business Class Lounge",icon:"💼", color:C.blue,   cost:5_000_000,  paxDay:150,  revenue:45, unlockLevel:1 },
  { id:"first_class",  label:"First Class Suite",    icon:"✦",  color:C.gold,   cost:12_000_000, paxDay:40,   revenue:140,unlockLevel:2 },
  { id:"family",       label:"Family Zone",          icon:"👨‍👩‍👧", color:C.green,  cost:1_500_000,  paxDay:200,  revenue:12, unlockLevel:1 },
  { id:"premium",      label:"Premium SPA & Shower", icon:"🛁",  color:C.purple, cost:3_500_000,  paxDay:80,   revenue:65, unlockLevel:2 },
  { id:"transit",      label:"Transit Hotel",        icon:"🛏",  color:C.amber,  cost:8_000_000,  paxDay:60,   revenue:110,unlockLevel:3 },
];

const REVENUE_CENTERS = [
  { id:"duty_free",   label:"Duty Free",        icon:"🛍", rev:12_400, color:C.cyan,   margin:0.42 },
  { id:"fb",          label:"F&B Concessions",  icon:"🍴", rev:8_200,  color:C.green,  margin:0.31 },
  { id:"hotel",       label:"Hotel / Transit",  icon:"🛎", rev:5_600,  color:C.amber,  margin:0.48 },
  { id:"parking",     label:"Parking",          icon:"🅿", rev:4_100,  color:C.blue,   margin:0.71 },
  { id:"cargo",       label:"Cargo Services",   icon:"📦", rev:3_300,  color:C.purple, margin:0.29 },
  { id:"advertising", label:"Advertising",      icon:"📺", rev:2_100,  color:C.teal,   margin:0.88 },
  { id:"rental",      label:"Car Rental",       icon:"🚗", rev:1_900,  color:C.gold,   margin:0.22 },
  { id:"vip",         label:"VIP Services",     icon:"⭐", rev:1_500,  color:C.red,    margin:0.55 },
];

const MRO_TYPES = [
  { id:"line",  label:"Line Maintenance",  desc:"Check A — routine overnight",      icon:"🔧", color:C.green,  cost:500_000,   monthly:80_000,  unlockLevel:1 },
  { id:"base",  label:"Base Maintenance",  desc:"Check C — dock, 5–7 giorni",      icon:"⚙", color:C.amber,  cost:3_000_000, monthly:250_000, unlockLevel:2 },
  { id:"heavy", label:"Heavy Maintenance", desc:"Check D — hangar, 4–6 settimane", icon:"🏭", color:C.red,    cost:18_000_000,monthly:900_000, unlockLevel:3 },
];

const FUEL_TANKS = [
  { id:"t1", label:"Tank 1 — Kerosene JetA", cap:2_000, fill:0.78, temp:14, color:C.cyan  },
  { id:"t2", label:"Tank 2 — Kerosene JetA", cap:2_000, fill:0.55, temp:15, color:C.blue  },
  { id:"t3", label:"SAF Blend (10%)",         cap:500,   fill:0.40, temp:14, color:C.green },
];

const sizeMult: Record<string, number>  = { small:0.4, medium:0.75, large:1.2, megaHub:2.0 };
const tierMult: Record<string, number>  = { A:1.3, B:1.0, C:0.6 };

function scaleRev(base: number, ap: Airport) {
  return Math.round(base * (sizeMult[ap.airportSize] ?? 1) * (tierMult[ap.tier ?? "C"] ?? 0.6));
}

function StatBox({ label, value, sub, color=C.text, border=C.border }: {
  label:string; value:string|number; sub?:string; color?:string; border?:string
}) {
  return (
    <div style={{ background:C.surface2, borderRadius:8, padding:"10px 12px", borderLeft:`3px solid ${border}` }}>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:800, color, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:C.dim, marginTop:1 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, color=C.cyan, height=8 }: { value:number; color?:string; height?:number }) {
  return (
    <div style={{ height, background:C.border2, borderRadius:height, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min(100,value)}%`, background:color, borderRadius:height }}/>
    </div>
  );
}

const TABS = ["Lounge Portfolio","Revenue Center","MRO","Carburante"];

export function AirportPhysical() {
  const { state, dispatch } = useGame();
  const [tab, setTab]             = useState(0);
  const [selLounge, setSelLounge] = useState<string | null>(null);
  const [selMRO, setSelMRO]       = useState<string | null>(null);

  const iata = state?.selectedAirportIata ?? state?.hubIata ?? "LHR";
  const ap: Airport | undefined = airports.find(a => a.iata === iata);
  const isHub   = ap?.iata === state?.hubIata;
  const lvl     = state?.player?.level ?? 1;

  const revCenters = useMemo(() =>
    ap ? REVENUE_CENTERS.map(r => ({ ...r, rev: scaleRev(r.rev, ap) })) : REVENUE_CENTERS,
    [ap]
  );
  const totalRev = revCenters.reduce((s, r) => s + r.rev, 0);

  if (!ap) return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-conceptual" })}
        style={{ background:C.cyan, color:"#000", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer" }}>
        ← Indietro
      </button>
    </div>
  );

  const gateCount   = ap.airportSize === "megaHub" ? 80 : ap.airportSize === "large" ? 45 : ap.airportSize === "medium" ? 22 : 10;
  const runwayCount = ap.runwayLengthM > 3400 ? 4 : ap.runwayLengthM > 3000 ? 2 : 1;

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", color:C.text, fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#0A1628", borderBottom:`1px solid ${C.border}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-conceptual" })}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:"50%", width:30, height:30,
              cursor:"pointer", color:C.text, fontSize:15 }}>←</button>
          <span style={{ color:C.cyan, fontSize:10, fontWeight:700, letterSpacing:".18em" }}>AEROGRID</span>
          <span style={{ color:C.border }}>|</span>
          <span style={{ color:C.muted, fontSize:10 }}>INFRASTRUTTURA · {iata}</span>
          <button onClick={() => dispatch({ type:"SET_VIEW", payload:"terminal-map" })}
            style={{ marginLeft:"auto", background:"#00C8FF15", border:`1px solid ${C.cyan}44`,
              borderRadius:6, color:C.cyan, fontSize:10, padding:"4px 10px", cursor:"pointer", fontWeight:700 }}>
            🗺 Mappa Terminal →
          </button>
        </div>

        <div style={{ display:"flex", alignItems:"baseline", gap:12, flexWrap:"wrap" as const }}>
          <div>
            <span style={{ fontSize:22, fontWeight:900 }}>{ap.iata}</span>
            <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>{ap.name}</span>
            {isHub && <span style={{ marginLeft:8, fontSize:9, background:"#00C8FF15", color:C.cyan,
              borderRadius:4, padding:"2px 7px", fontWeight:700 }}>★ HUB</span>}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:16 }}>
            {[["GATE",String(gateCount),C.cyan],["PISTE",String(runwayCount),C.textDim],
              ["PISTA",`${ap.runwayLengthM}m`,C.amber],["TIER",ap.tier??"—",ap.tier==="A"?C.cyan:ap.tier==="B"?C.green:C.muted]
            ].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:"right" as const }}>
                <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ background:"#0A1220", borderBottom:`1px solid ${C.border}`, padding:"0 16px", display:"flex", gap:2 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding:"8px 14px", border:"none", cursor:"pointer", background:"transparent",
            borderBottom:tab===i?`2px solid ${C.cyan}`:"2px solid transparent",
            color:tab===i?C.cyan:C.muted, fontSize:11, fontWeight:tab===i?800:500 }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column" as const, gap:14 }}>

        {/* ══ TAB 0 — LOUNGE PORTFOLIO ══ */}
        {tab === 0 && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
            <StatBox label="Lounge attive" value={isHub?"1":"0"} color={C.cyan} border={C.cyan+"66"} sub="su 6 possibili" />
            <StatBox label="Rev/giorno"    value={isHub?"$4.200":"—"}            color={C.green} border={C.green+"66"} />
            <StatBox label="Pax serviti/g" value={isHub?"150":"—"}               color={C.textDim} border={C.border} />
            <StatBox label="NPS lounge"    value={isHub?"+48":"—"}               color={C.amber} border={C.amber+"66"} />
          </div>

          {LOUNGE_TYPES.map(lounge => {
            const unlocked = isHub && lvl >= lounge.unlockLevel;
            const isActive = lounge.id === "business" && isHub;
            const isSel    = selLounge === lounge.id;
            return (
              <div key={lounge.id}
                onClick={() => setSelLounge(isSel ? null : lounge.id)}
                style={{ background:C.surface, borderRadius:10,
                  border:`1px solid ${isSel?lounge.color:C.border}`,
                  borderLeft:`4px solid ${isActive?lounge.color:C.dim}`,
                  padding:"12px 14px", cursor:"pointer", transition:"all .15s", opacity:unlocked?1:0.62 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>{lounge.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800 }}>{lounge.label}</span>
                      {isActive
                        ? <span style={{ background:"#00C8FF18", color:C.cyan, borderRadius:4, padding:"1px 7px", fontSize:9, fontWeight:700 }}>● OPERATIVA</span>
                        : unlocked
                          ? <span style={{ background:C.surface2, color:C.muted, borderRadius:4, padding:"1px 7px", fontSize:9 }}>🔒 COSTRUIRE</span>
                          : <span style={{ background:"#3A1010", color:C.red+"CC", borderRadius:4, padding:"1px 7px", fontSize:9 }}>🔒 LV{lounge.unlockLevel}</span>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                      {[["Capienza",`${lounge.paxDay} pax/g`,C.textDim],
                        ["Rev/pax", `$${lounge.revenue}`,     C.green],
                        ["Costo",   `$${(lounge.cost/1_000_000).toFixed(1)}M`,C.amber]
                      ].map(([l,v,c]) => (
                        <div key={l} style={{ background:C.surface2, borderRadius:5, padding:"5px 7px" }}>
                          <div style={{ fontSize:8, color:C.muted }}>{l}</div>
                          <div style={{ fontSize:11, fontWeight:700, color:c as string }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <span style={{ color:C.muted, fontSize:12 }}>{isSel?"▲":"▼"}</span>
                </div>
                {isSel && (
                  <div style={{ marginTop:12, padding:"10px 12px", background:C.surface2, borderRadius:8,
                    borderLeft:`3px solid ${lounge.color}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:lounge.color, marginBottom:8 }}>
                      {isActive ? "LOUNGE OPERATIVA — KPI" : unlocked ? "ANALISI INVESTIMENTO" : `RICHIEDE LIVELLO ${lounge.unlockLevel}`}
                    </div>
                    {isActive && (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                        {[["Rev/mese",`$${(lounge.revenue*lounge.paxDay*30).toLocaleString()}`,C.green],
                          ["NPS boost","+12",C.cyan],["Occ.","78%",C.amber]].map(([l,v,c]) => (
                          <div key={l}><div style={{ fontSize:9, color:C.muted }}>{l}</div>
                            <div style={{ fontSize:13, fontWeight:800, color:c as string }}>{v}</div></div>
                        ))}
                      </div>
                    )}
                    {!isActive && unlocked && (
                      <div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:8 }}>
                          {[["ROI",`${Math.round(lounge.cost/(lounge.revenue*lounge.paxDay*365)*100)}%`,C.amber],
                            ["Break-even",`${Math.round(lounge.cost/(lounge.revenue*lounge.paxDay*30))} mesi`,C.textDim]].map(([l,v,c]) => (
                            <div key={l}><div style={{ fontSize:9, color:C.muted }}>{l}</div>
                              <div style={{ fontSize:13, fontWeight:800, color:c as string }}>{v}</div></div>
                          ))}
                        </div>
                        <button style={{ background:lounge.color+"22", color:lounge.color, border:`1px solid ${lounge.color}`,
                          borderRadius:6, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer", width:"100%" }}>
                          Costruire per ${(lounge.cost/1_000_000).toFixed(1)}M →
                        </button>
                      </div>
                    )}
                    {!unlocked && (
                      <div style={{ fontSize:11, color:C.muted }}>
                        Raggiungi il livello {lounge.unlockLevel} in Progressione per sbloccare questo upgrade.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {/* ══ TAB 1 — REVENUE CENTER ══ */}
        {tab === 1 && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
            <StatBox label="Ricavi non-av." value={`$${(totalRev/1000).toFixed(0)}K`} color={C.green} border={C.green+"66"} sub="mensili stimati" />
            <StatBox label="Rev/pax" value={`$${(totalRev/(ap.terminalCapacityPerDay*30)).toFixed(1)}`} color={C.cyan} border={C.cyan+"66"} />
            <StatBox label="Margine medio" value="48%" color={C.amber} border={C.amber+"66"} />
          </div>

          <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>RICAVI NON-AVIATION — {ap.iata}</div>
            {revCenters.map(rc => (
              <div key={rc.id} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <span style={{ fontSize:14 }}>{rc.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, flex:1 }}>{rc.label}</span>
                  <span style={{ fontSize:11, fontWeight:800, color:rc.color }}>${rc.rev.toLocaleString()}</span>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{ flex:1, height:8, background:C.border2, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.round((rc.rev/totalRev)*100)}%`, background:rc.color, borderRadius:4 }}/>
                  </div>
                  <span style={{ fontSize:9, color:rc.color, width:28, textAlign:"right" as const }}>{Math.round((rc.rev/totalRev)*100)}%</span>
                  <span style={{ fontSize:9, color:C.green, width:44, textAlign:"right" as const }}>m:{Math.round(rc.margin*100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:"#0A1A10", border:`1px solid ${C.green}44`, borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.green, marginBottom:8 }}>💡 OPPORTUNITÀ DI ESPANSIONE</div>
            {ap.businessGatewayScore > 0.7 && <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>• Alto traffico corporate → lounge business + fast track security</div>}
            {ap.touristGatewayScore > 0.7 && <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>• Destinazione turistica → duty free + F&B locale ad alta marginalità</div>}
            {(ap.airportSize === "large" || ap.airportSize === "megaHub") && <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>• Volume elevato → hotel transit e parcheggi hanno potenziale importante</div>}
            <div style={{ fontSize:11, color:C.textDim }}>• Cargo genera margine solo con wide-body stabile</div>
          </div>
        </>)}

        {/* ══ TAB 2 — MRO ══ */}
        {tab === 2 && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
            <StatBox label="MRO attivi"   value={isHub?"1":"0"}      color={C.amber} border={C.amber+"66"} />
            <StatBox label="Efficienza"   value={isHub?"92%":"—"}    color={C.green} border={C.green+"66"} />
            <StatBox label="AOG rischio"  value="BASSO"              color={C.green} border={C.border} />
            <StatBox label="Livello max"  value={`LV${lvl}`}         color={C.cyan}  border={C.cyan+"66"} />
          </div>

          {MRO_TYPES.map(mro => {
            const unlocked = lvl >= mro.unlockLevel;
            const isActive = mro.id === "line" && isHub;
            const isSel    = selMRO === mro.id;
            return (
              <div key={mro.id}
                onClick={() => setSelMRO(isSel ? null : mro.id)}
                style={{ background:C.surface, borderRadius:10,
                  border:`1px solid ${isSel?mro.color:C.border}`,
                  borderLeft:`4px solid ${isActive?mro.color:C.dim}`,
                  padding:"12px 14px", cursor:"pointer", opacity:unlocked?1:0.55 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:24 }}>{mro.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:14, fontWeight:800 }}>{mro.label}</span>
                      {isActive
                        ? <span style={{ background:mro.color+"22", color:mro.color, borderRadius:4, padding:"1px 7px", fontSize:9, fontWeight:700 }}>● OPERATIVO</span>
                        : unlocked
                          ? <span style={{ background:C.surface2, color:C.muted, borderRadius:4, padding:"1px 7px", fontSize:9 }}>COSTRUIRE</span>
                          : <span style={{ background:"#3A1010", color:C.red+"CC", borderRadius:4, padding:"1px 7px", fontSize:9 }}>🔒 LV{mro.unlockLevel}</span>}
                    </div>
                    <div style={{ fontSize:11, color:C.muted }}>{mro.desc}</div>
                  </div>
                  <div style={{ textAlign:"right" as const, minWidth:80 }}>
                    <div style={{ fontSize:9, color:C.muted }}>MENSILE</div>
                    <div style={{ fontSize:12, fontWeight:800, color:mro.color }}>${(mro.monthly/1000).toFixed(0)}K</div>
                  </div>
                </div>
                {isSel && (
                  <div style={{ marginTop:12, padding:"10px 12px", background:C.surface2, borderRadius:8, borderLeft:`3px solid ${mro.color}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:mro.color, marginBottom:8 }}>
                      {isActive ? "FACILITY ATTIVA" : unlocked ? "ANALISI INVESTIMENTO" : "BLOCCATA"}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:8 }}>
                      {[["Costo apertura",`$${(mro.cost/1_000_000).toFixed(1)}M`,C.amber],
                        ["Costo/mese",`$${(mro.monthly/1000).toFixed(0)}K`,C.red],
                        ["Risparmio est.",mro.id==="line"?"$60K/m":mro.id==="base"?"$140K/m":"$320K/m",C.green]
                      ].map(([l,v,c]) => (
                        <div key={l}><div style={{ fontSize:9, color:C.muted }}>{l}</div>
                          <div style={{ fontSize:12, fontWeight:800, color:c as string }}>{v}</div></div>
                      ))}
                    </div>
                    {isActive && (<>
                      <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>UTILIZZO CAPACITY</div>
                      <ProgressBar value={72} color={mro.color} />
                      <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>72% — ottimale</div>
                    </>)}
                    {!isActive && unlocked && (
                      <button style={{ background:mro.color+"22", color:mro.color, border:`1px solid ${mro.color}`,
                        borderRadius:6, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer", width:"100%" }}>
                        Costruire per ${(mro.cost/1_000_000).toFixed(1)}M →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {/* ══ TAB 3 — CARBURANTE ══ */}
        {tab === 3 && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
            <StatBox label="Prezzo JetA" value={`$${((state?.market_fuel_price ?? 0.95) * (1 + (ap.fuel_price_differential ?? 0))).toFixed(3)}/kg`} color={C.amber} border={C.amber+"66"} />
            <StatBox label="Diff. mercato" value={`${(ap.fuel_price_differential ?? 0)>=0?"+":""}${((ap.fuel_price_differential ?? 0)*100).toFixed(0)}%`}
              color={(ap.fuel_price_differential??0)>0.15?C.red:C.green} border={C.border} />
            <StatBox label="SAF blend"  value="10%"  color={C.green}  border={C.green+"66"} />
            <StatBox label="Hedging"    value="40%"  color={C.purple} border={C.purple+"66"} sub="3 mesi avanti" />
          </div>

          <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>SERBATOI IN LOCO</div>
            {FUEL_TANKS.map(t => (
              <div key={t.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{t.label}</span>
                  <span style={{ fontSize:11, color:C.muted }}>{Math.round(t.fill*t.cap).toLocaleString()} / {t.cap.toLocaleString()} t · {t.temp}°C</span>
                </div>
                <div style={{ position:"relative", height:22, background:C.border2, borderRadius:6, overflow:"hidden" }}>
                  <div style={{ position:"absolute", inset:0, width:`${t.fill*100}%`, background:t.color+"BB" }}/>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700, color:C.text }}>
                    {Math.round(t.fill*100)}% pieno
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>ANALISI TANKERING</div>
            {[
              { dest:"LHR", priceLoc:0.91, priceDest:0.98, rec:"Carica extra", color:C.green },
              { dest:"CDG", priceLoc:0.91, priceDest:0.87, rec:"Carica al destino", color:C.amber },
              { dest:"DXB", priceLoc:0.91, priceDest:1.04, rec:"Carica extra +15%", color:C.cyan },
            ].filter(r => r.dest !== iata).slice(0, 3).map(r => (
              <div key={r.dest} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8, padding:"8px 10px",
                borderRadius:8, background:C.surface2 }}>
                <span style={{ fontSize:12, fontWeight:800, width:40, color:C.text }}>{r.dest}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginBottom:3 }}>
                    <span>Locale: ${r.priceLoc}/kg</span><span>Dest: ${r.priceDest}/kg</span>
                  </div>
                  <ProgressBar value={(r.priceLoc/r.priceDest)*100} color={r.color} height={6} />
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:r.color, whiteSpace:"nowrap" as const }}>{r.rec}</span>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>HEDGING ATTIVO</div>
            {(state?.player?.fuel_hedges ?? []).length === 0 ? (
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
                  Nessun contratto hedging attivo. Proteggi la tua azienda dai picchi del prezzo carburante.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {[{ type:"COLLAR", desc:"Fascia min/max", color:C.cyan, cost:"$8K/m" },
                    { type:"SWAP",   desc:"Prezzo fisso",   color:C.amber, cost:"$5K/m" },
                    { type:"OPTION", desc:"Diritto, non obbligo", color:C.green, cost:"$12K/m" },
                  ].map(h => (
                    <button key={h.type} style={{ background:h.color+"12", color:h.color,
                      border:`1px solid ${h.color}44`, borderRadius:8, padding:"10px",
                      cursor:"pointer", textAlign:"center" as const }}>
                      <div style={{ fontSize:12, fontWeight:800 }}>{h.type}</div>
                      <div style={{ fontSize:9, color:C.textDim, marginTop:3 }}>{h.desc}</div>
                      <div style={{ fontSize:10, fontWeight:700, marginTop:6, color:h.color }}>{h.cost}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (state?.player?.fuel_hedges ?? []).map((h, i) => (
              <div key={i} style={{ background:C.surface2, borderRadius:8, padding:"10px 12px", marginBottom:8, borderLeft:`3px solid ${C.purple}` }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.purple }}>{h.type}</span>
                  <span style={{ fontSize:10, color:h.status==="ACTIVE"?C.green:C.muted }}>{h.status}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:6 }}>
                  {[["Copertura",`${h.coveragePct}%`,C.cyan],["Strike",`$${h.strikePrice.toFixed(3)}`,C.amber],
                    ["Risparmio/m",`$${h.monthlySaving.toLocaleString()}`,C.green]].map(([l,v,c]) => (
                    <div key={l}><div style={{ fontSize:9, color:C.muted }}>{l}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:c as string }}>{v}</div></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>)}

      </div>
    </div>
  );
}
