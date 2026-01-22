import type { Move, Model } from "@/db/schema";

interface ReasoningPanelProps {
  model: Model;
  moves: Move[];
  color: "white" | "black";
  isThinking?: boolean;
}

// Provider-specific colors
const PROVIDER_CONFIG: Record<string, { bg: string; bgLight: string; text: string; border: string; symbol: string }> = {
  openai: { bg: "#22c55e", bgLight: "#dcfce7", text: "#166534", border: "#22c55e", symbol: "◆" },
  anthropic: { bg: "#f97316", bgLight: "#ffedd5", text: "#9a3412", border: "#f97316", symbol: "●" },
  google: { bg: "#3b82f6", bgLight: "#dbeafe", text: "#1e40af", border: "#3b82f6", symbol: "▲" },
  xai: { bg: "#8b5cf6", bgLight: "#ede9fe", text: "#5b21b6", border: "#8b5cf6", symbol: "✦" },
  deepseek: { bg: "#14b8a6", bgLight: "#ccfbf1", text: "#115e59", border: "#14b8a6", symbol: "◈" },
  meta: { bg: "#0ea5e9", bgLight: "#e0f2fe", text: "#0369a1", border: "#0ea5e9", symbol: "◎" },
};

export function ReasoningPanel({ model, moves, color, isThinking }: ReasoningPanelProps) {
  const modelMoves = moves.filter((m) => m.modelId === model.id);
  const latestMove = modelMoves[modelMoves.length - 1];
  const config = PROVIDER_CONFIG[model.provider] || PROVIDER_CONFIG.openai;

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", backgroundColor: "white" }}>
      {/* Model header */}
      <div style={{ backgroundColor: config.bg, color: "white", padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "14px" }}>{config.symbol}</span>
          <span style={{ fontWeight: "bold", fontSize: "13px" }}>{model.name}</span>
          <span style={{ marginLeft: "auto", fontSize: "9px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
            {color.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", fontSize: "11px", opacity: 0.8 }}>
          <span style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: "3px" }}>
            ELO: <strong style={{ color: "white" }}>{model.elo}</strong>
          </span>
          <span>W:{model.wins}</span>
          <span>L:{model.losses}</span>
          <span>D:{model.draws}</span>
        </div>
      </div>

      {/* Thinking indicator */}
      {isThinking && (
        <div
          style={{
            backgroundColor: config.bgLight,
            padding: "12px 16px",
            borderBottom: `2px solid ${config.border}`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              backgroundColor: config.bg,
              borderRadius: "50%",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <span style={{ color: config.text, fontSize: "14px", fontWeight: 500 }}>
            Thinking...
          </span>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.8); }
            }
          `}</style>
        </div>
      )}

      {/* Latest move & reasoning */}
      {latestMove ? (
        <div
          style={{ backgroundColor: config.bgLight, borderBottom: `2px solid ${config.border}`, padding: "12px 16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{ color: config.text, fontSize: "32px", fontWeight: 900 }}>
              {latestMove.moveSan}
            </span>
            <span style={{ color: config.text, fontSize: "12px", opacity: 0.7 }}>
              move {latestMove.moveNumber}
            </span>
          </div>
          <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "10px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ color: config.text, fontSize: "10px", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Reasoning
            </div>
            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5, margin: 0 }}>{latestMove.reasoning}</p>
          </div>
        </div>
      ) : (
        <div
          style={{ backgroundColor: config.bgLight, borderBottom: `2px solid ${config.border}`, padding: "20px 16px" }}
        >
          <div style={{ color: config.text, fontSize: "14px", fontStyle: "italic" }}>
            Waiting for move...
          </div>
        </div>
      )}

      {/* Move history */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#9ca3af", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Move History
        </div>
        {modelMoves.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {modelMoves
              .slice()
              .reverse()
              .map((move, idx) => (
                <div
                  key={move.id}
                  style={{ backgroundColor: idx === 0 ? config.bgLight : "#f9fafb", padding: "8px 10px", borderRadius: "6px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{ color: idx === 0 ? config.text : "#4b5563", fontFamily: "monospace", fontWeight: "bold", fontSize: "14px" }}
                    >
                      {move.moveNumber}.
                    </span>
                    <span
                      style={{ color: idx === 0 ? config.text : "#374151", fontWeight: 600, fontSize: "14px" }}
                    >
                      {move.moveSan}
                    </span>
                  </div>
                  {idx === 0 && (
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px", marginBottom: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{move.reasoning}</p>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No moves yet</div>
        )}
      </div>
    </div>
  );
}
