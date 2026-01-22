"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface StockfishState {
  evaluation: number | null; // centipawns, positive = white advantage
  depth: number;
  isReady: boolean;
}

export function useStockfish(fen: string, targetDepth = 12) {
  const workerRef = useRef<Worker | null>(null);
  const fenRef = useRef(fen); // Track current FEN for use in callbacks
  const [state, setState] = useState<StockfishState>({
    evaluation: null,
    depth: 0,
    isReady: false,
  });

  // Keep fenRef in sync with current fen
  fenRef.current = fen;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker("/stockfish.js");
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = e.data;

      if (line === "uciok") {
        worker.postMessage("isready");
      }

      if (line === "readyok") {
        setState((s) => ({ ...s, isReady: true }));
      }

      // Parse evaluation from info string
      // Example: info depth 12 seldepth 15 multipv 1 score cp 35 ...
      if (typeof line === "string" && line.startsWith("info depth")) {
        const depthMatch = line.match(/depth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);

        if (depthMatch) {
          const depth = parseInt(depthMatch[1], 10);
          let evaluation: number | null = null;

          if (cpMatch) {
            evaluation = parseInt(cpMatch[1], 10);
          } else if (mateMatch) {
            const mateIn = parseInt(mateMatch[1], 10);
            // Mate score: use large value (10000 = mate)
            evaluation = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;
          }

          if (evaluation !== null) {
            // Stockfish returns eval from side-to-move perspective
            // We want it always from white's perspective (positive = white winning)
            // So flip the sign when it's black's turn
            // Use fenRef.current to get the current FEN (not stale closure value)
            const currentFen = fenRef.current;
            const isBlack = currentFen.split(" ")[1] === "b";
            const normalizedEval = isBlack ? -evaluation : evaluation;
            setState((s) => ({ ...s, evaluation: normalizedEval, depth }));
          }
        }
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Evaluate position when FEN changes
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !state.isReady || !fen) return;

    // Reset evaluation
    setState((s) => ({ ...s, evaluation: null, depth: 0 }));

    worker.postMessage("stop");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${targetDepth}`);
  }, [fen, state.isReady, targetDepth]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
  }, []);

  return { ...state, stop };
}
