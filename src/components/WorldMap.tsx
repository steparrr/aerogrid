import { useState, useCallback } from "react";
import { airports } from "../data/airports";
import { cityById } from "../data/indexes";
import { projectToMap } from "../simulation/geography";
import { generateDailyODDemand } from "../simulation/demand";
import type { Route } from "../domain/types";

// Viewbox interna: 1000 x 500 (equirettangolare)
const VB_W = 1000;
const VB_H = 500;

interface Tooltip {
  x: number;
  y: number;
  iata: string;
  cityName: string;
  country: string;
  population: string;
  businessScore: number;
  tourismScore: number;
  demandBusiness?: number;
  demandLeisure?: number;
}

interface Props {
  /** Rotte da disegnare come linee */
  routes?: Route[];
  /** IATA selezionati (origine, destinazione) — evidenziati */
  selectedIatas?: string[];
  /** Callback click su aeroporto */
  onAirportClick?: (iata: string) => void;
  /** IATA di riferimento per calcolo domanda (es. origine già scelta) */
  demandOriginIata?: string;
  /** Altezza CSS del contenitore */
  height?: number | string;
}

const TODAY = new Date().toISOString().split("T")[0] ?? "2026-06-01";

export function WorldMap({ routes = [], selectedIatas = [], onAirportClick, demandOriginIata, height = 280 }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const handleMouseEnter = useCallback((iata: string, svgX: number, svgY: number) => {
    const airport = airports.find(a => a.iata === iata);
    if (!airport) return;
    const city = cityById.get(airport.cityId);

    let demandBusiness: number | undefined;
    let demandLeisure: number | undefined;

    if (demandOriginIata && demandOriginIata !== iata) {
      const originAirport = airports.find(a => a.iata === demandOriginIata);
      if (originAirport && city) {
        try {
          const demand = generateDailyODDemand(TODAY, originAirport, airport);
          demandBusiness = Math.round(demand.business);
          demandLeisure  = Math.round(demand.leisure);
        } catch {
          // ignora errori di calcolo
        }
      }
    }

    setTooltip({
      x: svgX,
      y: svgY,
      iata,
      cityName: city?.name ?? iata,
      country: airport.country,
      population: city ? (city.population / 1_000_000).toFixed(1) + "M" : "—",
      businessScore: city?.businessScore ?? 0,
      tourismScore: city?.tourismScore ?? 0,
      demandBusiness,
      demandLeisure,
    });
  }, [demandOriginIata]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Proietta aeroporti
  const airportPositions = airports.map(a => {
    const { x, y } = projectToMap(a.coordinates);
    return { iata: a.iata, x, y, size: a.airportSize };
  });

  // Costruisce linee per le rotte
  const routeLines = routes
    .filter(r => r.status === "active")
    .map(r => {
      const orig = airportPositions.find(a => a.iata === r.originIata);
      const dest = airportPositions.find(a => a.iata === r.destinationIata);
      if (!orig || !dest) return null;
      return { id: r.id, x1: orig.x, y1: orig.y, x2: dest.x, y2: dest.y };
    })
    .filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number }[];

  // Linea tra i due selezionati (planner)
  const selLine = selectedIatas.length === 2
    ? (() => {
        const a = airportPositions.find(p => p.iata === selectedIatas[0]);
        const b = airportPositions.find(p => p.iata === selectedIatas[1]);
        return a && b ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null;
      })()
    : null;

  function dotRadius(size: string) {
    if (size === "megaHub") return 5;
    if (size === "large")   return 4;
    if (size === "medium")  return 3;
    return 2.5;
  }

  function dotColor(iata: string) {
    if (selectedIatas[0] === iata) return "#38bdf8";
    if (selectedIatas[1] === iata) return "#22c55e";
    if (selectedIatas.includes(iata)) return "#38bdf8";
    if (routes.some(r => r.originIata === iata || r.destinationIata === iata)) return "#f59e0b";
    return "#3d5a7a";
  }

  return (
    <div style={{ position: "relative", background: "#0b1622", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ display: "block", width: "100%", height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Griglia leggera */}
        <defs>
          <pattern id="grid" width="100" height="50" patternUnits="userSpaceOnUse">
            <path d={`M 100 0 L 0 0 0 50`} fill="none" stroke="#1c2d42" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={VB_W} height={VB_H} fill="#0b1622" />
        <rect width={VB_W} height={VB_H} fill="url(#grid)" />

        {/* Equatore e tropici */}
        {[0, 23.5, -23.5, 66.5, -66.5].map(lat => {
          const y = ((90 - lat) / 180) * VB_H;
          return (
            <line
              key={lat}
              x1={0} y1={y} x2={VB_W} y2={y}
              stroke={lat === 0 ? "#243650" : "#1c2d42"}
              strokeWidth={lat === 0 ? 1 : 0.5}
              strokeDasharray={lat === 0 ? "0" : "4 4"}
            />
          );
        })}

        {/* Meridiano centrale */}
        <line x1={VB_W / 2} y1={0} x2={VB_W / 2} y2={VB_H} stroke="#1c2d42" strokeWidth={0.5} />

        {/* Linee rotte attive */}
        {routeLines.map(l => (
          <line
            key={l.id}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            strokeDasharray="6 3"
          />
        ))}

        {/* Linea rotta in costruzione (planner) */}
        {selLine && (
          <line
            x1={selLine.x1} y1={selLine.y1} x2={selLine.x2} y2={selLine.y2}
            stroke="#38bdf8"
            strokeWidth={2}
            strokeOpacity={0.85}
            strokeDasharray="8 4"
          />
        )}

        {/* Aeroporti */}
        {airportPositions.map(ap => {
          const r = dotRadius(ap.size);
          const fill = dotColor(ap.iata);
          const isSelected = selectedIatas.includes(ap.iata);
          return (
            <g
              key={ap.iata}
              style={{ cursor: onAirportClick ? "pointer" : "default" }}
              onClick={() => onAirportClick?.(ap.iata)}
              onMouseEnter={() => handleMouseEnter(ap.iata, ap.x, ap.y)}
              onMouseLeave={handleMouseLeave}
            >
              {isSelected && (
                <circle cx={ap.x} cy={ap.y} r={r + 4} fill="none" stroke={fill} strokeWidth={1.5} strokeOpacity={0.4} />
              )}
              <circle cx={ap.x} cy={ap.y} r={r} fill={fill} opacity={isSelected ? 1 : 0.8} />
            </g>
          );
        })}

        {/* Label IATA sui selezionati */}
        {selectedIatas.map(iata => {
          const ap = airportPositions.find(a => a.iata === iata);
          if (!ap) return null;
          const labelY = ap.y > VB_H - 20 ? ap.y - 8 : ap.y + 12;
          return (
            <text
              key={iata}
              x={ap.x}
              y={labelY}
              textAnchor="middle"
              fontSize={8}
              fill="#38bdf8"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {iata}
            </text>
          );
        })}
      </svg>

      {/* Tooltip HTML (più facile da stilare dell'SVG foreignObject) */}
      {tooltip && (
        <TooltipBox tooltip={tooltip} svgW={VB_W} svgH={VB_H} />
      )}

      {/* Legenda */}
      <div style={{ position: "absolute", bottom: 6, left: 8, display: "flex", gap: 10, alignItems: "center" }}>
        <LegendDot color="#3d5a7a" label="Aeroporto" />
        <LegendDot color="#f59e0b" label="Con rotta" />
        <LegendDot color="#38bdf8" label="Origine" />
        <LegendDot color="#22c55e" label="Destinazione" />
      </div>
    </div>
  );
}

function TooltipBox({ tooltip, svgW, svgH }: { tooltip: Tooltip; svgW: number; svgH: number }) {
  // Posizionamento relativo alla percentuale SVG
  const leftPct = (tooltip.x / svgW) * 100;
  const topPct  = (tooltip.y / svgH) * 100;
  const alignRight = leftPct > 65;
  const alignBottom = topPct > 60;

  return (
    <div style={{
      position: "absolute",
      left: alignRight ? "auto" : `${leftPct}%`,
      right: alignRight ? `${100 - leftPct}%` : "auto",
      top: alignBottom ? "auto" : `${topPct}%`,
      bottom: alignBottom ? `${100 - topPct}%` : "auto",
      transform: "translate(8px, 8px)",
      background: "#132033",
      border: "1px solid rgba(56,189,248,0.3)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 11,
      color: "#e8f0f8",
      pointerEvents: "none",
      zIndex: 20,
      minWidth: 150,
      boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
        {tooltip.iata} — {tooltip.cityName}
      </div>
      <div style={{ color: "#7a9ab8", marginBottom: 6 }}>{tooltip.country} · {tooltip.population}</div>
      <div style={{ display: "flex", gap: 12 }}>
        <Metric label="Business" value={(tooltip.businessScore * 100).toFixed(0) + "%"} color="#f59e0b" />
        <Metric label="Turismo" value={(tooltip.tourismScore * 100).toFixed(0) + "%"} color="#22c55e" />
      </div>
      {(tooltip.demandBusiness !== undefined || tooltip.demandLeisure !== undefined) && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1c2d42", display: "flex", gap: 12 }}>
          {tooltip.demandBusiness !== undefined && (
            <Metric label="Dom. Business/g" value={String(tooltip.demandBusiness)} color="#f59e0b" />
          )}
          {tooltip.demandLeisure !== undefined && (
            <Metric label="Dom. Leisure/g" value={String(tooltip.demandLeisure)} color="#38bdf8" />
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9, color: "#7a9ab8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#3d5a7a" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </div>
  );
}
