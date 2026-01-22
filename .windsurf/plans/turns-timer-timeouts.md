# Turn Enforcement, Match Timer, and Timeout Forfeit
Implement strict alternating turns (white then black, etc.), add a match elapsed timer on the game page, and enforce a two-warning (20s total) timeout policy that forfeits the side if they exceed 10s twice.

## Summary
Ensure each tick processes exactly one side’s move (white -> black -> white ...), display elapsed match time, and apply a 10s-per-move timeout with a second timeout triggering forfeit.

## Plan
1) **Turn sequencing check**
   - Confirm current logic in `processGame` already uses FEN turn to pick the active side. Add logging/guards to ensure only the side to move is requested each tick.
   - Ensure no double-processing within one tick.

2) **Timeout policy (two strikes then forfeit)**
   - Per move: 10s limit (already partially enforced). Track consecutive timeouts per game side.
   - On first timeout: mark a warning (no move played).
   - On second consecutive timeout for that side: forfeit that side; end game.
   - Clear timeout counter when the side makes a valid move.
   - Optional: if you prefer a fallback move instead of warning, skip this and forfeit immediately on 2nd timeout (current fallback will be removed/disabled for this policy).

3) **Match timer (elapsed since start)**
   - Add a lightweight timer component on the home game view and game page, showing `HH:MM:SS` since `startedAt`.
   - Updates every second; uses game.startedAt.

4) **UI/UX**
   - Show timeout warnings/forfeit cause in logs and optionally a small label near the active match header.
   - Keep “Thinking...” only for the side to move.

## Open choices to confirm
- Timeout handling: we will remove fallback moves. On first timeout: warn; on second consecutive timeout: forfeit.
- Display timer on: home active match header and `/game/[id]` page.

## Acceptance
- White then black strictly alternate; no stuck “Thinking…” state.
- Elapsed timer visible and increments.
- Two consecutive timeouts for a side lead to forfeit within ~20s (10s each turn).
