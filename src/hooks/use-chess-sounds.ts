"use client";

import { useEffect, useRef } from "react";

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.5,
};

/**
 * Generates a simple tone using Web Audio API
 */
function playTone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine"
): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug("Audio context not available:", error);
  }
}

/**
 * Chess sound effects using Web Audio API
 */
export class ChessSounds {
  private settings: SoundSettings;

  constructor(settings: SoundSettings = DEFAULT_SETTINGS) {
    this.settings = settings;
  }

  updateSettings(settings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Play move sound - a pleasant click
   */
  playMove(): void {
    if (!this.settings.enabled) return;
    // Short, pleasant click sound
    playTone(800, 0.05, this.settings.volume * 0.3, "sine");
  }

  /**
   * Play capture sound - sharper, more aggressive
   */
  playCapture(): void {
    if (!this.settings.enabled) return;
    // Two-tone capture sound
    playTone(600, 0.08, this.settings.volume * 0.4, "square");
    setTimeout(() => {
      playTone(400, 0.1, this.settings.volume * 0.3, "square");
    }, 50);
  }

  /**
   * Play check sound - alerting tone
   */
  playCheck(): void {
    if (!this.settings.enabled) return;
    // Rising alert tone
    playTone(600, 0.15, this.settings.volume * 0.5, "sine");
    setTimeout(() => {
      playTone(800, 0.15, this.settings.volume * 0.5, "sine");
    }, 100);
  }

  /**
   * Play checkmate sound - dramatic ending
   */
  playCheckmate(): void {
    if (!this.settings.enabled) return;
    // Dramatic descending chord
    playTone(523, 0.2, this.settings.volume * 0.6, "sine"); // C
    setTimeout(() => {
      playTone(440, 0.2, this.settings.volume * 0.6, "sine"); // A
    }, 100);
    setTimeout(() => {
      playTone(349, 0.3, this.settings.volume * 0.7, "sine"); // F
    }, 200);
  }

  /**
   * Play castling sound - special move
   */
  playCastle(): void {
    if (!this.settings.enabled) return;
    // Smooth sliding sound
    playTone(400, 0.12, this.settings.volume * 0.35, "sine");
    setTimeout(() => {
      playTone(500, 0.12, this.settings.volume * 0.35, "sine");
    }, 60);
  }

  /**
   * Play promotion sound - special move
   */
  playPromotion(): void {
    if (!this.settings.enabled) return;
    // Ascending celebratory tones
    playTone(523, 0.1, this.settings.volume * 0.4, "sine"); // C
    setTimeout(() => {
      playTone(659, 0.1, this.settings.volume * 0.4, "sine"); // E
    }, 80);
    setTimeout(() => {
      playTone(784, 0.15, this.settings.volume * 0.5, "sine"); // G
    }, 160);
  }
}

/**
 * Hook to use chess sounds with localStorage persistence
 */
export function useChessSounds() {
  const soundsRef = useRef<ChessSounds | null>(null);

  useEffect(() => {
    // Load settings from localStorage
    const loadSettings = (): SoundSettings => {
      if (typeof window === "undefined") return DEFAULT_SETTINGS;
      try {
        const stored = localStorage.getItem("chess-sound-settings");
        if (stored) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch {
        // Ignore parse errors
      }
      return DEFAULT_SETTINGS;
    };

    const settings = loadSettings();
    soundsRef.current = new ChessSounds(settings);

    // Listen for settings changes (only works across tabs, not same tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chess-sound-settings" && soundsRef.current) {
        try {
          const newSettings = e.newValue
            ? { ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) }
            : DEFAULT_SETTINGS;
          soundsRef.current.updateSettings(newSettings);
        } catch {
          // Ignore parse errors
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    }
  }, []);

  return {
    sounds: soundsRef.current,
    updateSettings: (settings: Partial<SoundSettings>) => {
      if (soundsRef.current) {
        soundsRef.current.updateSettings(settings);
        // Persist to localStorage
        if (typeof window !== "undefined") {
          try {
            const current = localStorage.getItem("chess-sound-settings");
            const merged = current
              ? { ...DEFAULT_SETTINGS, ...JSON.parse(current), ...settings }
              : { ...DEFAULT_SETTINGS, ...settings };
            localStorage.setItem("chess-sound-settings", JSON.stringify(merged));
          } catch {
            // Ignore errors
          }
        }
      }
    },
    getSettings: (): SoundSettings => {
      if (typeof window === "undefined") return DEFAULT_SETTINGS;
      try {
        const stored = localStorage.getItem("chess-sound-settings");
        return stored
          ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
          : DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
  };
}
