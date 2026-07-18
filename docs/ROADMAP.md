# Contribution Roadmap

A prioritized plan for contributing to LLM Chess Arena. Two parts:

1. **[Fixes](#fixes)** — confirmed correctness/security defects. Land these first; feature work builds on correctly-terminated, trustworthy games.
2. **[Value-adding features](#value-adding-features)** — new capabilities that meaningfully improve the project's core mission: **benchmarking LLMs at chess**.

Each item lists the value, the approach, and the files to touch. Effort: **S** (hours), **M** (a day or two), **L** (multi-day).

## Status (branch `feat/fixes-and-features`)

Landed and verified (`pnpm typecheck` + `pnpm test` = 121 passing + `pnpm build` all green):

- ✅ **F1** game-over detection (`loadPgn` + fallback) with 6 new termination tests
- ✅ **F2** recent-moves ordering (recency desc + reverse)
- ✅ **F3** serverless-safe processing claim (atomic `UPDATE … RETURNING` + migration `0006`)
- ✅ **F4** auth: `requireAdmin` on reset/key-setters, `requireCron` on tick, tick null-guard + atomic `tickCount`
- ✅ **F5** at-rest encryption for keys (`crypto.ts`, opt-in via `ENCRYPTION_KEY`) + removed leaky module cache
- ✅ **F6** input validation (status enum on list routes, self-play rejected at schema)
- ✅ **V1** Anthropic + direct OpenAI provider adapters + seeded models
- ✅ **CI** GitHub Actions (typecheck/test/build gating; lint non-blocking) + Vitest/e2e split
- ⏳ **V2–V9** not started (see below); **F5** UI for admin auth is follow-up.

---

## Fixes

### F1 — Game-over detection is broken *(S, critical)*
`isGameOver` / `getGameResult` / `getGameEndReason` in [`src/lib/chess.ts`](../src/lib/chess.ts) do `pgn ? new Chess(pgn) : new Chess(fen)`. In chess.js 1.x the constructor only accepts a **FEN** — passing a PGN throws `Invalid FEN`. These are called with the PGN on every move at [`game-processor.ts:200-202`](../src/lib/game-processor.ts#L200), so clean termination (checkmate, stalemate, threefold, 50-move, insufficient material) never fires. Games instead limp to timeout/forfeit or the 25-minute TTL draw — **silently corrupting every result and every ELO update.**

- **Fix:** `const c = new Chess(); c.loadPgn(pgn);` with a try/catch fallback to the FEN path.
- **Tests:** add PGNs to [`chess.test.ts`](../src/lib/chess.test.ts) asserting checkmate, stalemate, threefold repetition, 50-move, and insufficient-material outcomes. No current test passes a PGN — which is why this went unnoticed.
- **Files:** `src/lib/chess.ts`, `src/lib/chess.test.ts`

### F2 — "Recent moves" context reads the opening *(S, high)*
[`game-processor.ts:75-76`](../src/lib/game-processor.ts#L75) selects `.orderBy(moves.moveNumber).limit(10)` — ascending, so it returns the **first** 10 plies. After ~10 plies the prompt's move history and all repetition detection operate on stale opening moves.

- **Fix:** order **descending**, `limit(10)`, then `.reverse()` for chronological display.
- **Files:** `src/lib/game-processor.ts`

### F3 — In-memory processing lock is useless on serverless *(M, high)*
The `processingGames` Map at [`game-processor.ts:14`](../src/lib/game-processor.ts#L14) gives zero cross-instance protection. Overlapping cron ticks — or multiple browser tabs each firing the 8s auto-tick — can read the same FEN and double-insert moves.

- **Fix:** per-game Postgres advisory lock (`SELECT pg_advisory_xact_lock(hashtext(game_id))`) or an atomic `UPDATE games SET processing=true WHERE id=$1 AND processing=false RETURNING` claim.
- **Files:** `src/lib/game-processor.ts`, `src/db/schema.ts`

### F4 — Mutating endpoints are unauthenticated *(M, critical)*
`POST /api/tournament/reset` wipes **all** moves, **all** games, and resets every model's ELO to 1500 with no auth. `games/start` burns provider quota; the key-setting routes overwrite global keys; `cron/tick` explicitly allows all requests and never checks the `CRON_SECRET` already documented in `.env.example`.

- **Fix:** a `requireAdmin(request)` helper + `Authorization: Bearer $CRON_SECRET` on the tick, enforced centrally via `src/middleware.ts`.
- **Files:** `src/middleware.ts`, `src/lib/auth.ts`, `src/app/api/tournament/reset/route.ts`, the key-setting routes, `src/app/api/cron/tick/route.ts`, `src/app/api/games/{start,destroy}/route.ts`

### F5 — API keys stored plaintext and shared across visitors *(M, high)*
Keys live unencrypted in `tournament`/`games` rows, and [`api-key-store.ts`](../src/lib/api-key-store.ts) caches them in module-level singletons shared across all requests on a warm serverless instance — so **one visitor's key can be served to another.**

- **Fix:** encrypt at rest (AES-GCM with a server secret) or keep keys request-scoped; replace the module-global cache with a request-scoped/namespaced one; stop logging key-presence.
- **Files:** `src/lib/api-key-store.ts`, `src/db/schema.ts`, the key-setting routes

### F6 — Input validation & self-play *(S, medium)*
`games/route.ts` and `games/bulk` cast `?status` straight to the Postgres enum (so `?status=foo` reaches the DB and 500s), and `games/start` accepts `modelIds=[a,a]`, letting a model play itself.

- **Fix:** zod-validate the status param, wrap route bodies in try/catch, reject `whiteId === blackId`.
- **Files:** `src/app/api/games/route.ts`, `src/app/api/games/bulk/route.ts`, `src/app/api/games/start/route.ts`, `src/types/api.ts`

---

## Value-adding features

Ordered by value-to-the-mission. The first three turn a bundled-but-wasted engine and single-provider demo into a real, multi-model benchmark.

### V1 — Wire Anthropic + direct OpenAI providers *(M, very high)*
**Value:** the project's entire premise is "which LLM plays better chess," yet only Groq and Google Gemini are wired. `@ai-sdk/anthropic` is a shipped dependency **that is never imported**, and `@ai-sdk/openai`'s `createOpenAI` is used *only* as a Groq client (baseURL override) — so **Claude and GPT literally cannot play.** Adding them roughly doubles the roster and makes the leaderboard actually interesting.

**Approach:** introduce a provider-adapter map keyed by model prefix (`anthropic/`, `openai/`, `groq/`, `google/`) instead of the current `isGroq/isGoogle/else` chain in [`requestMove`](../src/lib/ai.ts#L322). Each adapter: create client, call `generateText`, apply the provider timeout. Add key storage + the models to the seed.

**Files:** `src/lib/ai.ts`, `src/lib/api-key-store.ts`, `src/db/schema.ts`, `src/db/seed.ts`, `src/app/api/tournament/api-keys/route.ts`

### V2 — Persist Stockfish eval → accuracy & centipawn-loss benchmark *(L, very high)*
**Value:** this is the feature that turns the app from "watch bots move" into a **benchmark**. Stockfish already runs — but only client-side in a browser worker at depth 12 ([`use-stockfish.ts`](../src/hooks/use-stockfish.ts)), purely for a cosmetic eval bar, and the number is **thrown away on every position change**. Capturing it yields per-model **average centipawn loss (ACPL)**, **accuracy %**, and **blunder rate** — the standard, respected way to rank chess strength, far more informative than win/loss alone.

**Approach:**
- Add `moves.evalCpBefore`, `moves.evalCpAfter`, `moves.cpLoss`, `moves.annotation`, `moves.thinkMs`.
- Compute `cpLoss` per move (drop in eval from the moving side's perspective). Run engine server-side in the tick (headless `stockfish` npm worker) at a fixed depth, or have the client POST the eval it already computes.
- Roll up per-model **avg CPL / accuracy% / blunder-rate** on the leaderboard.

**Files:** `src/db/schema.ts`, `src/lib/analysis.ts` (new), `src/lib/game-processor.ts`, `src/hooks/use-stockfish.ts`, `src/app/api/analytics/accuracy/route.ts` (new), `src/components/leaderboard.tsx`

### V3 — Per-move token usage, latency & cost tracking *(M, high)*
**Value:** adds benchmark dimensions ELO can't capture: **cost-per-win**, **tokens-per-move**, **time-per-move**. Directly answers "is the expensive model worth it?" — the question people actually run these comparisons to answer. The AI SDK already returns `usage`; the code discards it.

**Approach:** capture `result.usage` in `ai.ts`, add `promptTokens`/`completionTokens`/`latencyMs`/`costUsd` to `moves`, compute cost from a per-model rate table, aggregate per model.

**Files:** `src/db/schema.ts`, `src/lib/ai.ts`, `src/lib/game-processor.ts`, `src/lib/models-registry.ts` (new)

### V4 — Move-quality annotations (?? ?! ! !! best) *(M, high)*
**Value:** the single most-requested chess-viewer feature. Once V2 stores `cpLoss`, classify each move (blunder / mistake / inaccuracy / good / brilliant) and render NAG symbols in the reasoning panel — makes an LLM's blunders legible at a glance and pairs the *stated* reasoning with its *actual* quality.

**Files:** `src/lib/analysis.ts`, `src/components/reasoning-panel.tsx`, `src/db/schema.ts`

### V5 — Capture the real reasoning trace *(M, high, differentiator)*
**Value:** the app's unique angle is showing *why* a model moved. Today it only stores the model's **self-reported** JSON `reasoning`; the SDK's genuine chain-of-thought (`result.reasoning` / `reasoningText` from thinking models like gpt-oss, deepseek-r1, gemini-thinking) is discarded. Persisting the real trace enables actual reasoning-quality analysis and a much richer move inspector.

**Approach:** capture `reasoningText` in `ai.ts`, store in a new `moves.thinking` column (distinct from self-reported `reasoning`), show in the move inspector.

**Files:** `src/lib/ai.ts`, `src/lib/game-processor.ts`, `src/db/schema.ts`, `src/components/reasoning-panel.tsx`

### V6 — Automated round-robin matchmaking + concurrent games *(L, very high)*
**Value:** the headline missing feature. The "tournament" is a single `id=1` row (a run/stop flag + tick counter) with **no matchmaking** — an operator hand-starts each game and only one board runs at a time. A real scheduler makes it an actual tournament that runs itself.

**Approach:** add `tournaments` / `fixtures` tables and `src/lib/matchmaker.ts` that generates a color-balanced round-robin schedule; the tick auto-starts the next pending fixture up to a max-concurrency limit (needs F3's real lock first).

**Files:** `src/db/schema.ts`, `src/lib/matchmaker.ts` (new), `src/app/api/cron/tick/route.ts`, `src/app/api/games/start/route.ts`

### V7 — Glicko-2 rating system *(L, high)*
**Value:** fixed-K=32 ELO ([`elo.ts`](../src/lib/elo.ts)) has no notion of uncertainty and converges poorly with the few, high-variance games LLMs actually play. Glicko-2 adds rating deviation + volatility — exactly what a low-sample benchmark needs — and lets the leaderboard sort by a conservative rating with a proper ± interval.

**Approach:** add `ratingDeviation` / `volatility` columns, implement `src/lib/glicko2.ts`, display `rating ± RD`, keep ELO available for comparison. Also worth pairing: a `rating_history` table + Elo-over-time chart (today the leaderboard delta is ephemeral client state lost on reload).

**Files:** `src/lib/glicko2.ts` (new), `src/lib/config.ts`, `src/db/schema.ts`, `src/lib/game-processor.ts`, `src/components/leaderboard.tsx`

### V8 — Realtime updates via Server-Sent Events *(L, high)*
**Value:** replaces the current polling storm (1s game poll + 8s client auto-tick across every open tab) with a push model. Cuts Vercel edge-request burn, removes a real source of the F3 concurrency problem, and keeps shared games live without an open tab driving them.

**Approach:** `GET /api/games/[id]/stream` emitting `text/event-stream` on move/status change + a `useGameStream` hook to retire the polling in `use-game-data.ts`.

**Files:** `src/app/api/games/[id]/stream/route.ts` (new), `src/hooks/use-game-data.ts`, `src/app/game/[id]/page.tsx`, `src/app/page.tsx`

### V9 — Responsive board + accessibility pass *(M, high)*
**Value:** the board views use a fixed `grid-cols-12` 3|6|3 with no breakpoints — effectively unusable on phones — and the move history is `onClick` `<div>`s with no keyboard/screen-reader support. A spectator app should be watchable on a phone and by everyone.

**Approach:** stack panels vertically below `md`, swap fixed heights for reflowing min-heights; convert move rows to real `<button>`s, add an `aria-live` region announcing moves/turn/result, label the eval bar, add table `scope`/`caption`.

**Files:** `src/app/page.tsx`, `src/app/game/[id]/page.tsx`, `src/components/reasoning-panel.tsx`, `src/components/leaderboard.tsx`, `src/components/eval-bar.tsx`

---

## Suggested sequence

1. **F1 + tests** — restore correct game termination (everything downstream depends on it).
2. **CI** (GitHub Actions: lint + `tsc --noEmit` + `pnpm test` + build) so fixes stay protected.
3. **F3, F4** — the two structural/security holes.
4. **V1** — unlock the multi-provider roster.
5. **V2 → V4** — the benchmark analytics stack (eval → cost → annotations).
6. **V6 → V8** — automation, ratings, realtime.
