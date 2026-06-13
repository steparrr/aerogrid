import { useState, useMemo } from "react";
import type { NewGameInput, GameState } from "../domain/types";
import { initGame } from "../game/initGame";
import { airports } from "../data/airports";

interface Props {
  onStart: (state: GameState) => void;
}

const TIER_COLOR: Record<string, string> = {
  A: "#00C8FF",
  B: "#34D399",
  C: "#94A3B8",
};

const TIER_LABEL: Record<string, string> = {
  A: "Hub Principale",
  B: "Hub Secondario",
  C: "Aeroporto Regionale",
};

// Pre-filter only playable airports (all 465 are playable in geodata)
const ALL_AIRPORTS = airports;

export function NewGameScreen({ onStart }: Props) {
  const [name, setName] = useState("");
  const [hub, setHub] = useState<string>("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ALL_AIRPORTS.slice(0, 80);
    return ALL_AIRPORTS.filter(
      a =>
        a.iata.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.cityId.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [search]);

  const selectedAirport = hub ? ALL_AIRPORTS.find(a => a.iata === hub) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Inserisci il nome della compagnia."); return; }
    if (!hub) { setError("Scegli un hub di partenza."); return; }
    setError("");
    const state = initGame({ airlineName: name.trim(), hubIata: hub } as NewGameInput);
    onStart(state);
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>✈</div>
        <h1 style={s.title}>AeroGrid</h1>
        <p style={s.subtitle}>Gestionale realistico di compagnie aeree</p>

        <form onSubmit={handleSubmit} style={s.form}>
          {/* Airline name */}
          <div style={s.field}>
            <label style={s.label}>Nome compagnia</label>
            <input
              style={s.input}
              type="text"
              placeholder="es. Azzurra Airlines"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </div>

          {/* Hub selector */}
          <div style={s.field}>
            <label style={s.label}>Hub di partenza</label>

            {/* Search bar */}
            <input
              style={s.input}
              type="text"
              placeholder="Cerca per IATA, città, paese…"
              value={search}
              onChange={e => { setSearch(e.target.value); setHub(""); }}
            />

            {/* Selected hub display */}
            {selectedAirport && (
              <div style={s.selectedHub}>
                <span style={{ ...s.selectedIata, color: TIER_COLOR[selectedAirport.tier ?? "C"] }}>
                  {selectedAirport.iata}
                </span>
                <div style={s.selectedInfo}>
                  <span style={s.selectedName}>{selectedAirport.name}</span>
                  <span style={s.selectedTier}>{TIER_LABEL[selectedAirport.tier ?? "C"]} · {selectedAirport.country}</span>
                </div>
                <button type="button" style={s.clearBtn} onClick={() => { setHub(""); setSearch(""); }}>✕</button>
              </div>
            )}

            {/* Airport list */}
            {!selectedAirport && (
              <div style={s.airportList}>
                {filtered.length === 0 && (
                  <div style={s.noResults}>Nessun aeroporto trovato</div>
                )}
                {filtered.map(ap => (
                  <button
                    key={ap.iata}
                    type="button"
                    style={{ ...s.airportRow, ...(hub === ap.iata ? s.airportRowActive : {}) }}
                    onClick={() => { setHub(ap.iata); setSearch(""); }}
                  >
                    <span style={{ ...s.rowIata, color: TIER_COLOR[ap.tier ?? "C"] }}>
                      {ap.iata}
                    </span>
                    <span style={s.rowName}>{ap.name}</span>
                    <span style={s.rowCountry}>{ap.country}</span>
                    <span style={{ ...s.rowTierBadge, color: TIER_COLOR[ap.tier ?? "C"], borderColor: TIER_COLOR[ap.tier ?? "C"] + "44" }}>
                      {ap.tier ?? "C"}
                    </span>
                  </button>
                ))}
                {!search.trim() && ALL_AIRPORTS.length > 80 && (
                  <div style={s.hint}>Cerca per filtrare tutti i {ALL_AIRPORTS.length} aeroporti</div>
                )}
              </div>
            )}
          </div>

          {/* Tier legend */}
          <div style={s.tierLegend}>
            {Object.entries(TIER_COLOR).map(([tier, color]) => (
              <span key={tier} style={s.tierItem}>
                <span style={{ ...s.tierDot, background: color }} />
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>
                  Tier {tier} — {TIER_LABEL[tier]}
                </span>
              </span>
            ))}
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...s.startBtn, opacity: !name.trim() || !hub ? 0.5 : 1 }}
          >
            Inizia partita
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "var(--space-4)",
    paddingTop: "clamp(1rem, 4vh, 3rem)",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "var(--color-surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--color-border)",
    padding: "var(--space-6)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  logo: { fontSize: "2rem", lineHeight: 1 },
  title: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 700,
    color: "var(--color-accent)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  subtitle: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" },
  form: { width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" },
  field: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
  label: { fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  input: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    padding: "var(--space-3) var(--space-4)",
    fontSize: "var(--font-size-base)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  selectedHub: {
    display: "flex", alignItems: "center", gap: "var(--space-3)",
    background: "var(--color-accent-dim)", border: "1px solid var(--color-accent)",
    borderRadius: "var(--radius-md)", padding: "var(--space-3)",
  },
  selectedIata: { fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.04em", flexShrink: 0 },
  selectedInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  selectedName: { fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text)" },
  selectedTier: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" },
  clearBtn: { background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 14, padding: 4 },
  airportList: {
    maxHeight: 280,
    overflowY: "auto" as const,
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
  },
  airportRow: {
    display: "flex", alignItems: "center", gap: "var(--space-2)",
    padding: "8px var(--space-3)", background: "none", border: "none",
    borderBottom: "1px solid var(--color-border)", cursor: "pointer",
    textAlign: "left" as const, width: "100%",
  },
  airportRowActive: { background: "var(--color-accent-dim)" },
  rowIata: { width: 38, fontWeight: 700, fontSize: "var(--font-size-sm)", flexShrink: 0 },
  rowName: { flex: 1, fontSize: "var(--font-size-xs)", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  rowCountry: { fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", flexShrink: 0, minWidth: 28 },
  rowTierBadge: { fontSize: 9, fontWeight: 700, border: "1px solid", borderRadius: 4, padding: "1px 5px", flexShrink: 0 },
  noResults: { padding: "var(--space-4)", textAlign: "center" as const, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" },
  hint: { padding: "8px var(--space-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic", textAlign: "center" as const },
  tierLegend: { display: "flex", gap: "var(--space-3)", flexWrap: "wrap" as const },
  tierItem: { display: "flex", alignItems: "center", gap: 4 },
  tierDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  error: { fontSize: "var(--font-size-sm)", color: "var(--color-danger)", margin: 0 },
  startBtn: {
    background: "var(--color-accent)", color: "#0b1622", fontWeight: 700,
    fontSize: "var(--font-size-base)", padding: "var(--space-4)",
    borderRadius: "var(--radius-md)", width: "100%", cursor: "pointer", border: "none",
  },
};
