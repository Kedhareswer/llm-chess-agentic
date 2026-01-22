# Destroy Match Control
Add a user-facing "Destroy match" control that immediately deletes the current active game and its moves without recording a result, keeping the UI state consistent.

## Objectives
- Provide a safe API endpoint to delete the single active game and its moves (no ELO/result updates).
- Expose a UI button near the active game card to trigger destruction and refresh the game list.
- Handle empty state gracefully (no active game) and avoid errors in polling.

## Plan
1) **API endpoint**: Create `/api/games/destroy` (POST) that finds the active game; if present, delete its moves then delete the game; return success with deleted flag; if none, return success with deleted:0. Ensure idempotent and no ELO/result side effects.
2) **UI wiring in GameGrid**: Add a small header row above the card grid with a "Destroy match" button (data-testid). On click, call the destroy endpoint, show short status text, and trigger a refetch of active games. Disable button when destroying or when no active game is loaded.
3) **Refresh behavior**: After destruction, reuse existing polling/`fetchGames` to clear the card and show the empty state message. Keep styles minimal and consistent with current layout.

## Notes
- Only one active game is supported; endpoint assumes single active record.
- No DB migration needed; pure API + UI changes.
- Ensure no ELO or result updates occur on destroy.
