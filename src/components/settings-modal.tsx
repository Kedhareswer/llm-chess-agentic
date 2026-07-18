"use client";

import { useState, useEffect, useRef } from "react";
import { useChessSounds } from "@/hooks/use-chess-sounds";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqMessage, setGroqMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [geminiMessage, setGeminiMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Keys are yours: kept only in this browser (localStorage) and sent with each
  // match you start. Never stored on the server as a shared global key.
  useEffect(() => {
    setGroqKey(localStorage.getItem("groqApiKey") || "");
    setGeminiKey(localStorage.getItem("geminiApiKey") || "");
  }, [isOpen]);

  const { getSettings, updateSettings, sounds } = useChessSounds();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);

  // Load sound settings on mount
  useEffect(() => {
    const settings = getSettings();
    setSoundEnabled(settings.enabled);
    setSoundVolume(settings.volume);
  }, [getSettings]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleSaveGroqKey() {
    const trimmed = groqKey.trim();
    if (trimmed) localStorage.setItem("groqApiKey", trimmed);
    else localStorage.removeItem("groqApiKey");
    setGroqMessage({ text: trimmed ? "Groq API key saved in this browser" : "Groq API key cleared", isError: false });
  }

  function handleSaveGeminiKey() {
    const trimmed = geminiKey.trim();
    if (trimmed) localStorage.setItem("geminiApiKey", trimmed);
    else localStorage.removeItem("geminiApiKey");
    setGeminiMessage({ text: trimmed ? "Gemini API key saved in this browser" : "Gemini API key cleared", isError: false });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-lg">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Groq API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Groq API Key</label>
              {groqMessage && (
                <span className={`text-xs ${groqMessage.isError ? "text-red-600" : "text-green-600"}`}>
                  {groqMessage.text}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
              />
              <button
                onClick={handleSaveGroqKey}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Required for Groq models. Get your key at{" "}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:underline"
              >
                console.groq.com
              </a>
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Gemini API Key</label>
              {geminiMessage && (
                <span className={`text-xs ${geminiMessage.isError ? "text-red-600" : "text-green-600"}`}>
                  {geminiMessage.text}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
              />
              <button
                onClick={handleSaveGeminiKey}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Required for Gemini models. Get your key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                aistudio.google.com
              </a>
            </p>
          </div>

          {/* Sound Settings */}
          <div className="space-y-3 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Sound Effects</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sound-enabled"
                checked={soundEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setSoundEnabled(enabled);
                  updateSettings({ enabled });
                  // Play test sound when enabling
                  if (enabled && sounds) {
                    setTimeout(() => sounds.playMove(), 100);
                  }
                }}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="sound-enabled" className="text-sm text-gray-700 cursor-pointer">
                Enable move sounds
              </label>
            </div>
            {soundEnabled && (
              <div className="space-y-2 pl-7">
                <label className="text-xs text-gray-600">Volume</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={soundVolume * 100}
                    onChange={(e) => {
                      const volume = parseInt(e.target.value) / 100;
                      setSoundVolume(volume);
                      updateSettings({ volume });
                    }}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                  <span className="text-xs text-gray-600 w-10 text-right">
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (sounds) {
                      sounds.playMove();
                      setTimeout(() => sounds.playCapture(), 200);
                      setTimeout(() => sounds.playCheck(), 400);
                    }
                  }}
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Test sounds
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Your API keys stay in this browser and are sent only with the matches you start.
          </p>
        </div>
      </div>
    </div>
  );
}
