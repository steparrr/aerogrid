import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100dvh", background: "#080E1A", color: "#E2E8F0",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#F87171" }}>Errore di rendering</div>
          <div style={{
            fontSize: 12, color: "#64748B", fontFamily: "monospace",
            background: "#0F1829", border: "1px solid #1E2D45",
            borderRadius: 8, padding: "12px 16px", maxWidth: 480, wordBreak: "break-all",
          }}>
            {this.state.error.message}
          </div>
          <button
            style={{
              background: "#00C8FF", color: "#080E1A", fontWeight: 700,
              border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer",
            }}
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Ricarica app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
