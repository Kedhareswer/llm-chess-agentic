"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { ModelSelector, SKILL_MODES, type SkillMode } from "@/components/model-selector";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { EvalBar } from "@/components/eval-bar";
import { STARTING_FEN } from "@/lib/chess";
import { formatElapsed } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { POLLING_INTERVALS } from "@/lib/config";
import { usePageVisibility } from "@/hooks/use-page-visibility";
import { useSettings } from "@/contexts/settings-context";
import { useLeaderboard } from "@/contexts/leaderboard-context";
import { useChessSounds } from "@/hooks/use-chess-sounds";
import { Chess } from "chess.js";
import type { Game, Move, Model } from "@/db/schema";

type GameState = "setup" | "active" | "finished";

interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export default function Home() {
  const { openSettings } = useSettings();
  const visible = usePageVisibility();

  // Game state
  const [gameState, setGameState] = useState<GameState>("setup");
  const [whiteModelId, setWhiteModelId] = useState<string | null>(null);
  const [blackModelId, setBlackModelId] = useState<string | null>(null);
  const [whiteMode, setWhiteMode] = useState<SkillMode>("scholar");
  const [blackMode, setBlackMode] = useState<SkillMode>("scholar");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const { models } = useLeaderboard();
  const { sounds } = useChessSounds();

  // UI state
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [tickInfo, setTickInfo] = useState<string | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [viewPosition, setViewPosition] = useState<string | null>(null);
  const [previousFen, setPreviousFen] = useState<string | null>(null);
  const [previousMoveCount, setPreviousMoveCount] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check for existing active game on mount
  useEffect(() => {
    async function checkActiveGame() {
      try {
        const res = await fetch("/api/games?status=active");
        if (!res.ok) return;
        const data = await res.json();
        const activeGame = data.games?.[0];
        if (activeGame) {
          setActiveGameId(activeGame.id);
          setGameState("active");
        }
      } catch {
        // Ignore errors on initial check
      }
    }
    checkActiveGame();
  }, []);

  const previousMoveCountRef = useRef<number>(0);
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch game data when we have an active game
  const fetchGameData = useCallback(async () => {
    if (!activeGameId) return;
    try {
      const res = await fetch(`/api/games/${activeGameId}`);
      if (!res.ok) return;
      const data = await res.json();
      const currentMoveCount = data.moves?.length || 0;
      const previousMoveCount = previousMoveCountRef.current;
      const wasActive = gameData?.game?.status === "active";
      
      setGameData(data);
      previousMoveCountRef.current = currentMoveCount;

      // Check if game finished
      if (data.game.status === "complete") {
        setGameState("finished");
      }
      
      // If move count increased and game is active, schedule immediate refetch to catch rapid moves
      if (currentMoveCount > previousMoveCount && wasActive && data.game?.status === "active") {
        // Clear any pending timeout
        if (refetchTimeoutRef.current) {
          clearTimeout(refetchTimeoutRef.current);
        }
        // Schedule immediate refetch after a short delay to catch the next move
        refetchTimeoutRef.current = setTimeout(() => {
          fetchGameData();
        }, 300);
      }
    } catch {
      // Ignore fetch errors
    }
  }, [activeGameId, gameData?.game?.status]);

  // Poll for game updates (slower when tab hidden or game complete)
  useEffect(() => {
    if (!activeGameId) return;
    fetchGameData();
    const ms = visible
      ? gameData?.game?.status === "complete"
        ? POLLING_INTERVALS.COMPLETED_GAME_REFRESH_MS
        : POLLING_INTERVALS.GAME_REFRESH_MS
      : POLLING_INTERVALS.WHEN_TAB_HIDDEN_MS;
    const interval = setInterval(fetchGameData, ms);
    return () => {
      clearInterval(interval);
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, [activeGameId, fetchGameData, visible, gameData?.game?.status]);

  // Auto-tick for active games; refetch game data immediately after tick so the board updates with no lag
  useEffect(() => {
    if (gameState !== "active" || !activeGameId) return;

    const tickInterval = setInterval(async () => {
      try {
        await fetch("/api/cron/tick");
        await fetchGameData();
      } catch {
        // Silently ignore tick errors
      }
    }, POLLING_INTERVALS.AUTO_TICK_MS);

    return () => clearInterval(tickInterval);
  }, [gameState, activeGameId, fetchGameData]);

  // Elapsed timer
  useEffect(() => {
    if (!gameData?.game?.startedAt) {
      setElapsed("00:00");
      return;
    }
    const started = new Date(gameData.game.startedAt).getTime();
    const isComplete = gameData.game.status === "complete" && gameData.game.endedAt;
    const endTime = isComplete ? new Date(gameData.game.endedAt!).getTime() : Date.now();

    setElapsed(formatElapsed(endTime - started));

    if (!isComplete) {
      const timer = setInterval(() => {
        setElapsed(formatElapsed(Date.now() - started));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameData?.game?.startedAt, gameData?.game?.status, gameData?.game?.endedAt]);

  // Start game handler
  async function handleStartGame() {
    if (!whiteModelId || !blackModelId) {
      setStartError("Please select models for both sides");
      return;
    }

    setStartError(null);

    // Find selected models to check their providers
    const whiteModel = models.find(m => m.id === whiteModelId);
    const blackModel = models.find(m => m.id === blackModelId);

    if (!whiteModel || !blackModel) {
      setStartError("Selected models not found");
      return;
    }

    // Check which API keys are needed
    const needsGroq = whiteModel.provider === "groq" || blackModel.provider === "groq";
    const needsGemini = whiteModel.provider === "google" || blackModel.provider === "google";

    // Check if required API keys are set
    if (needsGroq || needsGemini) {
      try {
        const keysRes = await fetch("/api/tournament/api-keys");
        if (keysRes.ok) {
          const keys = await keysRes.json();
          
          if (needsGroq && !keys.groqApiKey) {
            openSettings();
            setStartError("Groq API key is required for the selected models. Please add it in Settings.");
            return;
          }
          
          if (needsGemini && !keys.geminiApiKey) {
            openSettings();
            setStartError("Gemini API key is required for the selected models. Please add it in Settings.");
            return;
          }
        }
      } catch {
        // If check fails, proceed anyway (keys might be in env)
      }
    }

    setStarting(true);

    try {
      // Ensure selected models are active
      await Promise.all([
        fetch("/api/models/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: whiteModelId, active: true }),
        }),
        fetch("/api/models/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: blackModelId, active: true }),
        }),
      ]);

      // Start the game - white model first, then black
      // Include skill modes in the request
      const res = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          modelIds: [whiteModelId, blackModelId],
          whiteMode,
          blackMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start game");
      }

      // Trigger first tick
      await fetch("/api/cron/tick", { method: "POST" }).catch(() => {});

      // Set active game
      setActiveGameId(data.gameId || data.id);
      setGameState("active");
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start game");
    } finally {
      setStarting(false);
    }
  }

  // Manual tick handler
  const handleTickOnce = useDebouncedCallback(async () => {
    setTickInfo(null);
    try {
      const res = await fetch("/api/cron/tick");
      if (!res.ok) {
        setTickInfo(`Tick failed: ${res.status}`);
        return;
      }
      setTickInfo("Ticked");
      await fetchGameData();
    } catch (e) {
      setTickInfo(`Tick error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, 1000);

  // New game handler
  function handleNewGame() {
    setGameState("setup");
    setActiveGameId(null);
    setGameData(null);
    setWhiteModelId(null);
    setBlackModelId(null);
    setWhiteMode("scholar");
    setBlackMode("scholar");
    setSelectedMoveId(null);
    setViewPosition(null);
    setElapsed("00:00");
  }

  // Move selection handlers
  const handleMoveClick = (moveId: string) => setSelectedMoveId(moveId);
  const handleViewSnapshot = (fen: string) => setViewPosition(fen);
  const handleBackToCurrent = () => {
    setViewPosition(null);
    setSelectedMoveId(null);
  };

  // Determine board position and turn
  const boardPosition = viewPosition || gameData?.game?.fen || STARTING_FEN;
  const isWhiteTurn = boardPosition.split(" ")[1] === "w";

  // Track FEN changes to trigger animations and sounds
  useEffect(() => {
    const currentFen = gameData?.game?.fen;
    const currentMoveCount = gameData?.moves?.length || 0;
    
    // Only play sounds when:
    // 1. We're viewing the current position (not historical)
    // 2. A new move was actually added (move count increased)
    // 3. FEN changed
    const isNewMove = currentMoveCount > previousMoveCount;
    const isCurrentPosition = !viewPosition;
    const fenChanged = currentFen && previousFen && currentFen !== previousFen;
    
    if (fenChanged && isCurrentPosition) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 350);
      
      // Only play sound if a new move was actually applied
      if (isNewMove && sounds && gameData?.moves) {
        try {
          const chess = new Chess(previousFen);
          const latestMove = gameData.moves[gameData.moves.length - 1];
          
          if (latestMove) {
            const moveSan = latestMove.moveSan;
            const chessAfter = new Chess(currentFen);
            
            // Check for checkmate first
            if (chessAfter.isCheckmate()) {
              sounds.playCheckmate();
            }
            // Check for check
            else if (chessAfter.isCheck()) {
              sounds.playCheck();
            }
            // Check for capture (contains 'x' in SAN)
            else if (moveSan.includes('x')) {
              sounds.playCapture();
            }
            // Check for castling
            else if (moveSan === 'O-O' || moveSan === 'O-O-O') {
              sounds.playCastle();
            }
            // Check for promotion (contains '=')
            else if (moveSan.includes('=')) {
              sounds.playPromotion();
            }
            // Regular move
            else {
              sounds.playMove();
            }
          }
        } catch (error) {
          // Fallback to regular move sound if analysis fails
          sounds.playMove();
        }
      }
      
      return () => clearTimeout(timer);
    }
    
    // Update previous state
    if (currentFen) {
      setPreviousFen(currentFen);
    }
    if (currentMoveCount !== undefined) {
      setPreviousMoveCount(currentMoveCount);
    }
  }, [gameData?.game?.fen, gameData?.moves?.length, previousFen, previousMoveCount, viewPosition, sounds]);
  const isActive = gameState === "active";

  // Clear error when both models are selected (but not API key errors)
  useEffect(() => {
    if (whiteModelId && blackModelId && startError && !startError.includes("API key")) {
      setStartError(null);
    }
  }, [whiteModelId, blackModelId, startError]);

  // Get mode names for display
  const whiteModeData = SKILL_MODES.find(m => m.id === whiteMode);
  const blackModeData = SKILL_MODES.find(m => m.id === blackMode);

  return (
    <div className="h-full flex flex-col">
      {/* Setup State */}
      {gameState === "setup" && (
        <div className="flex-1 grid grid-cols-12 gap-0 h-full">
          {/* Left panel - White selector */}
          <div className="col-span-3 border-r border-gray-200 h-full overflow-hidden">
            <ModelSelector
              color="white"
              selectedModelId={whiteModelId}
              selectedMode={whiteMode}
              onSelectModel={setWhiteModelId}
              onSelectMode={setWhiteMode}
              disabled={starting}
            />
          </div>

          {/* Center - Board and start button */}
          <div className="col-span-6 flex flex-col items-center justify-center p-8 bg-gray-50">
            <div className="w-full max-w-lg">
              {/* Board preview */}
              <div className="aspect-square w-full mb-6 shadow-lg rounded-lg overflow-hidden">
                <Chessboard
                  options={{
                    position: STARTING_FEN,
                    allowDragging: false,
                  }}
                />
              </div>

              {/* Start button */}
              <button
                onClick={handleStartGame}
                disabled={starting || !whiteModelId || !blackModelId}
                className={`
                  w-full py-4 text-lg font-bold rounded-lg transition-all
                  ${starting || !whiteModelId || !blackModelId
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-black text-white hover:bg-gray-800 hover:scale-[1.02]"
                  }
                `}
              >
                {starting ? "Starting..." : "Start Match"}
              </button>

              {/* Error message */}
              {startError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
                  {startError}
                </div>
              )}

              {/* Selection status */}
              <div className="mt-4 text-center text-sm text-gray-500">
                {!whiteModelId && !blackModelId && "Select models for White and Black"}
                {whiteModelId && !blackModelId && "Now select a model for Black"}
                {!whiteModelId && blackModelId && "Now select a model for White"}
                {whiteModelId && blackModelId && (
                  <span className="text-green-600">
                    Ready! White ({whiteModeData?.name}) vs Black ({blackModeData?.name})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right panel - Black selector */}
          <div className="col-span-3 border-l border-gray-200 h-full overflow-hidden">
            <ModelSelector
              color="black"
              selectedModelId={blackModelId}
              selectedMode={blackMode}
              onSelectModel={setBlackModelId}
              onSelectMode={setBlackMode}
              disabled={starting}
            />
          </div>
        </div>
      )}

      {/* Active / Finished State */}
      {(gameState === "active" || gameState === "finished") && gameData && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {elapsed}
              </span>
              {gameData.game.result && (
                <span className="text-sm font-semibold px-2 py-0.5 bg-gray-100 rounded">
                  {gameData.game.result}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isActive && (
                <button
                  onClick={handleTickOnce}
                  className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50"
                >
                  Tick
                </button>
              )}
              {gameState === "finished" && (
                <button
                  onClick={handleNewGame}
                  className="px-4 py-1.5 text-sm font-semibold bg-black text-white rounded hover:bg-gray-800"
                >
                  New Game
                </button>
              )}
            </div>
          </div>

          {/* Tick info */}
          {tickInfo && (
            <div className="px-4 py-2 text-xs text-center bg-blue-50 border-b border-blue-200">
              {tickInfo}
            </div>
          )}

          {/* Match finished banner */}
          {gameState === "finished" && gameData.game.result && (
            <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-200">
              <div className="text-center">
                <div className="text-lg font-bold mb-1">
                  {gameData.game.result === "1-0" && (
                    <span className="text-green-700">{gameData.white.name} wins!</span>
                  )}
                  {gameData.game.result === "0-1" && (
                    <span className="text-red-700">{gameData.black.name} wins!</span>
                  )}
                  {gameData.game.result === "1/2-1/2" && (
                    <span className="text-gray-700">Draw</span>
                  )}
                </div>
                {gameData.game.resultReason && (
                  <p className="text-sm text-gray-600">
                    Reason: {gameData.game.resultReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Game grid */}
          <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
            {/* Left panel - White */}
            <div
              className={`col-span-3 border-r-2 overflow-y-auto ${
                isActive && isWhiteTurn ? "border-yellow-400 bg-yellow-50/30" : "border-gray-200"
              }`}
            >
              <ReasoningPanel
                model={gameData.white}
                moves={gameData.moves}
                color="white"
                isThinking={isActive && isWhiteTurn}
                selectedMoveId={selectedMoveId}
                onMoveClick={handleMoveClick}
                onViewSnapshot={handleViewSnapshot}
              />
            </div>

            {/* Center - Board */}
            <div className="col-span-6 flex flex-col items-center justify-center p-4 bg-gray-50">
              {viewPosition && viewPosition !== gameData.game.fen && (
                <button
                  onClick={handleBackToCurrent}
                  className="mb-2 px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-white"
                >
                  Back to Current
                </button>
              )}
              <div className="flex items-center justify-center gap-2 h-full max-h-[calc(100vh-200px)]">
                <div className="h-full max-h-[600px]">
                  <EvalBar fen={boardPosition} />
                </div>
                <div className={`aspect-square h-full max-h-[600px] ${isAnimating ? 'chessboard-animating' : ''}`}>
                  <Chessboard
                    options={{
                      position: boardPosition,
                      allowDragging: false,
                      animationDurationInMs: 300,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right panel - Black */}
            <div
              className={`col-span-3 border-l-2 overflow-y-auto ${
                isActive && !isWhiteTurn ? "border-yellow-400 bg-yellow-50/30" : "border-gray-200"
              }`}
            >
              <ReasoningPanel
                model={gameData.black}
                moves={gameData.moves}
                color="black"
                isThinking={isActive && !isWhiteTurn}
                selectedMoveId={selectedMoveId}
                onMoveClick={handleMoveClick}
                onViewSnapshot={handleViewSnapshot}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading state for active game */}
      {(gameState === "active" || gameState === "finished") && !gameData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading game...</div>
        </div>
      )}
    </div>
  );
}
