// ============================================================
// TASK 8-A — CarbonPanel
// Pannello ambientale: Carbon Score, breakdown costi, SAF mandate,
// proiezione 12 mesi, raccomandazioni.
// UI conventions: profit #34D399, loss #F87171, warning #F59E0B, info #00C8FF
// Cards: background #0F1829, border-radius 10px, padding 14-16px
// ============================================================

import React from "react";
import type { CarbonScore } from "../domain/types";
import type { CarbonRecommendation } from "../simulation/carbonEngine";
import { getCarbonNPSImpact } from "../simulation/carbonEngine";

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg:       "#080E1A",
  card:     "#0F1829",
  border:   "#1E2D45",
  cyan:     "#00C8FF",
  orange:   "#F59E0B",
  profit:   "#34D399",
  loss:     "#F87171",
  text:     "#E8EDF5",
  muted:    "#8BA0BC",
} as const;

const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 10,
  padding: "14px 16px",
  border: `1px solid ${C.border}`,
};

const mono: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

// ============================================================
// CARBON SCORE BADGE
// ============================================================

const RATING_COLORS: Record<string, string> = {
  A: C.profit,
  B: C.cyan,
  C: C.orange,
  D: "#FB923C",
  F: C.loss,
};

function RatingBadge({ rating }: { rating: string }) {
  const color = RATING_COLORS[rating] ?? C.muted;
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: `${color}22`,
      border: `2px solid ${color}`,
      fontSize: 28,
      fontWeight: 700,
      color,
      ...mono,
    }}>
      {rating}
    </div>
  );
}

// ============================================================
// GAUGE LINEARE (emissioni/pax-km)
// ============================================================

function EmissionsGauge({
  actual,
  benchmark,
}: {
  actual: number;   // kg CO₂/pax-km
  benchmark: number;
}) {
  const ratio = actual / benchmark;
  const pct = Math.min(200, ratio * 100);
  const color = ratio < 0.90 ? C.profit : ratio < 1.05 ? C.orange : C.loss;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, ...mono, fontSize: 12, color: C.muted }}>
        <span>0</span>
        <span>Benchmark {benchmark * 1000}g</span>
        <span>2×</span>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 8, position: "relative" }}>
        <div style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, pct / 2)}%`,
          background: color,
          borderRadius: 4,
          transition: "width 0.4s ease",
        }} />
        {/* Linea benchmark */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: -3, bottom: -3,
          width: 2,
          background: C.muted,
          borderRadius: 1,
        }} />
      </div>
      <div style={{ marginTop: 4, ...mono, fontSize: 11, color }}>
        {(actual * 1000).toFixed(1)}g/pax-km ({ratio < 1 ? `−${((1 - ratio) * 100).toFixed(0)}%` : `+${((ratio - 1) * 100).toFixed(0)}%`} vs benchmark)
      </div>
    </div>
  );
}

// ============================================================
// SAF MANDATE PROGRESS BAR
// ============================================================

function SAFProgress({ current, mandate }: { current: number; mandate: number }) {
  const pct = mandate > 0 ? Math.min(1, current / mandate) : 1;
  const color = pct >= 1 ? C.profit : pct >= 0.7 ? C.orange : C.loss;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: C.muted }}>
        <span>SAF blending attuale</span>
        <span style={{ ...mono, color }}>{(current * 100).toFixed(1)}% / {(mandate * 100).toFixed(0)}% obbligo</span>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
        <div style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 4,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ============================================================
// BREAKDOWN COSTI
// ============================================================

function CostRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{label}</span>
      <span style={{ ...mono, fontSize: 13, color: color ?? C.loss }}>
        −${value.toLocaleString()}
      </span>
    </div>
  );
}

// ============================================================
// PROIEZIONE 12 MESI (semplice grafico a barre)
// ============================================================

function CostProjection({ monthlyCost, gameYear }: { monthlyCost: number; gameYear: number }) {
  // I costi ambientali crescono nel tempo (ETS scale-in + SAF mandate)
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    // ETS crescita: +5% per anno dopo il 2026
    const etsMult = gameYear >= 2026 ? 1 + (gameYear - 2026) * 0.05 : 1;
    // SAF: cresce secondo mandate
    const safMult = gameYear >= 2030 ? 1.5 : gameYear >= 2025 ? 1.1 : 1;
    const projection = monthlyCost * (etsMult * safMult) * (1 + (month - 1) * 0.008);
    return { month, cost: Math.round(projection) };
  });

  const maxCost = Math.max(...months.map(m => m.cost));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
        {months.map(({ month, cost }) => {
          const height = maxCost > 0 ? (cost / maxCost) * 100 : 0;
          return (
            <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div
                style={{
                  width: "100%",
                  height: `${height}%`,
                  background: cost > monthlyCost * 1.2 ? C.loss : C.cyan,
                  borderRadius: "2px 2px 0 0",
                  opacity: 0.8,
                }}
                title={`${["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][month - 1]}: $${cost.toLocaleString()}`}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: C.muted }}>
        <span>Gen</span><span>Giu</span><span>Dic</span>
      </div>
    </div>
  );
}

// ============================================================
// RACCOMANDAZIONE CARD
// ============================================================

function RecommendationCard({ rec }: { rec: CarbonRecommendation }) {
  const badgeColor = rec.priority === "HIGH" ? C.loss : rec.priority === "MEDIUM" ? C.orange : C.cyan;
  return (
    <div style={{ ...card, marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 4,
        background: `${badgeColor}22`,
        color: badgeColor,
        border: `1px solid ${badgeColor}`,
        marginTop: 2,
      }}>
        {rec.priority}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.text }}>{rec.action}</div>
        {rec.expectedSaving > 0 && (
          <div style={{ fontSize: 11, color: C.profit, marginTop: 4, ...mono }}>
            Risparmio stimato: ${rec.expectedSaving.toLocaleString()}/mese
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PANNELLO PRINCIPALE
// ============================================================

export interface CarbonPanelProps {
  score: CarbonScore;
  recommendations: CarbonRecommendation[];
  gameYear: number;
  safMandatePct: number;   // obbligo anno corrente (0.02 = 2%)
}

export function CarbonPanel({
  score,
  recommendations,
  gameYear,
  safMandatePct,
}: CarbonPanelProps) {
  const impact = getCarbonNPSImpact(score);
  const totalMonthly = score.totalComplianceCostMonthly;

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif", padding: 16 }}>

      {/* Header */}
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        Regolamentazione Ambientale
      </div>

      {/* Score + emissioni */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <RatingBadge rating={score.rating} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Carbon Score</div>
            <div style={{ fontSize: 12, color: impact.euRouteBan ? C.loss : C.muted }}>
              {impact.description}
            </div>
          </div>
        </div>
        <EmissionsGauge actual={score.emissionsPerPaxKm} benchmark={score.industryBenchmark} />
      </div>

      {/* SAF Mandate */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>SAF Mandate {gameYear}</div>
        <SAFProgress current={score.safBlendPct} mandate={safMandatePct} />
      </div>

      {/* Breakdown costi mensili */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Costi compliance / mese</div>
        <CostRow label="CORSIA (offset emissioni internazionali)" value={score.corsiaMonthly} />
        <CostRow label="EU ETS (intra-EEA)" value={score.etsMonthly} />
        <CostRow label="SAF blending premium" value={score.totalComplianceCostMonthly - score.corsiaMonthly - score.etsMonthly} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700 }}>
          <span>Totale</span>
          <span style={{ ...mono, color: C.loss }}>−${totalMonthly.toLocaleString()}</span>
        </div>
      </div>

      {/* Proiezione 12 mesi */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Proiezione costi ambientali 12 mesi</div>
        <CostProjection monthlyCost={totalMonthly} gameYear={gameYear} />
      </div>

      {/* Impatto operativo */}
      {(impact.corporateLoadFactorDelta !== 0 || impact.loanCostDelta !== 0) && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Impatto operativo</div>
          {impact.corporateLoadFactorDelta !== 0 && (
            <div style={{ fontSize: 13, color: impact.corporateLoadFactorDelta > 0 ? C.profit : C.loss, marginBottom: 4 }}>
              Load factor corporate: {impact.corporateLoadFactorDelta > 0 ? "+" : ""}{(impact.corporateLoadFactorDelta * 100).toFixed(0)}%
            </div>
          )}
          {impact.loanCostDelta !== 0 && (
            <div style={{ fontSize: 13, color: impact.loanCostDelta < 0 ? C.profit : C.loss, marginBottom: 4 }}>
              Costo prestiti: {impact.loanCostDelta > 0 ? "+" : ""}{(impact.loanCostDelta * 100).toFixed(0)}%
            </div>
          )}
          {impact.euRouteBan && (
            <div style={{ fontSize: 13, color: C.loss, fontWeight: 600 }}>
              ⚠️ Rischio ban rotte EU per rating F
            </div>
          )}
        </div>
      )}

      {/* Raccomandazioni */}
      {recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Raccomandazioni</div>
          {recommendations.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

export default CarbonPanel;
