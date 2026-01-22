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
    setSelected((prev) => ({ ...prev, [id]: value }));
  }

  async function handleStartGame() {
    if (selectedIds.length < 2) {
      setStartMessage("Select at least two models");
      return;
    }

    setStarting(true);
    setStartMessage(null);
    try {
      const res = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to start game");
      }

      await fetch("/api/cron/tick", { method: "POST" }).catch(() => {});
      setStartMessage("Game started");
    } catch (e: any) {
      setStartMessage(e.message || "Failed to start game");
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
      <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto pr-1">
        {models.map((model, index) => (
          <div
            key={model.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-4 text-gray-500">{index + 1}.</span>
              <span className="font-medium">{model.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={!!selected[model.id]}
                onChange={(e) => toggleSelect(model.id, e.target.checked)}
                title="Select for game"
                data-testid={`select-model-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
              />
              <span className="font-bold">{model.elo}</span>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={!!model.active}
                  onChange={(e) => handleToggleModel(model.id, e.target.checked)}
                />
                Active
              </label>
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

        {groqModels.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] font-bold text-gray-700">Groq Models</div>
            {groqModels.map((m) => (
              <label key={m.id} className="flex items-center justify-between text-xs text-gray-700 border px-2 py-1">
                <span>{m.name}</span>
                <input
                  type="checkbox"
                  checked={!!m.active}
                  onChange={(e) => handleToggleModel(m.id, e.target.checked)}
                />
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 space-y-2 border-t border-black pt-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Single Game</span>
            {startMessage && <span className="text-[11px] text-gray-500">{startMessage}</span>}
          </div>
          <button
            onClick={handleStartGame}
            disabled={starting || selectedIds.length < 2}
            className="w-full border-2 border-black bg-white text-black text-xs py-1 disabled:opacity-50"
            data-testid="start-game"
          >
            {starting ? "Starting..." : selectedIds.length < 2 ? "Select 2+ models" : "Start Game"}
          </button>
        </div>
      </div>
    </div>
  );
}
