# Codebase Cleanup & Refactoring Tasks

## Phase 1: Critical Fixes (P0)

### 1. Create Typed Error Classes
- [x] 1.1 Create `src/lib/errors.ts` with error class hierarchy
  - [x] 1.1.1 Implement `ChessError` base class
  - [x] 1.1.2 Implement `APIKeyError` class
  - [x] 1.1.3 Implement `RateLimitError` class
  - [x] 1.1.4 Implement `TimeoutError` class
  - [x] 1.1.5 Implement `InvalidMoveError` class
  - [x] 1.1.6 Implement `ParseError` class
- [x] 1.2 Update `src/lib/ai.ts` to throw typed errors
  - [x] 1.2.1 Add error detection for API key errors
  - [x] 1.2.2 Add error detection for rate limit errors
  - [x] 1.2.3 Add error detection for timeout errors
  - [x] 1.2.4 Throw `ParseError` when parsing fails
- [x] 1.3 Update `src/lib/game-processor.ts` to handle typed errors
  - [x] 1.3.1 Catch and handle `APIKeyError`
  - [x] 1.3.2 Catch and handle `RateLimitError`
  - [x] 1.3.3 Catch and handle `TimeoutError`
  - [x] 1.3.4 Catch and handle `ParseError`
- [x] 1.4 Write unit tests for error classes

### 2. Fix Race Condition in Game Start
- [x] 2.1 Update `src/app/api/games/start/route.ts` to use database transaction
  - [x] 2.1.1 Wrap game creation in transaction
  - [x] 2.1.2 Add `FOR UPDATE` lock on active game check
  - [x] 2.1.3 Add error handling for transaction failures
- [x] 2.2 Write integration test for concurrent game creation
- [x] 2.3 Test with multiple simultaneous requests

### 3. Add Error States to UI Components
- [x] 3.1 Update `src/components/game-grid.tsx`
  - [x] 3.1.1 Add error state for game fetching (currently silently logs errors)
  - [x] 3.1.2 Display error message in UI
  - [x] 3.1.3 Add retry button for failed fetches
- [x] 3.2 Update `src/components/leaderboard.tsx`
  - [x] 3.2.1 Add error state for leaderboard fetching (currently silently logs errors)
  - [x] 3.2.2 Display error message in UI
  - [x] 3.2.3 Add retry button for failed fetches
- [x] 3.3 Update `src/app/game/[id]/page.tsx`
  - [x] 3.3.1 Add error state for game detail fetching (currently shows "Loading..." indefinitely)
  - [x] 3.3.2 Display error message in UI

## Phase 2: Code Quality (P1)

### 4. Extract Shared Utilities
- [x] 4.1 Add utility functions to `src/lib/utils.ts`
  - [x] 4.1.1 Extract `formatElapsed()` function (duplicated in game-grid.tsx and game/[id]/page.tsx)
  - [x] 4.1.2 Extract `sanitizeId()` function (used in e2e tests and leaderboard)
  - [x] 4.1.3 Add JSDoc comments
  - [x] 4.1.4 Write unit tests
- [x] 4.2 Update `src/components/game-grid.tsx` to use shared `formatElapsed()`
- [x] 4.3 Update `src/app/game/[id]/page.tsx` to use shared `formatElapsed()`
- [x] 4.4 Update `e2e/single-game-flow.spec.ts` to use shared `sanitizeId()`

### 5. Create Shared Game Data Hook
- [x] 5.1 Create `src/hooks/use-game-data.ts`
  - [x] 5.1.1 Implement hook with loading/error states
  - [x] 5.1.2 Add auto-refresh functionality (currently duplicated in both components)
  - [x] 5.1.3 Add refetch function
  - [x] 5.1.4 Add JSDoc comments
- [x] 5.2 Update `src/components/game-grid.tsx` to use hook (replace fetchGames logic) - NOT APPLICABLE: Component has complex dual logic for active/previous games that doesn't fit the simple hook pattern
- [x] 5.3 Update `src/app/game/[id]/page.tsx` to use hook (replace fetchGame logic)

### 6. Add Input Validation
- [x] 6.1 Create `src/types/api.ts` with Zod schemas
  - [x] 6.1.1 Define `StartGameRequestSchema`
  - [x] 6.1.2 Define `SetAPIKeyRequestSchema`
  - [x] 6.1.3 Define `ToggleModelRequestSchema`
  - [x] 6.1.4 Define response type interfaces
- [x] 6.2 Update API routes to use validation
  - [x] 6.2.1 Update `/api/games/start/route.ts`
  - [x] 6.2.2 Update `/api/tournament/groq-key/route.ts`
  - [x] 6.2.3 Update `/api/tournament/gemini-key/route.ts`
  - [x] 6.2.4 Update `/api/models/active/route.ts`
- [x] 6.3 Write tests for validation failures

### 7. Create Bulk Fetch Endpoint
- [x] 7.1 Create `src/app/api/games/bulk/route.ts`
  - [x] 7.1.1 Implement bulk fetch with models (reduce N+1 query in game-grid.tsx)
  - [x] 7.1.2 Add query parameter validation
  - [x] 7.1.3 Add error handling
- [x] 7.2 Update `src/components/game-grid.tsx` to use bulk endpoint (replace Promise.all loop)
- [ ] 7.3 Measure performance improvement (currently 9 API calls: 1 list + 8 details)
- [x] 7.4 Write integration test

### 8. Add Debouncing
- [x] 8.1 Create `src/hooks/use-debounced-callback.ts`
  - [x] 8.1.1 Implement debounce hook
  - [x] 8.1.2 Add execution lock to prevent concurrent calls
  - [x] 8.1.3 Add JSDoc comments
- [x] 8.2 Update `src/components/game-grid.tsx` tick button (handleTickOnce has no debouncing)
- [x] 8.3 Update `src/app/game/[id]/page.tsx` tick button (handleTickOnce has no debouncing)
- [x] 8.4 Test rapid clicking behavior

## Phase 3: Cleanup (P2)

### 9. Remove Dead Code
- [x] 9.1 Remove or implement matchmaking
  - [x] 9.1.1 Decide: remove or implement (document decision) - DECISION: Removed as dead code
  - [x] 9.1.2 Delete `matchmake()` function from `src/lib/game-processor.ts`
  - [x] 9.1.3 Remove call from `src/app/api/cron/tick/route.ts`
  - [ ] 9.1.4 If implementing: add basic ELO-based matchmaking (NOT APPLICABLE)
- [x] 9.2 Remove unused tournament endpoints
  - [x] 9.2.1 Delete `/api/tournament/start/route.ts`
  - [x] 9.2.2 Delete `/api/tournament/stop/route.ts`
  - [x] 9.2.3 Update documentation
- [x] 9.3 Document utility scripts in README
  - [x] 9.3.1 Add section for development scripts
  - [x] 9.3.2 Document `simulate-match.ts`
  - [x] 9.3.3 Document `list-available-models.ts`
  - [x] 9.3.4 Document `model-healthcheck.ts`

### 10. Simplify AI Parsing
- [x] 10.1 Refactor `parseAIResponse()` in `src/lib/ai.ts`
  - [x] 10.1.1 Reduce to 3 strategies
  - [x] 10.1.2 Remove complex JSON fixing logic
  - [x] 10.1.3 Update comments
- [x] 10.2 Update tests for simplified parser
- [x] 10.3 Test with real AI responses

### 11. Add Configuration File
- [x] 11.1 Create `src/lib/config.ts`
  - [x] 11.1.1 Define `AI_TIMEOUTS` constants (GROQ_TIMEOUT_MS=7000, GEMINI_TIMEOUT_MS=15000, etc.)
  - [x] 11.1.2 Define `GAME_RULES` constants (MAX_JUDGE_ATTEMPTS=3, 25min time limit, etc.)
  - [x] 11.1.3 Define `ELO_CONFIG` constants (K_FACTOR=32, DEFAULT_RATING=1500)
  - [x] 11.1.4 Define `POLLING_INTERVALS` constants (2s game refresh, 5s leaderboard, 3s auto-tick)
  - [x] 11.1.5 Add JSDoc comments explaining each value
- [x] 11.2 Update `src/lib/ai.ts` to use config (replace hardcoded timeouts)
- [x] 11.3 Update `src/lib/game-processor.ts` to use config (replace MAX_JUDGE_ATTEMPTS, 25min limit)
- [x] 11.4 Update `src/lib/elo.ts` to use config (replace K=32)
- [x] 11.5 Update components to use config (replace polling intervals)

### 12. Rename Files
- [x] 12.1 Rename `src/lib/groq-key-store.ts` to `src/lib/api-key-store.ts` (file handles both Groq and Gemini keys)
- [x] 12.2 Update imports in `src/lib/game-processor.ts`
- [x] 12.3 Update imports in `src/app/api/tournament/groq-key/route.ts`
- [x] 12.4 Update imports in `src/app/api/tournament/gemini-key/route.ts`

### 13. Fix Database Schema
- [x] 13.1 Update `src/db/schema.ts` to import `STARTING_FEN` from chess.ts (currently hardcoded)
- [x] 13.2 Add timeout warning columns to games table
  - [x] 13.2.1 Create migration file in drizzle/ directory
  - [x] 13.2.2 Add `whiteTimeoutWarnings` column (integer, default 0)
  - [x] 13.2.3 Add `blackTimeoutWarnings` column (integer, default 0)
- [x] 13.3 Update `src/lib/game-processor.ts` to use database warnings
  - [x] 13.3.1 Remove in-memory `timeoutWarnings` Map (lost on server restart)
  - [x] 13.3.2 Read warnings from database in processGame()
  - [x] 13.3.3 Update warnings in database after timeout/success
- [x] 13.4 Run migration on development database
- [x] 13.5 Test warning persistence across server restarts

## Phase 4: Testing (P3)

### 14. Add API Route Tests
- [x] 14.1 Set up test database
- [x] 14.2 Write tests for `/api/games/start`
  - [x] 14.2.1 Test successful game creation
  - [x] 14.2.2 Test validation errors
  - [x] 14.2.3 Test concurrent requests
  - [x] 14.2.4 Test with inactive models
- [x] 14.3 Write tests for `/api/games/bulk`
  - [x] 14.3.1 Test successful bulk fetch
  - [x] 14.3.2 Test with no games
  - [x] 14.3.3 Test limit parameter
- [x] 14.4 Write tests for `/api/cron/tick`
  - [x] 14.4.1 Test with active games
  - [x] 14.4.2 Test with no active games
  - [x] 14.4.3 Test with tournament stopped

### 15. Add Error Path Tests
- [x] 15.1 Add tests for AI error handling
  - [x] 15.1.1 Test API key error
  - [x] 15.1.2 Test rate limit error
  - [x] 15.1.3 Test timeout error
  - [x] 15.1.4 Test parse error
- [x] 15.2 Add tests for game processor errors
  - [x] 15.2.1 Test forfeit on repeated timeouts
  - [x] 15.2.2 Test game cancellation on API key error
  - [x] 15.2.3 Test illegal move handling
- [x] 15.3 Add tests for chess logic edge cases
  - [x] 15.3.1 Test checkmate detection
  - [x] 15.3.2 Test stalemate detection
  - [x] 15.3.3 Test invalid FEN handling

### 16. Add Integration Tests
- [x] 16.1 Write full game flow test
  - [x] 16.1.1 Test game creation
  - [x] 16.1.2 Test move processing
  - [x] 16.1.3 Test game completion
  - [x] 16.1.4 Test ELO updates
- [x] 16.2 Write concurrent game test
  - [x] 16.2.1 Test multiple simultaneous game start requests
  - [x] 16.2.2 Verify only one game created
- [x] 16.3 Write timeout scenario test
  - [x] 16.3.1 Mock AI timeout
  - [x] 16.3.2 Verify warning increment
  - [x] 16.3.3 Verify forfeit after 2 warnings

## Documentation Tasks

### 17. Update Documentation
- [x] 17.1 Update README.md
  - [x] 17.1.1 Add section on error handling
  - [x] 17.1.2 Add section on development scripts
  - [x] 17.1.3 Add section on configuration
- [x] 17.2 Add ARCHITECTURE.md
  - [x] 17.2.1 Document error handling architecture
  - [x] 17.2.2 Document game processing flow
  - [x] 17.2.3 Document AI integration
- [x] 17.3 Add inline code comments
  - [x] 17.3.1 Add JSDoc to all public functions
  - [x] 17.3.2 Add comments for complex logic
  - [x] 17.3.3 Add comments for magic numbers

## Verification Tasks

### 18. Final Verification
- [x] 18.1 Run all tests
  - [x] 18.1.1 Unit tests pass
  - [x] 18.1.2 Integration tests pass
  - [x] 18.1.3 E2E tests pass
- [x] 18.2 Check code quality
  - [x] 18.2.1 No TypeScript errors
  - [x] 18.2.2 No ESLint warnings
  - [x] 18.2.3 No console.log statements (except intentional logging)
- [ ] 18.3 Performance verification
  - [ ] 18.3.1 Measure API call reduction
  - [ ] 18.3.2 Measure page load time
  - [ ] 18.3.3 Verify no memory leaks
- [ ] 18.4 Manual testing
  - [ ] 18.4.1 Test game creation flow
  - [ ] 18.4.2 Test error scenarios
  - [ ] 18.4.3 Test concurrent operations
  - [ ] 18.4.4 Test on production-like environment