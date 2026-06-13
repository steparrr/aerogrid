# Claude Foundations Handoff

## Objective

Implement AeroGrid tasks `1-A` and `1-B` before Codex starts dependent work.

Read:

- `/Users/Administrator/Downloads/AEROGRID_TASK_BREAKDOWN.md`, tasks `1-A` and `1-B`
- `/private/tmp/aerogrid-reference/aerogrid_project_prompt.md`
- `/private/tmp/aerogrid-reference/aerogrid_financial_architecture.md`
- `/private/tmp/aerogrid-reference/aerogrid_fleet_architecture.md`
- `/private/tmp/aerogrid-reference/aerogrid_maintenance_fuel.md`
- `/private/tmp/aerogrid-reference/aerogrid_route_formation_report.md`
- `/private/tmp/aerogrid-reference/aerogrid_yield_management.md`
- `/private/tmp/aerogrid-reference/aerogrid_rotations_schedule.md`
- `/private/tmp/aerogrid-reference/aerogrid_environmental_regulations.md`

## Critical Architecture Constraint

The repository already has:

- `src/domain/types.ts`
- `src/game/GameProvider.tsx`
- `src/game/gameContext.ts`
- `src/game/reducer.ts`
- `src/simulation/advance.ts`

Extend and migrate the existing architecture compatibly. Do not create a
second `GameState`, competing provider, reducer, or turn engine. Keep existing
features and tests working.

The task `1-A` constraint about `localStorage` means the new state contracts
and reducer must not introduce persistence. Do not remove the existing
persistence feature unless a demonstrated compatibility issue requires it.

## Claude Ownership

Claude owns only:

- shared domain/types contracts;
- game state, context, reducer, and actions;
- pure turn engine and its tests;
- validation and persistence changes strictly required by the expanded state.

Do not modify UI or implement later AeroGrid tasks.

## Requirements

1. Follow TDD: write a failing test, verify the expected failure, implement,
   then verify the passing test.
2. Unify the task `1-A` contracts with the existing domain types. Keeping
   `src/domain/types.ts` canonical and adding `src/types/aerogrid.ts` plus
   `src/types/index.ts` as compatible re-exports is acceptable.
3. Extend the single existing `GameState` with the required root fields:
   `turn`, `game_date`, `player`, `competitors`, `airports`,
   `market_fuel_price`, `game_mode`, `origin`, `victory_path`, `events_log`,
   and `pending_decisions`. Preserve compatibility with fields used by the MVP.
4. Extend the existing reducer/context with the required typed actions,
   including `END_TURN`. Provide compatible `useGameState` and `useGame`
   access without creating another context.
5. Implement pure `processTurn(state: GameState): GameState`. Do not call
   `Math.random` directly. Use a deterministic/testable source while preserving
   the required public signature.
6. Integrate with or delegate to `src/simulation/advance.ts`; do not create a
   competing turn lifecycle.
7. Export independently testable turn sub-calculations. Use only documented or
   existing numeric values. Use explicit neutral fallbacks when data is absent.
8. Update validation, persistence, and schema only as required, preserving old
   saves where practical.
9. Run:
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
10. Commit the result on a dedicated branch.

## Required Handoff To Codex

Report:

- status: `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`;
- branch and commit SHA;
- files changed;
- public contracts delivered;
- verification commands and results;
- compatibility or migration decisions Codex must know;
- any deferred stubs that later engines must replace.

## Codex Work After Handoff

Codex owns:

- `2-B`, `3-A`, `3-B`, `4-A`, `6-A`, `6-B`, `7-A`, `7-B`, `8-B`, `9-B`.

Codex must not start UI tasks until the `1-A` contracts are stable. Tasks that
also require later engines must wait for those engine contracts.
