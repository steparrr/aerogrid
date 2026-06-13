import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useGame } from "../game/gameContext";
import { airports } from "../data/airports";
import type { FutureRoute } from "../domain/types";

// Fix Leaflet default icon paths broken by bundlers
// @ts-expect-error Leaflet internal
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const C = {
  cyan: "#00C8FF",
  amber: "#F59E0B",
  green: "#34D399",
  muted: "#64748B",
  text: "#E2E8F0",
  surface: "#0F1829",
  border: "#1E2D45",
};

// Great-circle interpolation (n points)
function greatCircle(lat1: number, lng1: number, lat2: number, lng2: number, n = 60): [number, number][] {
  const toR = (d: number) => d * Math.PI / 180;
  const toD = (r: number) => r * 180 / Math.PI;
  const φ1 = toR(lat1), λ1 = toR(lng1), φ2 = toR(lat2), λ2 = toR(lng2);
  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const d = 2 * Math.asin(Math.sqrt(
      Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
    ));
    if (d === 0) { points.push([lat1, lng1]); continue; }
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push([toD(Math.atan2(z, Math.sqrt(x * x + y * y))), toD(Math.atan2(y, x))]);
  }
  return points;
}

function circleMarker(lat: number, lng: number, color: string, radius: number, title: string): L.CircleMarker {
  return L.circleMarker([lat, lng], {
    radius,
    fillColor: color,
    color: "#071020",
    weight: 0.8,
    fillOpacity: 0.85,
  }).bindTooltip(title, { direction: "top", offset: [0, -radius], className: "ag-tip" });
}

interface PanelData {
  iata: string; name: string; country: string; tier: string;
  businessScore: number; touristScore: number;
  lat: number; lng: number;
}

export function WorldMapScreen() {
  const { state, dispatch } = useGame();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [showFuture, setShowFuture] = useState(true);

  if (!state) return null;

  const futureRoutes: FutureRoute[] = state.futureRoutes ?? [];

  // ── Init map once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30, 15],
      zoom: 3,
      minZoom: 2,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    // CartoDB Dark Matter — free, no API key
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '© <a href="https://carto.com" style="color:#64748B">CARTO</a>',
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    map.on("click", () => setPanel(null));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Redraw layers when state changes ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layers
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];

    const add = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); return l; };

    // Active routes (great-circle arcs, cyan)
    state.routes
      .filter(r => r.status === "active")
      .forEach(r => {
        const o = airports.find(a => a.iata === r.originIata);
        const d = airports.find(a => a.iata === r.destinationIata);
        if (!o || !d) return;
        const pts = greatCircle(o.coordinates.lat, o.coordinates.lon, d.coordinates.lat, d.coordinates.lon);
        // Glow
        add(L.polyline(pts, { color: C.cyan, weight: 6, opacity: 0.1, interactive: false }));
        // Line
        const line = add(L.polyline(pts, { color: C.cyan, weight: 2, opacity: 0.9 }));
        (line as L.Polyline).bindTooltip(`${r.originIata} → ${r.destinationIata}`, { sticky: true, className: "ag-tip" });
      });

    // Future routes (dashed amber) — only if toggle on
    if (showFuture) {
      futureRoutes.forEach(fr => {
        const o = airports.find(a => a.iata === fr.originIata);
        const d = airports.find(a => a.iata === fr.destinationIata);
        if (!o || !d) return;
        const pts = greatCircle(o.coordinates.lat, o.coordinates.lon, d.coordinates.lat, d.coordinates.lon);
        add(L.polyline(pts, { color: C.amber, weight: 1.5, opacity: 0.65, dashArray: "7 5" }))
          .bindTooltip(`★ Futura: ${fr.originIata} → ${fr.destinationIata}`, { sticky: true, className: "ag-tip" });
      });
    }

    // Airport dots
    airports.forEach(ap => {
      const isHub = ap.iata === state.hubIata;
      const isSel = ap.iata === state.selectedAirportIata;
      const isOnRoute = state.routes.some(r => r.originIata === ap.iata || r.destinationIata === ap.iata);
      const isFuture = futureRoutes.some(r => r.originIata === ap.iata || r.destinationIata === ap.iata);

      const color = isHub || isSel ? C.cyan : isOnRoute ? C.green : isFuture ? C.amber : C.muted;
      const radius = isHub ? 9 : ap.tier === "A" ? 7 : ap.tier === "B" ? 5 : 3.5;

      const m = add(circleMarker(ap.coordinates.lat, ap.coordinates.lon, color, radius, `${ap.iata} · ${ap.name}`));
      m.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        setPanel({
          iata: ap.iata, name: ap.name, country: ap.country, tier: ap.tier ?? "C",
          businessScore: ap.businessGatewayScore, touristScore: ap.touristGatewayScore,
          lat: ap.coordinates.lat, lng: ap.coordinates.lon,
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.routes, state.hubIata, state.selectedAirportIata, futureRoutes.length, showFuture]);

  const TIER_COLOR: Record<string, string> = { A: C.cyan, B: C.green, C: C.muted };

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.back} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })}>←</button>
        <div style={{ flex: 1 }}>
          <div style={s.title}>Mappa Mondiale</div>
          <div style={s.sub}>Tocca un aeroporto per aprire la scheda</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={{ ...s.toggle, color: showFuture ? C.amber : C.muted, borderColor: showFuture ? C.amber : C.border }}
            onClick={() => setShowFuture(f => !f)}
          >
            ★ Rotte future ({futureRoutes.length})
          </button>
          <div style={s.hubBadge}>{state.hubIata}</div>
        </div>
      </header>

      {/* Map */}
      <div style={s.mapWrap}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* Side panel */}
        {panel && (
          <div style={s.panel}>
            <div style={s.panelTop}>
              <div>
                <span style={{ ...s.panelIata, color: TIER_COLOR[panel.tier] }}>{panel.iata}</span>
                <span style={s.panelTier}>Tier {panel.tier}</span>
              </div>
              <button style={s.closeBtn} onClick={() => setPanel(null)}>✕</button>
            </div>
            <div style={s.panelName}>{panel.name}</div>
            <div style={s.panelCountry}>{panel.country} · {panel.lat.toFixed(2)}, {panel.lng.toFixed(2)}</div>
            <div style={s.statRow}>
              <div style={s.stat}>
                <div style={s.statLabel}>Business</div>
                <div style={{ ...s.statVal, color: C.amber }}>{(panel.businessScore * 100).toFixed(0)}%</div>
              </div>
              <div style={s.stat}>
                <div style={s.statLabel}>Turismo</div>
                <div style={{ ...s.statVal, color: C.green }}>{(panel.touristScore * 100).toFixed(0)}%</div>
              </div>
            </div>
            <div style={s.panelBtns}>
              <button style={s.panelBtn} onClick={() => {
                dispatch({ type: "SELECT_AIRPORT", payload: panel.iata });
                dispatch({ type: "SET_VIEW", payload: "airport-conceptual" });
              }}>Scheda aeroporto →</button>
              <button style={{ ...s.panelBtn, background: "#F59E0B18", color: C.amber, borderColor: C.amber }}
                onClick={() => {
                  dispatch({ type: "SELECT_AIRPORT", payload: panel.iata });
                  dispatch({ type: "SET_VIEW", payload: "route-study" });
                }}>Studio rotta →</button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <span style={s.legItem}><span style={{ ...s.dot, background: C.cyan }} />Hub / selezionato</span>
        <span style={s.legItem}><span style={{ ...s.dot, background: C.green }} />Rotta attiva</span>
        <span style={s.legItem}><span style={{ ...s.dot, background: C.amber }} />★ Rotta futura</span>
        <span style={s.legItem}><span style={{ ...s.dot, background: C.muted }} />Aeroporto</span>
      </div>

      <style>{`
        .ag-tip { background: #07101fff; border: 1px solid #1E2D45; color: #E2E8F0;
                  font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px; }
        .leaflet-tooltip.ag-tip::before { display: none; }
        .leaflet-control-attribution { background: rgba(7,16,32,0.7) !important; color: #64748B !important; }
        .leaflet-control-attribution a { color: #64748B !important; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { height: "100dvh", display: "flex", flexDirection: "column", background: "#071020", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "0 16px", height: 56, flexShrink: 0,
    background: "#0d1b2a", borderBottom: "1px solid #0e2035", zIndex: 500,
  },
  back: {
    background: "none", border: "1px solid #1e3a55", color: "#c8dff0",
    borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: 700, color: "#c8dff0" },
  sub: { fontSize: 10, color: "#3a5a7a", marginTop: 1 },
  toggle: {
    background: "none", border: "1px solid", borderRadius: 6,
    padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
  },
  hubBadge: {
    background: "#00C8FF18", color: C.cyan, border: `1px solid ${C.cyan}`,
    borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 10px",
  },
  mapWrap: { flex: 1, position: "relative", overflow: "hidden" },
  panel: {
    position: "absolute", top: 14, right: 14, zIndex: 1000, width: 240,
    background: "rgba(7,16,32,0.97)", border: "1px solid #1E2D45",
    borderRadius: 12, padding: "14px", backdropFilter: "blur(12px)",
    display: "flex", flexDirection: "column", gap: 8,
  },
  panelTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  panelIata: { fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginRight: 6 },
  panelTier: {
    fontSize: 9, fontWeight: 700, border: "1px solid #1e3a55",
    borderRadius: 4, padding: "1px 6px", color: C.muted,
  },
  closeBtn: { background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 },
  panelName: { fontSize: 12, color: "#c8dff0", fontWeight: 600 },
  panelCountry: { fontSize: 10, color: C.muted },
  statRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  stat: { background: "#07101f", borderRadius: 6, padding: "6px 8px" },
  statLabel: { fontSize: 9, color: C.muted, marginBottom: 2 },
  statVal: { fontSize: 15, fontWeight: 800 },
  panelBtns: { display: "flex", flexDirection: "column", gap: 6 },
  panelBtn: {
    background: "#00C8FF18", color: C.cyan, border: `1px solid ${C.cyan}`,
    borderRadius: 7, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer",
  },
  legend: {
    display: "flex", gap: 14, alignItems: "center", padding: "6px 16px", flexShrink: 0,
    background: "rgba(7,16,32,0.95)", borderTop: "1px solid #0e2035",
  },
  legItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#5a82a8" },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
};
