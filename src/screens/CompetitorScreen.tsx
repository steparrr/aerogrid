import { useGame } from "../game/gameContext";
import { npcAirlines } from "../data/npcAirlines";
import type { CompetitorArchetype } from "../domain/types";

const archetypeLabel: Record<CompetitorArchetype, string> = {
  LEGACY_DOMINANT: "Legacy Dominante",
  LEGACY_WEAK: "Legacy Debole",
  LCC: "Low Cost",
  ULCC: "Ultra Low Cost",
  REGIONAL: "Regionale",
  GULF_CARRIER: "Vettore del Golfo",
};

const archetypeColor: Record<CompetitorArchetype, string> = {
  LEGACY_DOMINANT: "#00C8FF",
  LEGACY_WEAK: "#64748B",
  LCC: "#F59E0B",
  ULCC: "#EF4444",
  REGIONAL: "#34D399",
  GULF_CARRIER: "#A855F7",
};

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    background: "#080E1A",
    color: "#E2E8F0",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid #1E2D45",
    background: "#0A1628",
  },
  backBtn: {
    background: "none",
    border: "1px solid #1E2D45",
    borderRadius: 8,
    color: "#94A3B8",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 14,
  },
  title: { fontSize: 18, fontWeight: 700, color: "#E2E8F0" },
  count: { fontSize: 13, color: "#64748B", marginLeft: "auto" },
  body: { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  card: {
    background: "#0F1829",
    border: "1px solid #1E2D45",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: { display: "flex", alignItems: "center", gap: 10 },
  colorDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  airline: { fontSize: 15, fontWeight: 700, flex: 1 },
  iata: { fontSize: 12, color: "#64748B", fontFamily: "monospace" },
  archBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 6,
    letterSpacing: "0.5px",
  },
  stats: { display: "flex", gap: 16, flexWrap: "wrap" },
  stat: { display: "flex", flexDirection: "column", gap: 2 },
  statLabel: { fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" },
  statValue: { fontSize: 13, fontWeight: 600, color: "#E2E8F0" },
  hubBadge: {
    fontSize: 11,
    fontFamily: "monospace",
    background: "#1E2D45",
    borderRadius: 6,
    padding: "2px 8px",
    color: "#00C8FF",
  },
  repBar: { height: 4, borderRadius: 2, background: "#1E2D45", flex: 1 },
  repFill: { height: "100%", borderRadius: 2 },
};

export function CompetitorScreen() {
  const { dispatch } = useGame();

  const sorted = [...npcAirlines].sort((a, b) => b.paxMillions - a.paxMillions);

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => dispatch({ type: "SET_VIEW", payload: "operations" })}>
          ← Indietro
        </button>
        <span style={s.title}>Competitor</span>
        <span style={s.count}>{npcAirlines.length} compagnie</span>
      </div>
      <div style={s.body}>
        {sorted.map((npc) => {
          const repPct = Math.round(npc.reputation * 100);
          const repColor = npc.reputation >= 0.85 ? "#34D399" : npc.reputation >= 0.70 ? "#F59E0B" : "#EF4444";
          return (
            <div key={npc.id} style={{ ...s.card, borderLeft: `3px solid ${npc.color}` }}>
              <div style={s.row}>
                <div style={{ ...s.colorDot, background: npc.color }} />
                <span style={s.airline}>{npc.name}</span>
                <span style={s.iata}>{npc.iataCode}</span>
                <span
                  style={{
                    ...s.archBadge,
                    background: archetypeColor[npc.archetype] + "22",
                    color: archetypeColor[npc.archetype],
                  }}
                >
                  {archetypeLabel[npc.archetype]}
                </span>
              </div>
              <div style={s.stats}>
                <div style={s.stat}>
                  <span style={s.statLabel}>Hub</span>
                  <span style={s.hubBadge}>{npc.hubIata}</span>
                </div>
                <div style={s.stat}>
                  <span style={s.statLabel}>Flotta</span>
                  <span style={s.statValue}>{npc.fleetSize} aerei</span>
                </div>
                <div style={s.stat}>
                  <span style={s.statLabel}>Passeggeri</span>
                  <span style={s.statValue}>{npc.paxMillions}M pax/anno</span>
                </div>
                <div style={s.stat}>
                  <span style={s.statLabel}>Ricavi</span>
                  <span style={s.statValue}>${npc.revenueB}B</span>
                </div>
                <div style={s.stat}>
                  <span style={s.statLabel}>Rotte</span>
                  <span style={s.statValue}>{npc.baseRoutes.length}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#64748B", width: 72 }}>Reputazione</span>
                <div style={s.repBar}>
                  <div style={{ ...s.repFill, width: `${repPct}%`, background: repColor }} />
                </div>
                <span style={{ fontSize: 12, color: repColor, fontWeight: 700, width: 32 }}>{repPct}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#64748B", width: 72 }}>Prezzo</span>
                <span style={{ fontSize: 12, color: npc.priceBias >= 1.1 ? "#A855F7" : npc.priceBias <= 0.7 ? "#EF4444" : "#94A3B8" }}>
                  {npc.priceBias >= 1.2 ? "Premium" : npc.priceBias >= 1.0 ? "Normale" : npc.priceBias >= 0.75 ? "Low Cost" : "Ultra Low Cost"}
                  {" "}({npc.priceBias >= 1 ? "+" : ""}{Math.round((npc.priceBias - 1) * 100)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
