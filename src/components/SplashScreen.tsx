import { useEffect, useState } from "react";

interface Props {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Fade-in dopo mount
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleEnter() {
    setExiting(true);
    setTimeout(onEnter, 600);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        overflow: "hidden",
        background: "#080E1A",
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: exiting ? "opacity 0.6s ease" : "opacity 0.8s ease",
        paddingBottom: "max(48px, env(safe-area-inset-bottom, 48px))",
      }}
    >
      {/* Immagine di sfondo full-cover */}
      <img
        src="/splash.png"
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          transform: visible ? "scale(1)" : "scale(1.04)",
          transition: "transform 1.2s ease",
        }}
      />

      {/* Gradiente basso per leggibilità del bottone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "45%",
          background: "linear-gradient(to top, rgba(8,14,26,0.92) 0%, transparent 100%)",
        }}
      />

      {/* Tagline + bottone */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s",
        }}
      >
        <p
          style={{
            margin: "0 0 32px",
            fontSize: 15,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(232,237,245,0.65)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Gestionale aereo realistico a turni
        </p>

        <button
          onClick={handleEnter}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 40px",
            background: "#00C8FF",
            color: "#080E1A",
            border: "none",
            borderRadius: 12,
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 0 32px rgba(0,200,255,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 48px rgba(0,200,255,0.55)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 32px rgba(0,200,255,0.35)";
          }}
        >
          <span style={{ fontSize: 20 }}>✈</span>
          Inizia a volare
        </button>
      </div>
    </div>
  );
}
