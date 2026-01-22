# Timers + 10s Move Deadline + Gemini Save Button Fix
Implement a match elapsed timer, enforce a 10-second per-move server-side deadline to prevent stuck games, and fix the Gemini key save button state.

## Scope
- Fix UI bug where the Gemini save button uses the wrong loading/disabled state.
- Show a match elapsed timer (from `game.startedAt`) on the main screen and/or game page.
- Ensure each model has **<= 10 seconds** to produce a move when it is their turn, so the game does not get stuck on “Thinking…”.

## Key Decisions Needed (Confirm)
- **Timeout behavior**: On a 10s timeout, do you prefer:
  - (A) **Fallback** to a deterministic legal move (recommended: first legal move) and continue, or
  - (B) **Forfeit** the timed-out player.
- **Timer placement**: Should the match elapsed timer appear:
  - (A) On the home page above the active match card, and also on `/game/[id]`, or
  - (B) Only on `/game/[id]`?

## Plan
1) **Fix Gemini button saving state**
   - Update `Leaderboard` so the Gemini save button uses `geminiSaving` for:
     - `disabled` state
     - button label (“Saving…”)
   - Keep Groq save on `saving`.

2) **Match elapsed timer UI (match start timer)**
   - Add a small client-side timer component that:
     - Takes `startedAt`
     - Updates once per second
     - Displays `MM:SS` (or `HH:MM:SS` if long)
   - Render it near the active match header (home) and optionally on the game page.

3) **10-second per-move server deadline**
   - Enforce a strict time budget around the move generation call:
     - Wrap `requestMove` in a `Promise.race` with a 10s timeout.
     - For Groq fetch calls: use `AbortController` to cancel the HTTP request.
     - For Gemini / AI SDK calls: use `Promise.race` timeout even if underlying request can’t be aborted.
   - Adjust existing retry logic so the **total** time per tick cannot exceed 10s (e.g., 1 attempt only within budget, or multiple attempts with smaller per-attempt limits).

4) **Prevent “black stuck thinking” UX**
   - If timeout/fallback occurs, store a move so FEN advances and the UI stops showing the other side “Thinking…” indefinitely.
   - (Optional, follow-up) Introduce a DB/UI “processing” flag to only show “Thinking…” during an active tick; otherwise show “Waiting for tick…”. (No schema change in this plan unless you request it.)

## Acceptance Criteria
- Gemini save button correctly shows its own saving state and does not get blocked by Groq saving.
- Match elapsed time is visible and increments from game start.
- On any tick where it’s a model’s turn, the server returns within ~10s and the game either:
  - records a legal move (normal), or
  - records a fallback move (if selected), or
  - ends via forfeit (if selected).
- No more indefinite “Thinking…” with zero moves after a tick.
