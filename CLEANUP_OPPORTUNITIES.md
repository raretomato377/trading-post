# Codebase Cleanup Opportunities - High ROI

## 🔴 High Priority (Quick Wins)

### 1. **Remove Unused/Deprecated Functions**
- **`useBeginGame`** (line 344 in `use-trading-game.ts`) - Deprecated, only wraps `useStartGame`. **Remove entirely.**
- **`useTransitionToResolution`** (line 513 in `use-trading-game.ts`) - No longer used (phases are timestamp-based). **Remove entirely.**
- **`useGenerateCards`** (line 388 in `use-trading-game.ts`) - Cards are generated in `startGame` now. **Remove if unused.**
- **`GameStatus.ACTIVE`** - Only referenced once in `getStatusLabel`, but never actually used in game flow. **Consider removing or document why it exists.**

### 2. **Remove Unused Mock Contract Files**
- **`lib/mock-contract.ts`** - Entire file appears unused (no imports found)
- **`hooks/use-mock-contract.ts`** - Entire file appears unused
- **`lib/contract-config.ts`** - Has TODOs and empty ABI, might be obsolete

**Action**: Search for any imports of these files, then delete if truly unused.

### 3. **Remove Unused Round Timer Hook**
- **`hooks/use-round-timer.ts`** - Not imported anywhere. Has duplicate `formatTimeRemaining` function.
- **Action**: Delete file, keep `formatTimeRemaining` in `use-game-state.ts` (already used there)

### 4. **Consolidate Duplicate `formatTimeRemaining`**
- **Location 1**: `hooks/use-game-state.ts` (line 324) - Used in 6+ places ✅
- **Location 2**: `hooks/use-round-timer.ts` (line 92) - Unused file ❌
- **Action**: Delete `use-round-timer.ts`, keep the one in `use-game-state.ts`

## 🟡 Medium Priority (Code Quality)

### 5. **Reduce Debug Console Logs**
- **172 console.log/warn/error statements** across 19 files
- Many are debug logs that should be removed or gated behind `process.env.NODE_ENV === 'development'`
- **High concentration in**:
  - `hooks/use-trading-game.ts` (80 logs)
  - `components/lobby.tsx` (32 logs)
  - `hooks/use-game-state.ts` (6 logs)
  - `app/page.tsx` (8 logs)

**Action**: 
- Remove production logs
- Keep only critical error logs
- Gate debug logs behind dev check: `if (process.env.NODE_ENV === 'development') console.log(...)`

### 6. **Clean Up Unused Imports**
- Check all files for unused imports (ESLint should catch these, but verify)
- Common suspects:
  - `usePredictionResult` - Only used in results-display via API, not directly
  - `useGameEvents` - Check if actually used

### 7. **Remove Redundant Debug Logging in page.tsx**
- Lines 144-171 have extensive debug logging that's duplicated
- The same information is logged multiple times with slight variations
- **Action**: Consolidate to single debug log or remove entirely

## 🟢 Low Priority (Nice to Have)

### 8. **TODO Comments Review**
- **18 TODO comments** found
- Some are legitimate (Pyth integration, contract features)
- Some might be outdated:
  - `lib/mock-contract.ts` - Multiple TODOs about replacing with real contract (might be obsolete)
  - `lib/contract-config.ts` - TODOs about adding contract address/ABI (might be done)

**Action**: Review each TODO, mark as done or create issues for tracking

### 9. **Simplify Error Handling Patterns**
- Similar error handling code repeated across hooks
- Could extract to utility function:
  ```typescript
  function handleContractError(error: unknown, context: string) {
    // Standardized error logging and user messaging
  }
  ```

### 10. **Extract Repeated Validation Logic**
- Game ID validation (`gameId && gameId > 0n`) repeated in many places
- Address validation (`address && address !== '0x0000...'`) repeated
- **Action**: Create utility functions:
  ```typescript
  function isValidGameId(gameId: bigint | undefined): boolean
  function isValidAddress(address: string | undefined): boolean
  ```

## 📊 Summary Statistics

- **Console logs**: 172 (should be ~20-30 for production)
- **TODO comments**: 18 (review and prioritize)
- **Unused files**: 3-4 files (mock-contract, use-mock-contract, use-round-timer)
- **Deprecated functions**: 2-3 functions (useBeginGame, useTransitionToResolution, possibly useGenerateCards)
- **Duplicate code**: formatTimeRemaining (2 locations), error handling patterns

## 🎯 Recommended Cleanup Order

1. **Delete unused files** (5 min, high impact)
   - `hooks/use-round-timer.ts`
   - `lib/mock-contract.ts` (if unused)
   - `hooks/use-mock-contract.ts` (if unused)

2. **Remove deprecated functions** (10 min, medium impact)
   - `useBeginGame`
   - `useTransitionToResolution`

3. **Reduce console logs** (30 min, medium impact)
   - Remove production logs
   - Gate debug logs behind dev check

4. **Review TODOs** (15 min, low impact)
   - Mark completed ones as done
   - Create issues for remaining

5. **Extract utilities** (20 min, low impact)
   - Validation functions
   - Error handling utilities

**Total estimated time**: ~1.5 hours for high/medium priority items

