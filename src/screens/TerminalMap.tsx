import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import { npcAirlines } from "../data/npcAirlines";
import type { Airport } from "../domain/types";

const C = {
  bg:"#080E1A", surface:"#0F1829", surface2:"#0A1220",
  border:"#1E2D45", border2:"#0D1729",
  cyan:"#00C8FF", green:"#34D399", amber:"#F59E0B", red:"#F87171",
  purple:"#A78BFA", muted:"#64748B", dim:"#374151", text:"#E2E8F0", textDim:"#94A3B8",
};

type LayerId = "gates" | "lounges" | "amenities" | "heatmap";

interface Gate {
  id: string; x: number; y: number; label: string;
  type: "player" | "npc" | "empty"; color: string;
  npcName?: string; concourse: string;
}

interface Lounge { id:string; x:number; y:number; type:string; color:string; label:string }
interface Amenity { id:string; x:number; y:number; icon:string; label:string }
interface Detail { id:string; label:string; type:string; color:string; info:string[] }

// ── Procedural terminal generator ────────────────────────────────────────────
function generateTerminal(ap: Airport, playerIata: string, npcAtAirport: typeof npcAirlines) {
  const sizeMap: Record<string,number> = { small:10, medium:22, large:45, megaHub:80 };
  const totalGates = sizeMap[ap.airportSize] ?? 22;
  const concourseCount = ap.airportSize === "megaHub" ? 4 : ap.airportSize === "large" ? 3 : ap.airportSize === "medium" ? 2 : 1;

  const concourseLetters = "ABCDE".slice(0, concourseCount);
  const gatesPerCon = Math.ceil(totalGates / concourseCount);

  // NPC airlines at this airport + their colors
  const npcList = npcAtAirport.slice(0, Math.min(6, npcAtAirport.length));

  const W = 700, H = 520;
  const concourseW = 580 / concourseCount;
  const gateRadius = 8;

  const gates: Gate[] = [];
  const lounges: Lounge[] = [];
  const amenities: Amenity[] = [];

  concourseLetters.split("").forEach((letter, ci) => {
    const cx = 70 + ci * concourseW;
    const gates_in = Math.min(gatesPerCon, totalGates - ci * gatesPerCon);
    const colH = Math.min(gates_in, 10);
    const rows = Math.ceil(gates_in / colH);

    for (let gi = 0; gi < gates_in; gi++) {
      const row = Math.floor(gi / colH);
      const col = gi % colH;
      const x = cx + row * 40;
      const y = 120 + col * 35;
      const gateNum = ci * gatesPerCon + gi + 1;
      const gateLabel = `${letter}${gateNum}`;

      // Assign: first few to player, then NPC, then empty
      let type: Gate["type"] = "empty";
      let color = C.dim;
      let npcName: string | undefined;

      if (gi === 0 && ci === 0) {
        // player hub gate
        type = "player"; color = C.cyan;
      } else if (gi < 3 && ci === 0) {
        type = "player"; color = C.cyan;
      } else {
        const npcIdx = (ci * gatesPerCon + gi - 3) % (npcList.length + 2);
        if (npcIdx < npcList.length && npcList[npcIdx]) {
          type = "npc"; color = npcList[npcIdx].color; npcName = npcList[npcIdx].name;
        }
      }

      gates.push({ id:gateLabel, x, y, label:gateLabel, type, color, npcName, concourse:letter });
    }

    // Add lounge per concourse
    lounges.push({
      id:`lounge-${letter}`, x: cx + (rows > 1 ? (rows-1)*40/2 : 0), y: 80,
      type:"business", color:C.amber,
      label: ci === 0 ? "Business Lounge" : `Lounge ${letter}`,
    });

    // Add amenities
    amenities.push({ id:`wc-${letter}`, x: cx + 10, y: 50, icon:"🚻", label:"WC" });
    if (ci % 2 === 0) {
      amenities.push({ id:`fb-${ci}`, x: cx + 30, y: 50, icon:"🍴", label:"F&B" });
    }
  });

  return { gates, lounges, amenities, W, H, concourseLetters, gateRadius };
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ detail, onClose }: { detail:Detail; onClose:()=>void }) {
  return (
    <div style={{ position:"fixed", bottom:60, right:16, width:240, background:C.surface,
      border:`1px solid ${detail.color}66`, borderLeft:`4px solid ${detail.color}`,
      borderRadius:12, padding:"14px 16px", zIndex:100,
      boxShadow:`0 4px 20px #000A` }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:detail.color }}>{detail.label}</div>
          <div style={{ fontSize:10, color:C.muted }}>{detail.type}</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
      </div>
      {detail.info.map((line, i) => (
        <div key={i} style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>• {line}</div>
      ))}
      <button style={{ marginTop:10, background:detail.color+"22", color:detail.color,
        border:`1px solid ${detail.color}44`, borderRadius:6, padding:"6px 14px",
        fontSize:11, fontWeight:700, cursor:"pointer", width:"100%" }}>
        Gestisci Gate →
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TerminalMap() {
  const { state, dispatch } = useGame();
  const svgRef = useRef<SVGSVGElement>(null);

  const iata = state?.selectedAirportIata ?? state?.hubIata ?? "LHR";
  const ap: Airport | undefined = airports.find(a => a.iata === iata);

  const npcAtAirport = useMemo(() =>
    npcAirlines.filter(n => n.baseRoutes.some(rt => rt.startsWith(iata+"-") || rt.endsWith("-"+iata))),
    [iata]
  );

  const { gates, lounges, amenities, W, H, concourseLetters } = useMemo(() =>
    ap ? generateTerminal(ap, iata, npcAtAirport) : { gates:[], lounges:[], amenities:[], W:700, H:520, concourseLetters:"", gateRadius:8 },
    [ap, iata, npcAtAirport]
  );

  // Pan/zoom state
  const [vb, setVb] = useState({ x:0, y:0, w:W, h:H });
  const dragRef = useRef<{ startX:number; startY:number; vbX:number; vbY:number } | null>(null);

  const [layers, setLayers] = useState<Record<LayerId,boolean>>({
    gates:true, lounges:true, amenities:true, heatmap:false,
  });
  const [detail, setDetail] = useState<Detail | null>(null);

  const toggleLayer = (l: LayerId) => setLayers(prev => ({ ...prev, [l]: !prev[l] }));

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { startX:e.clientX, startY:e.clientY, vbX:vb.x, vbY:vb.y };
  };
  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const scale = vb.w / (svgRef.current?.clientWidth ?? W);
    const dx = (e.clientX - dragRef.current.startX) * scale;
    const dy = (e.clientY - dragRef.current.startY) * scale;
    setVb(prev => ({ ...prev, x:dragRef.current!.vbX - dx, y:dragRef.current!.vbY - dy }));
  }, [vb.w]);
  const onMouseUp = () => { dragRef.current = null; };

  // Native wheel listener (non-passive) to avoid React passive event restriction
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      setVb(prev => {
        const newW = Math.max(100, Math.min(W*2, prev.w * factor));
        const newH = newW * (H/W);
        return { x: prev.x + (prev.w - newW)/2, y: prev.y + (prev.h - newH)/2, w:newW, h:newH };
      });
    };
    svg.addEventListener("wheel", handler, { passive:false });
    return () => svg.removeEventListener("wheel", handler);
  }, [W, H]);

  const onGateClick = (g: Gate) => {
    setDetail({
      id: g.id, label: `Gate ${g.label}`, type: g.type === "player" ? "TUO GATE" : g.type === "npc" ? `${g.npcName ?? "NPC"} — COMPETITOR` : "GATE LIBERO",
      color: g.color,
      info: g.type === "player"
        ? ["Rotte attive da qui", `Concourse ${g.concourse}`, "Utilizzo: 78%", "Check-in F2"]
        : g.type === "npc"
          ? [`Operato da: ${g.npcName}`, `Concourse ${g.concourse}`, "Non disponibile per acquisto"]
          : [`Concourse ${g.concourse}`, "Disponibile per apertura rotta", `Slot prezzo: $${Math.round(ap?.slot_market_price ?? 0).toLocaleString() || "libero"}`],
    });
  };

  const onLoungeClick = (l: Lounge) => {
    setDetail({ id:l.id, label:l.label, type:"LOUNGE", color:l.color,
      info:["Capacità: 150 pax/giorno","Rev/pax: $45","NPS boost: +12","Occ: 78%"] });
  };

  if (!ap) return null;

  const playerGates = gates.filter(g => g.type === "player").length;
  const npcGateCount = gates.filter(g => g.type === "npc").length;
  const emptyGates   = gates.filter(g => g.type === "empty").length;

  const concourseLettersArr = concourseLetters.split("");

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", color:C.text, fontFamily:"'Inter',system-ui,sans-serif",
      display:"flex", flexDirection:"column" as const }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#0A1628", borderBottom:`1px solid ${C.border}`, padding:"10px 16px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-physical" })}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:"50%", width:30, height:30,
              cursor:"pointer", color:C.text, fontSize:15 }}>←</button>
          <span style={{ color:C.cyan, fontSize:10, fontWeight:700, letterSpacing:".18em" }}>AEROGRID</span>
          <span style={{ color:C.border }}>|</span>
          <span style={{ color:C.muted, fontSize:10 }}>MAPPA TERMINAL · {iata}</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
          <div>
            <span style={{ fontSize:18, fontWeight:900 }}>{ap.iata}</span>
            <span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>{ap.name} — Vista Terminal Interattiva</span>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
            {[["TUOI GATE",String(playerGates),C.cyan],["NPC",String(npcGateCount),C.amber],["LIBERI",String(emptyGates),C.green]].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:"center" as const }}>
                <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── LAYER CONTROLS ── */}
      <div style={{ background:"#0A1220", borderBottom:`1px solid ${C.border}`, padding:"6px 16px",
        display:"flex", gap:8, overflowX:"auto" as const, flexShrink:0 }}>
        {(Object.keys(layers) as LayerId[]).map(l => (
          <button key={l} onClick={() => toggleLayer(l)}
            style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${layers[l]?C.cyan:C.border}`,
              background:layers[l]?"#00C8FF15":C.surface2, color:layers[l]?C.cyan:C.muted,
              fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" as const }}>
            {l === "gates" ? "✈ Gate" : l === "lounges" ? "☕ Lounge" : l === "amenities" ? "🍴 Servizi" : "🔥 Heatmap"}
          </button>
        ))}
        <button onClick={() => setVb({ x:0, y:0, w:W, h:H })}
          style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${C.border}`,
            background:C.surface2, color:C.muted, fontSize:10, cursor:"pointer", marginLeft:"auto", whiteSpace:"nowrap" as const }}>
          ⟳ Reset view
        </button>
      </div>

      {/* ── LEGEND ── */}
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"5px 16px",
        display:"flex", gap:16, flexShrink:0 }}>
        {[["TUO GATE",C.cyan],["COMPETITOR",C.amber],["LIBERO",C.dim],["LOUNGE",C.amber+"BB"]].map(([l,c]) => (
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:c as string }}/>
            <span style={{ fontSize:9, color:C.textDim }}>{l}</span>
          </div>
        ))}
        <span style={{ fontSize:9, color:C.dim, marginLeft:"auto" }}>Scroll = zoom · Drag = pan · Click = dettaglio</span>
      </div>

      {/* ── SVG MAP ── */}
      <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
        <svg
          ref={svgRef}
          width="100%" height="100%"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          style={{ display:"block", cursor:"grab", userSelect:"none" as const,
            background:"linear-gradient(135deg,#060D19 0%,#0A1525 100%)" }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

          {/* ── GRID ── */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border2} strokeWidth="0.5" opacity="0.5"/>
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)"/>

          {/* ── HEATMAP (demand overlay) ── */}
          {layers.heatmap && gates.filter(g => g.type !== "empty").map(g => (
            <circle key={`hm-${g.id}`} cx={g.x} cy={g.y} r={35}
              fill={g.color} opacity="0.08"/>
          ))}

          {/* ── CONCOURSE BODIES ── */}
          {concourseLettersArr.map((letter, ci) => {
            const gatesInCon = gates.filter(g => g.concourse === letter);
            if (!gatesInCon.length) return null;
            const xs = gatesInCon.map(g => g.x);
            const ys = gatesInCon.map(g => g.y);
            const minX = Math.min(...xs) - 24;
            const maxX = Math.max(...xs) + 24;
            const minY = Math.min(...ys) - 20;
            const maxY = Math.max(...ys) + 20;
            return (
              <g key={`con-${letter}`}>
                <rect x={minX} y={minY} width={maxX-minX} height={maxY-minY}
                  rx="8" fill={C.surface+"66"} stroke={C.border} strokeWidth="1"/>
                <text x={(minX+maxX)/2} y={minY-6} textAnchor="middle"
                  fill={C.muted} fontSize="11" fontWeight="700">Concourse {letter}</text>
                {/* Taxiway connector */}
                {ci < concourseLettersArr.length - 1 && (
                  <line x1={maxX} y1={(minY+maxY)/2} x2={maxX+34} y2={(minY+maxY)/2}
                    stroke={C.border} strokeWidth="2" strokeDasharray="6,4"/>
                )}
              </g>
            );
          })}

          {/* ── MAIN TERMINAL BUILDING ── */}
          <rect x="0" y="0" width={W} height="35" rx="6" fill={C.surface} stroke={C.border} strokeWidth="1"/>
          <text x={W/2} y="22" textAnchor="middle" fill={C.cyan} fontSize="13" fontWeight="900" letterSpacing="0.14em">
            {ap.iata} — {ap.name.toUpperCase()}
          </text>

          {/* ── LOUNGES ── */}
          {layers.lounges && lounges.map(l => (
            <g key={l.id} onClick={() => onLoungeClick(l)} style={{ cursor:"pointer" }}>
              <rect x={l.x-22} y={l.y-12} width="44" height="22" rx="4"
                fill={l.color+"30"} stroke={l.color} strokeWidth="1.5"/>
              <text x={l.x} y={l.y+4} textAnchor="middle" fill={l.color} fontSize="8" fontWeight="700">
                ☕ LOUNGE
              </text>
            </g>
          ))}

          {/* ── GATES ── */}
          {layers.gates && gates.map(g => (
            <g key={g.id} onClick={() => onGateClick(g)} style={{ cursor:"pointer" }}>
              <rect x={g.x-10} y={g.y-10} width="20" height="20" rx="4"
                fill={g.type === "empty" ? C.surface2 : g.color+"30"}
                stroke={g.color}
                strokeWidth={g.type === "player" ? 2 : 1}
                style={{ filter:g.type==="player"?`drop-shadow(0 0 4px ${g.color})`:"none" }}/>
              <text x={g.x} y={g.y+4} textAnchor="middle"
                fill={g.type === "empty" ? C.dim : g.color}
                fontSize={g.label.length > 3 ? "6" : "7"} fontWeight="700">
                {g.label}
              </text>
              {/* player dot */}
              {g.type === "player" && (
                <circle cx={g.x+7} cy={g.y-7} r="3" fill={C.cyan}/>
              )}
            </g>
          ))}

          {/* ── AMENITIES ── */}
          {layers.amenities && amenities.map(a => (
            <g key={a.id}>
              <text x={a.x} y={a.y+4} textAnchor="middle" fontSize="10">{a.icon}</text>
            </g>
          ))}

          {/* ── RUNWAY ── */}
          <rect x="10" y={H-40} width={W-20} height="14" rx="2" fill={C.border2} stroke={C.dim} strokeWidth="1"/>
          <line x1="20" y1={H-33} x2={W-20} y2={H-33} stroke={C.amber} strokeWidth="1" strokeDasharray="20,12"/>
          <text x={W/2} y={H-26} textAnchor="middle" fill={C.muted} fontSize="8" fontWeight="600">
            RUNWAY — {ap.runwayLengthM}m
          </text>

        </svg>

        {/* NPC LEGEND (right side) */}
        {npcAtAirport.length > 0 && (
          <div style={{ position:"absolute", top:10, right:10, background:C.surface+"EE",
            border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", minWidth:160 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, marginBottom:8, letterSpacing:"0.1em" }}>
              NPC IN AEROPORTO
            </div>
            {npcAtAirport.slice(0, 6).map(npc => (
              <div key={npc.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:npc.color, flexShrink:0 }}/>
                <span style={{ fontSize:10, color:C.textDim, flex:1 }}>{npc.iataCode}</span>
                <span style={{ fontSize:9, color:C.muted }}>{npc.archetype.slice(0,3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DETAIL PANEL ── */}
      {detail && <DetailPanel detail={detail} onClose={() => setDetail(null)}/>}

      {/* ── FOOTER ── */}
      <div style={{ background:C.surface, borderTop:`1px solid ${C.border}`,
        padding:"8px 16px", display:"flex", gap:16, flexShrink:0 }}>
        <div style={{ display:"flex", gap:12, flex:1 }}>
          {[["CONCOURSE",concourseLetters.replace(/\B/g,"/"),C.textDim],
            ["TOTALE GATE",String(gates.length),C.cyan],
            ["SLOT/G",String(ap.slotCapacityPerDay),C.green],
          ].map(([l,v,c]) => (
            <div key={l}>
              <div style={{ fontSize:9, color:C.muted }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:700, color:c as string }}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-physical" })}
          style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
          ← Infrastruttura
        </button>
        <button onClick={() => dispatch({ type:"SET_VIEW", payload:"airport-conceptual" })}
          style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
          Analisi Mercato
        </button>
      </div>
    </div>
  );
}
