"use client";

import { useStockfish } from "@/hooks/use-stockfish";

interface EvalBarProps {
  fen: string;
}

export function EvalBar({ fen }: EvalBarProps) {
  const { evaluation, depth, isReady } = useStockfish(fen, 16);

  // Convert centipawns to percentage (sigmoid-like scaling)
  // ±400cp maps roughly to ±90% of the bar
  const evalToPercent = (cp: number): number => {
    // Clamp extreme values
    const clamped = Math.max(-1000, Math.min(1000, cp));
    // Sigmoid-ish transformation
    const percent = 50 + (50 * clamped) / (Math.abs(clamped) + 400);
    return percent;
  };

  const whitePercent = evaluation !== null ? evalToPercent(evaluation) : 50;
  const evalText =
    evaluation !== null
      ? evaluation >= 0
        ? `+${(evaluation / 100).toFixed(1)}`
        : (evaluation / 100).toFixed(1)
      : "...";

  return (
    <div
      style={{
        width: "24px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "2px solid black",
        position: "relative",
        backgroundColor: "#1a1a1a",
      }}
    >
      {/* White portion (bottom) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${whitePercent}%`,
          backgroundColor: "#f0f0f0",
          transition: "height 0.3s ease-out",
        }}
      />

      {/* Eval text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-90deg)",
          fontSize: "10px",
          fontWeight: "bold",
          color: whitePercent > 50 ? "#1a1a1a" : "#f0f0f0",
          whiteSpace: "nowrap",
          textShadow:
            whitePercent > 50
              ? "0 0 2px #f0f0f0"
              : "0 0 2px #1a1a1a",
        }}
      >
        {evalText}
      </div>

      {/* Depth indicator */}
      {!isReady ? (
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "8px",
            color: "#666",
          }}
        >
          ...
        </div>
      ) : depth > 0 ? (
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "8px",
            color: "#666",
          }}
        >
          d{depth}
        </div>
      ) : null}
    </div>
  );
}
