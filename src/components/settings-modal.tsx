"use client";

import { useState, useEffect, useRef } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqSaving, setGroqSaving] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [groqMessage, setGroqMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [geminiMessage, setGeminiMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  async function handleSaveGroqKey() {
    setGroqSaving(true);
    setGroqMessage(null);
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
      setGroqMessage({ text: "Groq API key saved successfully", isError: false });
      setGroqKey("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save Groq key";
      setGroqMessage({ text: message, isError: true });
    } finally {
      setGroqSaving(false);
    }
  }

  async function handleSaveGeminiKey() {
    setGeminiSaving(true);
    setGeminiMessage(null);
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
      setGeminiMessage({ text: "Gemini API key saved successfully", isError: false });
      setGeminiKey("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save Gemini key";
      setGeminiMessage({ text: message, isError: true });
    } finally {
      setGeminiSaving(false);
    }
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
                disabled={groqSaving || !groqKey.trim()}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {groqSaving ? "Saving..." : "Save"}
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
                disabled={geminiSaving || !geminiKey.trim()}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {geminiSaving ? "Saving..." : "Save"}
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            API keys are stored securely and used only for game processing.
          </p>
        </div>
      </div>
    </div>
  );
}
