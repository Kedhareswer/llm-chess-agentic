import type { Move, Model } from "@/db/schema";

interface ReasoningPanelProps {
  model: Model;
  moves: Move[];
  color: "white" | "black";
  isThinking?: boolean;
  selectedMoveId?: string | null;
  onMoveClick?: (moveId: string) => void;
  onViewSnapshot?: (fen: string) => void;
}

function normalizeReasoning(text: string | undefined): string {
  if (!text) return "No reasoning provided";
  const trimmed = text.trim();

  try {
    const withoutFences = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");

    const candidates: string[] = [];
    candidates.push(withoutFences);

    const objectMatch = withoutFences.match(/\{[\s\S]*?\}/);
    if (objectMatch) {
      candidates.push(objectMatch[0]);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object") {
          if (typeof (parsed as any).reasoning === "string") return (parsed as any).reasoning.trim();
          if (typeof (parsed as any).reason === "string") return (parsed as any).reason.trim();
          if (typeof parsed === "string") return (parsed as string).trim();
        }
      } catch {
        // Try next candidate
      }
    }

    const reasoningMatch = withoutFences.match(/"reasoning"\s*:\s*"([^"]+)"/i) ||
      withoutFences.match(/"reason"\s*:\s*"([^"]+)"/i);
    if (reasoningMatch && reasoningMatch[1]) {
      return reasoningMatch[1].trim();
    }
  } catch {
    // Not JSON; fall through to trimmed text
  }

  return trimmed;
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

export function ReasoningPanel({ 
  model, 
  moves, 
  color, 
  isThinking,
  selectedMoveId,
  onMoveClick,
  onViewSnapshot,
}: ReasoningPanelProps) {
  const modelMoves = moves.filter((m) => m.modelId === model.id);
  const latestMove = modelMoves[modelMoves.length - 1];
  const config = PROVIDER_CONFIG[model.provider] || PROVIDER_CONFIG.openai;

  // Get selected move or use latest
  const selectedMove = selectedMoveId 
    ? modelMoves.find(m => m.id === selectedMoveId) 
    : latestMove;

  const selectedReasoningRaw = selectedMove?.reasoning;
  const selectedReasoning = normalizeReasoning(selectedReasoningRaw);
  const hasJudgeWarning = selectedReasoningRaw?.includes("⚠ Judge retry");
  const displayReasoning = hasJudgeWarning
    ? selectedReasoning.replace(/\s*⚠ Judge retry.*$/, "").trim() + " (Judge warned)"
    : selectedReasoning;

  const isSelectedMove = selectedMoveId && selectedMoveId === selectedMove?.id;

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

      {/* Selected/Latest move & reasoning */}
      {selectedMove ? (
        <div
          style={{ backgroundColor: config.bgLight, borderBottom: `2px solid ${config.border}`, padding: "12px 16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{ color: config.text, fontSize: "32px", fontWeight: 900 }}>
              {selectedMove.moveSan}
            </span>
            <span style={{ color: config.text, fontSize: "12px", opacity: 0.7 }}>
              move {selectedMove.moveNumber}
            </span>
            {isSelectedMove && selectedMove !== latestMove && (
              <span style={{ color: config.text, fontSize: "10px", opacity: 0.6, fontStyle: "italic" }}>
                (selected)
              </span>
            )}
          </div>
          <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "10px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", position: "relative" }}>
            <div style={{ color: config.text, fontSize: "10px", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Reasoning</span>
              {hasJudgeWarning && (
                <span style={{ backgroundColor: "#f97316", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                  Judge warning
                </span>
              )}
            </div>
            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{displayReasoning}</p>
            {isSelectedMove && selectedMove.fenAfter && onViewSnapshot && (
              <button
                onClick={() => onViewSnapshot(selectedMove.fenAfter)}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  padding: "8px",
                  backgroundColor: config.bg,
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                View Snapshot
              </button>
            )}
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
              .map((move, idx) => {
                const isLatest = idx === 0;
                const isSelected = selectedMoveId === move.id;
                const isClickable = onMoveClick !== undefined;
                
                return (
                  <div
                    key={move.id}
                    onClick={() => isClickable && onMoveClick(move.id)}
                    style={{ 
                      backgroundColor: isSelected ? config.bgLight : isLatest ? config.bgLight : "#f9fafb", 
                      padding: "8px 10px", 
                      borderRadius: "6px",
                      cursor: isClickable ? "pointer" : "default",
                      border: isSelected ? `2px solid ${config.border}` : "2px solid transparent",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (isClickable && !isSelected) {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isClickable && !isSelected) {
                        e.currentTarget.style.backgroundColor = isLatest ? config.bgLight : "#f9fafb";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{ color: isSelected || isLatest ? config.text : "#4b5563", fontFamily: "monospace", fontWeight: "bold", fontSize: "14px" }}
                      >
                        {move.moveNumber}.
                      </span>
                      <span
                        style={{ color: isSelected || isLatest ? config.text : "#374151", fontWeight: 600, fontSize: "14px" }}
                      >
                        {move.moveSan}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: "10px", color: config.text, opacity: 0.7 }}>✓</span>
                      )}
                    </div>
                    {(isLatest || isSelected) && (
                      <p
                        style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px", marginBottom: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}
                      >
                        {normalizeReasoning(move.reasoning)}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No moves yet</div>
        )}
      </div>
    </div>
  );
}
