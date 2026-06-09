import { useState, useCallback } from "react";
import { airports } from "../data/airports";
import { cityById } from "../data/indexes";
import { projectToMap } from "../simulation/geography";
import { generateDailyODDemand } from "../simulation/demand";
import { LAND_PATHS } from "../data/worldOutlines";
import type { Route } from "../domain/types";

// ── Constants ────────────────────────────────────────────────────────────────
const VB_W = 1000;
const VB_H = 500;
const TODAY = new Date().toISOString().split("T")[0] ?? "2026-06-01";

// ── Types ────────────────────────────────────────────────────────────────────
interface Tooltip {
  x: number; y: number;
  iata: string; cityName: string; country: string; population: string;
  businessScore: number; tourismScore: number;
  demandBusiness?: number; demandLeisure?: number;
}

export interface WorldMapProps {
  routes?: Route[];
  selectedIatas?: string[];
  onAirportClick?: (iata: string) => void;
  demandOriginIata?: string;
  /** true = fill parent container (parent must be position:relative & sized) */
  fillParent?: boolean;
  /** fallback height when fillParent is false */
  height?: number | string;
}

// ── Pre-project airport positions ────────────────────────────────────────────
const airportPositions = airports.map(a => {
  const { x, y } = projectToMap(a.coordinates);
  return { iata: a.iata, x, y, size: a.airportSize };
});

function dotRadius(size: string) {
  if (size === "megaHub") return 5.5;
  if (size === "large")   return 4;
  if (size === "medium")  return 3;
  return 2.5;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function WorldMap({
  routes = [],
  selectedIatas = [],
  onAirportClick,
  demandOriginIata,
  fillParent = false,
  height = 280,
}: WorldMapProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const handleEnter = useCallback((iata: string, svgX: number, svgY: number) => {
    const airport = airports.find(a => a.iata === iata);
    if (!airport) return;
    const city = cityById.get(airport.cityId);

    let demandBusiness: number | undefined;
    let demandLeisure: number | undefined;

    if (demandOriginIata && demandOriginIata !== iata) {
      const origin = airports.find(a => a.iata === demandOriginIata);
      if (origin) {
        try {
          const d = generateDailyODDemand(TODAY, origin, airport);
          demandBusiness = Math.round(d.business);
          demandLeisure  = Math.round(d.leisure);
        } catch { /* ignore */ }
      }
    }

    setTooltip({
      x: svgX, y: svgY, iata,
      cityName: city?.name ?? iata,
      country: airport.country,
      population: city ? (city.population / 1_000_000).toFixed(1) + "M" : "—",
      businessScore: city?.businessScore ?? 0,
      tourismScore:  city?.tourismScore  ?? 0,
      demandBusiness, demandLeisure,
    });
  }, [demandOriginIata]);

  const handleLeave = useCallback(() => setTooltip(null), []);

  // Route lines (active routes)
  const routeLines = routes
    .filter(r => r.status === "active")
    .flatMap(r => {
      const o = airportPositions.find(a => a.iata === r.originIata);
      const d = airportPositions.find(a => a.iata === r.destinationIata);
      if (!o || !d) return [];
      return [{ id: r.id, x1: o.x, y1: o.y, x2: d.x, y2: d.y }];
    });

  // Dashed line for the route being planned
  const selLine = selectedIatas.length >= 2
    ? (() => {
        const a = airportPositions.find(p => p.iata === selectedIatas[0]);
        const b = airportPositions.find(p => p.iata === selectedIatas[1]);
        return a && b ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null;
      })()
    : null;

  function dotFill(iata: string) {
    if (selectedIatas[0] === iata) return "#38bdf8";
    if (selectedIatas[1] === iata) return "#22c55e";
    if (selectedIatas.includes(iata)) return "#38bdf8";
    if (routes.some(r => r.originIata === iata || r.destinationIata === iata)) return "#f59e0b";
    return "#4a7fa5";
  }

  const containerStyle: React.CSSProperties = fillParent
    ? { position: "absolute", inset: 0, background: "#071020", overflow: "hidden" }
    : { position: "relative", background: "#071020", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden" };

  return (
    <div style={containerStyle}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ display: "block", width: "100%", height: fillParent ? "100%" : height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background */}
        <rect width={VB_W} height={VB_H} fill="#071828" />

        {/* Latitude / longitude grid */}
        {[-60,-30,0,30,60].map(lat => {
          const y = (90 - lat) / 180 * VB_H;
          return <line key={lat} x1={0} y1={y} x2={VB_W} y2={y}
            stroke={lat === 0 ? "#0e2a42" : "#0b2035"} strokeWidth={lat === 0 ? 1.2 : 0.6} />;
        })}
        {[-120,-60,0,60,120].map(lon => {
          const x = (lon + 180) / 360 * VB_W;
          return <line key={lon} x1={x} y1={0} x2={x} y2={VB_H} stroke="#0b2035" strokeWidth={0.6} />;
        })}

        {/* Land masses */}
        {LAND_PATHS.map((d, i) => (
          <path key={i} d={d} fill="#162c1e" stroke="#1e3d28" strokeWidth={0.8} />
        ))}

        {/* Active route lines */}
        {routeLines.map(l => (
          <line key={l.id}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="7 4"
          />
        ))}

        {/* Planner preview line */}
        {selLine && (
          <line x1={selLine.x1} y1={selLine.y1} x2={selLine.x2} y2={selLine.y2}
            stroke="#38bdf8" strokeWidth={2} strokeOpacity={0.9} strokeDasharray="9 5"
          />
        )}

        {/* Airport dots */}
        {airportPositions.map(ap => {
          const r = dotRadius(ap.size);
          const fill = dotFill(ap.iata);
          const selected = selectedIatas.includes(ap.iata);
          return (
            <g key={ap.iata}
              style={{ cursor: onAirportClick ? "pointer" : "default" }}
              onClick={() => onAirportClick?.(ap.iata)}
              onMouseEnter={() => handleEnter(ap.iata, ap.x, ap.y)}
              onMouseLeave={handleLeave}
            >
              {selected && <circle cx={ap.x} cy={ap.y} r={r + 5} fill="none" stroke={fill} strokeWidth={1.5} strokeOpacity={0.4} />}
              <circle cx={ap.x} cy={ap.y} r={r} fill={fill} opacity={selected ? 1 : 0.85} />
            </g>
          );
        })}

        {/* IATA labels on selected airports */}
        {selectedIatas.map(iata => {
          const ap = airportPositions.find(a => a.iata === iata);
          if (!ap) return null;
          const labelY = ap.y > VB_H - 22 ? ap.y - 9 : ap.y + 13;
          return (
            <text key={iata} x={ap.x} y={labelY} textAnchor="middle"
              fontSize={9} fill="#38bdf8" fontWeight="bold" fontFamily="monospace">
              {iata}
            </text>
          );
        })}
      </svg>

      {/* HTML tooltip — easier to style than SVG foreignObject */}
      {tooltip && <TooltipBox tooltip={tooltip} />}

      {/* Legend */}
      <div style={legendStyle}>
        <LegendDot color="#4a7fa5" label="Aeroporto" />
        <LegendDot color="#f59e0b" label="Rotta attiva" />
        <LegendDot color="#38bdf8" label="Origine" />
        <LegendDot color="#22c55e" label="Destinazione" />
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function TooltipBox({ tooltip }: { tooltip: Tooltip }) {
  return (
    <div style={{
      position: "absolute",
      left: `calc(${(tooltip.x / VB_W) * 100}% + 10px)`,
      top:  `calc(${(tooltip.y / VB_H) * 100}% + 6px)`,
      transform: tooltip.x / VB_W > 0.65 ? "translateX(-100%) translateX(-20px)" : "none",
      background: "rgba(7,16,32,0.95)",
      border: "1px solid rgba(56,189,248,0.3)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 11,
      color: "#e8f0f8",
      pointerEvents: "none",
      zIndex: 30,
      minWidth: 158,
      boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 3 }}>
        {tooltip.iata} — {tooltip.cityName}
      </div>
      <div style={{ color: "#5a82a8", fontSize: 10, marginBottom: 6 }}>
        {tooltip.country} · {tooltip.population}
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: tooltip.demandBusiness !== undefined ? 6 : 0 }}>
        <TipStat label="Business" value={(tooltip.businessScore * 100).toFixed(0) + "%"} color="#f59e0b" />
        <TipStat label="Turismo"  value={(tooltip.tourismScore  * 100).toFixed(0) + "%"} color="#22c55e" />
      </div>
      {(tooltip.demandBusiness !== undefined || tooltip.demandLeisure !== undefined) && (
        <div style={{ display: "flex", gap: 14, paddingTop: 6, borderTop: "1px solid #0e2035" }}>
          {tooltip.demandBusiness !== undefined && (
            <TipStat label="Dom. Business/g" value={String(tooltip.demandBusiness)} color="#f59e0b" />
          )}
          {tooltip.demandLeisure !== undefined && (
            <TipStat label="Dom. Leisure/g" value={String(tooltip.demandLeisure)} color="#38bdf8" />
          )}
        </div>
      )}
    </div>
  );
}

function TipStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9, color: "#5a82a8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#3a5a7a" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </div>
  );
}

const legendStyle: React.CSSProperties = {
  position: "absolute", bottom: 6, left: 8,
  display: "flex", gap: 10, alignItems: "center",
};
