"use client";

import { useEffect, useMemo, useState } from "react";
import type { Model } from "@/db/schema";

export function Leaderboard() {
  const [models, setModels] = useState<Model[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [groqKey, setGroqKey] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiSaveMessage, setGeminiSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      setModels(data.models);
    }

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSaveGeminiKey() {
    setSaving(true);
    setGeminiSaveMessage(null);
    try {
      const res = await fetch("/api/tournament/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: geminiKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save Gemini key");
      }
      setGeminiSaveMessage("Gemini key saved");
    } catch (e: any) {
      setGeminiSaveMessage(e.message || "Failed to save Gemini key");
    } finally {
      setSaving(false);
    }
  }

  const groqModels = useMemo(
    () => models.filter((m) => m.provider === "groq"),
    [models]
  );

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  async function handleSaveGroqKey() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/tournament/groq-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: groqKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save Groq key");
      }
      setSaveMessage("Groq key saved");
    } catch (e: any) {
      setSaveMessage(e.message || "Failed to save Groq key");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(id: string, value: boolean) {
    setStartMessage(null);
    setSelected((prev) => {
      const currentIds = Object.entries(prev)
        .filter(([, v]) => v)
        .map(([k]) => k);

      // Enforce exactly two selections max
      if (value && currentIds.length >= 2 && !prev[id]) {
        setStartMessage("Select exactly two models");
        return prev;
      }

      return { ...prev, [id]: value };
    });
  }

  async function handleStartGame() {
    if (selectedIds.length !== 2) {
      setStartMessage("Select exactly two models");
      return;
    }

    setStarting(true);
    setStartMessage(null);
    try {
      // Ensure selected models are active before starting
      await Promise.all(
        selectedIds.map((id) =>
          fetch("/api/models/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, active: true }),
          }).catch(() => null)
        )
      );

      const res = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelIds: selectedIds.slice(0, 2) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to start game");
      }

      await fetch("/api/cron/tick", { method: "POST" }).catch(() => {});
      setStartMessage("Game started");
    } catch (e: any) {
      setStartMessage(e.message || "Failed to start game (ensure models are active)");
    } finally {
      setStarting(false);
    }
  }

  async function handleToggleModel(id: string, active: boolean) {
    const prev = models;
    setModels((ms) => ms.map((m) => (m.id === id ? { ...m, active } : m)));
    try {
      const res = await fetch("/api/models/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) {
        throw new Error("Toggle failed");
      }
    } catch {
      setModels(prev); // revert
    }
  }

  return (
    <div className="border-2 border-black bg-white max-h-[80vh] overflow-y-auto">
      <div className="border-b-2 border-black px-3 py-2">
        <h2 className="text-sm font-bold">LEADERBOARD</h2>
      </div>
      <div className="divide-y divide-gray-200 max-h-[50vh] overflow-y-auto pr-1">
        {models.map((model, index) => (
          <div
            key={model.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
            data-testid={`leaderboard-row-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-4 text-gray-500">{index + 1}.</span>
              <div className="flex flex-col">
                <span className="font-medium">{model.name}</span>
                <span className="text-[11px] text-gray-600">
                  ELO {model.elo} · W{model.wins}/L{model.losses}/D{model.draws}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-black px-3 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold">GROQ SETTINGS</h3>
          {saveMessage && (
            <span className="text-[11px] text-gray-500">{saveMessage}</span>
          )}
        </div>
        <label className="text-xs text-gray-700">Groq API Key</label>
        <textarea
          className="w-full border border-black px-2 py-1 text-xs font-mono"
          rows={2}
          value={groqKey}
          onChange={(e) => setGroqKey(e.target.value)}
          placeholder="gsk_..."
          data-testid="groq-key"
        />
        <button
          onClick={handleSaveGroqKey}
          disabled={saving || !groqKey.trim()}
          className="w-full border-2 border-black bg-black text-white text-xs py-1 disabled:opacity-50"
          data-testid="save-groq-key"
        >
          {saving ? "Saving..." : "Save Groq Key"}
        </button>

        <div className="flex items-center justify-between pt-3">
          <h3 className="text-xs font-bold">GEMINI SETTINGS</h3>
          {geminiSaveMessage && (
            <span className="text-[11px] text-gray-500">{geminiSaveMessage}</span>
          )}
        </div>
        <label className="text-xs text-gray-700">Gemini API Key</label>
        <textarea
          className="w-full border border-black px-2 py-1 text-xs font-mono"
          rows={2}
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="AIza..."
          data-testid="gemini-key"
        />
        <button
          onClick={handleSaveGeminiKey}
          disabled={saving || !geminiKey.trim()}
          className="w-full border-2 border-black bg-black text-white text-xs py-1 disabled:opacity-50"
          data-testid="save-gemini-key"
        >
          {saving ? "Saving..." : "Save Gemini Key"}
        </button>

        {groqModels.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] font-bold text-gray-700">Groq Models (read-only)</div>
            {groqModels.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs text-gray-700 border px-2 py-1">
                <span>{m.name}</span>
                <span className="text-[11px] text-gray-600">ELO {m.elo}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2 border-t border-black pt-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>GAME SETUP</span>
            {startMessage && <span className="text-[11px] text-red-600">{startMessage}</span>}
          </div>

          <div className="text-[11px] text-gray-700">Choose exactly two models to play.</div>

          <div className="max-h-[200px] overflow-y-auto border border-black p-2 space-y-2" data-testid="game-setup-list">
            {models.map((model) => {
              const isSelected = !!selected[model.id];
              const disabled = !isSelected && selectedIds.length >= 2;
              return (
                <label
                  key={model.id}
                  className={`flex items-center justify-between text-xs ${disabled ? "opacity-50" : ""}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-[11px] text-gray-600">ELO {model.elo} · W{model.wins}/L{model.losses}/D{model.draws}</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={isSelected}
                    onChange={(e) => toggleSelect(model.id, e.target.checked)}
                    data-testid={`setup-select-model-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                    title="Select for game"
                  />
                </label>
              );
            })}
          </div>

          <div className="text-[11px] text-gray-700">
            Selected: {selectedIds.length}/2
            {selectedIds.length === 2 && (
              <div className="mt-1 text-[11px] text-gray-600">
                {selectedIds.map((id) => models.find((m) => m.id === id)?.name || id).join(" vs ")}
              </div>
            )}
          </div>

          <button
            onClick={handleStartGame}
            disabled={starting || selectedIds.length !== 2}
            className="w-full border-2 border-black bg-white text-black text-xs py-1 disabled:opacity-50"
            data-testid="start-game"
          >
            {starting
              ? "Starting..."
              : selectedIds.length === 2
              ? "Start Game"
              : "Select exactly two models"}
          </button>
        </div>
      </div>
    </div>
  );
}
