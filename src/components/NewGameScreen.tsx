import { useState } from "react";
import type { NewGameInput } from "../domain/types";
import { initGame } from "../game/initGame";
import type { GameState } from "../domain/types";

interface Props {
  onStart: (state: GameState) => void;
}

const HUB_OPTIONS: {
  iata: NewGameInput["hubIata"];
  city: string;
  country: string;
  label: string;
}[] = [
  { iata: "FCO", city: "Roma",      country: "Italia",      label: "Hub europeo mediterraneo" },
  { iata: "LHR", city: "Londra",    country: "UK",          label: "Gateway atlantico" },
  { iata: "JFK", city: "New York",  country: "USA",         label: "Hub americano" },
  { iata: "DXB", city: "Dubai",     country: "UAE",         label: "Hub medio-orientale" },
  { iata: "SIN", city: "Singapore", country: "Singapore",   label: "Hub asiatico" },
  { iata: "GRU", city: "San Paolo", country: "Brasile",     label: "Hub sudamericano" },
];

export function NewGameScreen({ onStart }: Props) {
  const [name, setName] = useState("");
  const [hub, setHub] = useState<NewGameInput["hubIata"] | "">("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Inserisci il nome della compagnia."); return; }
    if (!hub) { setError("Scegli un hub di partenza."); return; }
    setError("");
    const state = initGame({ airlineName: name.trim(), hubIata: hub });
    onStart(state);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>✈</div>
        <h1 style={styles.title}>Aerogrid</h1>
        <p style={styles.subtitle}>Gestionale realistico di compagnie aeree</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nome compagnia</label>
            <input
              style={styles.input}
              type="text"
              placeholder="es. Azzurra Airlines"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Hub di partenza</label>
            <div style={styles.hubGrid}>
              {HUB_OPTIONS.map(h => (
                <button
                  key={h.iata}
                  type="button"
                  style={{
                    ...styles.hubBtn,
                    ...(hub === h.iata ? styles.hubBtnActive : {}),
                  }}
                  onClick={() => setHub(h.iata)}
                >
                  <span style={styles.hubIata}>{h.iata}</span>
                  <span style={styles.hubCity}>{h.city}</span>
                  <span style={styles.hubLabel}>{h.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{
              ...styles.startBtn,
              opacity: !name.trim() || !hub ? 0.5 : 1,
            }}
          >
            Inizia partita
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--space-4)",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "var(--color-surface)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--color-border)",
    padding: "var(--space-8) var(--space-6)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  logo: {
    fontSize: "2.5rem",
    lineHeight: 1,
  },
  title: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: "var(--font-weight-bold)" as React.CSSProperties["fontWeight"],
    color: "var(--color-accent)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  subtitle: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    marginBottom: "var(--space-4)",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  label: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  input: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    padding: "var(--space-3) var(--space-4)",
    fontSize: "var(--font-size-base)",
    outline: "none",
    width: "100%",
  },
  hubGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-2)",
  },
  hubBtn: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    padding: "var(--space-3)",
    textAlign: "left" as const,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    transition: "border-color var(--transition-fast)",
    cursor: "pointer",
  },
  hubBtnActive: {
    borderColor: "var(--color-accent)",
    background: "var(--color-accent-dim)",
  },
  hubIata: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 700,
    color: "var(--color-accent)",
    letterSpacing: "0.05em",
  },
  hubCity: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 500,
    color: "var(--color-text)",
  },
  hubLabel: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
  },
  error: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-danger)",
    margin: 0,
  },
  startBtn: {
    background: "var(--color-accent)",
    color: "#0b1622",
    fontWeight: 700,
    fontSize: "var(--font-size-base)",
    padding: "var(--space-4)",
    borderRadius: "var(--radius-md)",
    width: "100%",
    transition: "opacity var(--transition-fast)",
    cursor: "pointer",
    border: "none",
  },
};
