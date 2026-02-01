"use client";

import { useState } from "react";
import { useLeaderboard } from "@/contexts/leaderboard-context";

// Skill modes with descriptions
export const SKILL_MODES = [
  {
    id: "novice",
    name: "Novice",
    description: "Makes obvious blunders and tactical oversights. Hangs pieces frequently, misses simple one-move threats.",
  },
  {
    id: "apprentice", 
    name: "Apprentice",
    description: "Understands basic principles but applies them inconsistently. Makes occasional tactical mistakes.",
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Solid fundamental play. Recognizes common tactical patterns and thinks 3-5 moves ahead.",
  },
  {
    id: "strategist",
    name: "Strategist",
    description: "Strong positional understanding. Plans 5-8 moves ahead with sophisticated tactics.",
  },
  {
    id: "virtuoso",
    name: "Virtuoso",
    description: "Plays like a strong club player. Deep understanding of openings, middlegame, and endgame.",
  },
  {
    id: "grandmaster",
    name: "Grandmaster",
    description: "Plays at high competitive standard. Almost never makes mistakes with deep evaluation.",
  },
] as const;

export type SkillMode = typeof SKILL_MODES[number]["id"];

// Provider-specific colors
const PROVIDER_CONFIG: Record<string, { bg: string; text: string; symbol: string }> = {
  openai: { bg: "#22c55e", text: "#166534", symbol: "◆" },
  anthropic: { bg: "#f97316", text: "#9a3412", symbol: "●" },
  google: { bg: "#3b82f6", text: "#1e40af", symbol: "▲" },
  gemini: { bg: "#3b82f6", text: "#1e40af", symbol: "▲" },
  xai: { bg: "#8b5cf6", text: "#5b21b6", symbol: "✦" },
  deepseek: { bg: "#14b8a6", text: "#115e59", symbol: "◈" },
  meta: { bg: "#0ea5e9", text: "#0369a1", symbol: "◎" },
  groq: { bg: "#f97316", text: "#9a3412", symbol: "⚡" },
};

interface ModelSelectorProps {
  color: "white" | "black";
  selectedModelId: string | null;
  selectedMode: SkillMode;
  onSelectModel: (modelId: string) => void;
  onSelectMode: (mode: SkillMode) => void;
  disabled?: boolean;
}

export function ModelSelector({ 
  color, 
  selectedModelId, 
  selectedMode,
  onSelectModel, 
  onSelectMode,
  disabled 
}: ModelSelectorProps) {
  const { models, isLoading } = useLeaderboard();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedModeData = SKILL_MODES.find((m) => m.id === selectedMode);
  const config = selectedModel ? (PROVIDER_CONFIG[selectedModel.provider] || PROVIDER_CONFIG.openai) : null;

  const headerBg = color === "white" ? "#f8fafc" : "#1e293b";
  const headerText = color === "white" ? "#1e293b" : "#f8fafc";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div 
        className="px-4 py-3 border-b"
        style={{ backgroundColor: headerBg, color: headerText }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider">
            {color === "white" ? "White" : "Black"}
          </span>
          <span 
            className="text-[10px] px-2 py-0.5 rounded font-semibold"
            style={{ 
              backgroundColor: color === "white" ? "#e2e8f0" : "#334155",
              color: headerText,
            }}
          >
            {color.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Model Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Select Model
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => !disabled && !isLoading && setIsModelDropdownOpen(!isModelDropdownOpen)}
              disabled={disabled || isLoading}
              className={`
                w-full px-4 py-3 text-left border rounded-lg transition-all
                ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:border-gray-400 cursor-pointer"}
                ${isModelDropdownOpen ? "border-gray-400 ring-2 ring-gray-200" : "border-gray-200"}
              `}
            >
              {isLoading ? (
                <span className="text-gray-400 text-sm">Loading models...</span>
              ) : selectedModel ? (
                <div className="flex items-center gap-2">
                  <span 
                    className="w-6 h-6 flex items-center justify-center rounded text-white text-xs"
                    style={{ backgroundColor: config?.bg }}
                  >
                    {config?.symbol}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{selectedModel.name}</div>
                    <div className="text-xs text-gray-500">
                      ELO {selectedModel.elo} · W{selectedModel.wins}/L{selectedModel.losses}/D{selectedModel.draws}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Choose a model...</span>
              )}
              <svg
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {models.map((model) => {
                  const modelConfig = PROVIDER_CONFIG[model.provider] || PROVIDER_CONFIG.openai;
                  const isSelected = model.id === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-2
                        ${isSelected ? "bg-gray-50" : ""}
                      `}
                    >
                      <span 
                        className="w-6 h-6 flex items-center justify-center rounded text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: modelConfig.bg }}
                      >
                        {modelConfig.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{model.name}</div>
                        <div className="text-xs text-gray-500">
                          ELO {model.elo} · W{model.wins}/L{model.losses}/D{model.draws}
                        </div>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mode Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Skill Level
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => !disabled && setIsModeDropdownOpen(!isModeDropdownOpen)}
              disabled={disabled}
              className={`
                w-full px-4 py-3 text-left border rounded-lg transition-all
                ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:border-gray-400 cursor-pointer"}
                ${isModeDropdownOpen ? "border-gray-400 ring-2 ring-gray-200" : "border-gray-200"}
              `}
            >
              {selectedModeData ? (
                <div>
                  <div className="font-medium text-gray-900">{selectedModeData.name}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{selectedModeData.description}</div>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Choose skill level...</span>
              )}
              <svg
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${isModeDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Mode Dropdown Menu */}
            {isModeDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {SKILL_MODES.map((mode) => {
                  const isSelected = mode.id === selectedMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        onSelectMode(mode.id);
                        setIsModeDropdownOpen(false);
                      }}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                        ${isSelected ? "bg-gray-50" : ""}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{mode.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{mode.description}</div>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Summary */}
        {selectedModel && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Configuration
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span 
                  className="w-5 h-5 flex items-center justify-center rounded text-white text-[10px]"
                  style={{ backgroundColor: config?.bg }}
                >
                  {config?.symbol}
                </span>
                <span className="text-sm font-medium text-gray-800">{selectedModel.name}</span>
              </div>
              <div className="text-xs text-gray-600 pl-7">
                Playing as <strong>{selectedModeData?.name}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Close dropdowns when clicking outside */}
      {(isModelDropdownOpen || isModeDropdownOpen) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setIsModelDropdownOpen(false);
            setIsModeDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
}
