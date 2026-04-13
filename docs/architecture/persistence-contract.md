# Persistence Contract

**Frozen:** 2026-04-13 (IP-05)
**Status:** Active

This document is the contract for what the game persists, what it does not, how autosave behaves, and how schema versions evolve. It is paired with the runtime code in `src/engine/core/save-system.ts`, `src/stores/persistence-setup.ts`, and `src/hooks/use-save-game.ts`.

---

## 1. Persisted vs Transient Store Fields

The game store exposes both durable world state and session-scoped runtime state. Only durable state crosses the IndexedDB boundary.

| Store field | Persisted? | Rationale |
|-------------|------------|-----------|
| `world` | ✅ Yes | Canonical `FullGameState` — teams, drivers, calendar, finance, narrative |
| `eventCooldowns` | ❌ No | Session-only cooldown bookkeeping; re-derived on first narrative tick |
| `lastRaceResults` | ❌ No | UI-only; regenerated from `world` or next race |
| `lastSeasonEnd` | ❌ No | UI-only; regenerated from `world` or next season end |
| `raceCommandBus` | ❌ No | In-memory command bus instance |
| `raceRuntime` | ❌ No | **Session-scoped race simulation** — see §4 |

Autosave writes only `world`. Manual save/load operates only on `world`. Every other store field is considered transient and is reset to its initial value on page load.

## 2. Autosave Trigger Rules

- The autosave subscriber lives in `setupPersistence()` and is installed once at app boot by `PersistenceProvider`.
- It subscribes to `useGameStore` and compares the current `world` reference against the previous one on every store update.
- **Trigger condition:** `state.world !== prevWorld` AND `state.world` is non-null.
- Because Zustand always produces a new `world` object when any world-mutating action runs, this fires exactly once per world mutation.
- The subscriber never inspects `raceRuntime`, `eventCooldowns`, `lastRaceResults`, or `lastSeasonEnd`. These fields do not cause autosave writes even when they change.
- Errors are surfaced via `subscribeAutosaveStatus()` and logged to the dev console. They are never thrown into the store.

### No Debounce Required

Because `world` only mutates on discrete user actions (phase advance, R&D allocation, contract resolution, etc.) and never on lap ticks, there is no write amplification to defend against. A debounce would be needed only if Option B (race slice inside `world`) had been chosen in IP-04 — it was not.

## 3. Manual Save/Load

Manual operations go through `useSaveGame()` and write/read the same IndexedDB store.

| Operation | Slot target | Effect |
|-----------|-------------|--------|
| `saveGame(slotId, name)` | any named slot | Writes current `world` with `schemaVersion = SCHEMA_VERSION` |
| `loadGame(slotId)` | any named slot | Replaces `world`, `lastRaceResults`, `lastSeasonEnd`; leaves `raceRuntime` alone |
| `listSaves()` | all slots | Returns `SlotInfo[]` including `schemaVersion` |
| `deleteSave(slotId)` | any named slot | Removes record |
| `exportSave(slotId)` | any named slot | Returns JSON string of inner `FullGameState` only |
| `importSave(slotId, name, json)` | any named slot | Writes JSON payload into a slot at current schema version |

Autosave uses the dedicated `AUTO_SAVE_SLOT` slot id (`'auto-save'`). Manual saves may use any other slot id; overwriting autosave via manual save is allowed but not recommended.

## 4. Race Runtime Interaction (IP-04 Option A)

**Decision:** The race runtime slice lives **outside** `world`. See `docs/architecture/current-state-baseline.md` §3.1.

**Persistence consequences:**
- The autosave subscriber watches `world` by reference. `raceRuntime` is a sibling field and changing it never triggers a save.
- Mid-race page reloads return the player to the pre-race strategy screen. Resuming a race in progress is not supported.
- Post-race state (final results, standings, finance) flows into `world` via `submitRaceResults()` and is therefore persisted normally.
- No schema migration was required for IP-05.

**Tier 2 mid-race resume is out of scope.** Implementing it would require a separate snapshot schema and its own migration path; it does not retrofit into this contract.

## 5. Schema Versioning

`SaveSystem` declares `SCHEMA_VERSION` in `src/engine/core/save-system.ts`. Every `SaveRecord` written includes the version that produced it.

### Current state
- `SCHEMA_VERSION = 1`
- `MIGRATIONS = {}` (empty — no upgrades registered)

### On load
`loadFromSlot(slotId)` calls `migrateToCurrent(data, record.schemaVersion ?? 1)` before returning. For v1 saves this is a pass-through. If a save claims a newer version than the runtime knows, `migrateToCurrent` throws — the UI should surface this as an unsupported save rather than attempt to load.

If any migration runs, the upgraded payload is re-written into the same slot so subsequent loads are version-stable.

### Adding a new schema version

When a future change requires a shape bump:

1. Increment `SCHEMA_VERSION` by one (e.g., `1 → 2`).
2. Add a `MIGRATIONS[1] = (data) => { ...upgrade logic... }` entry that converts a v1 payload into a v2 payload.
3. The migration must be pure and idempotent.
4. Add a test covering:
   - loading a v1 save at the new runtime version produces the expected v2 shape,
   - the migrated payload is written back at the new version,
   - a save that claims a version newer than `SCHEMA_VERSION` throws.
5. Update this document's "Current state" section.

Migrations must never silently drop fields. If a field is being removed, the migration should move it to a deprecated namespace or explicitly discard it with a comment.

## 6. Failure Handling

| Failure | Behavior |
|---------|----------|
| Autosave IndexedDB write fails | Caught, logged in dev, surfaced via `getAutosaveStatus()` / `subscribeAutosaveStatus()`. Gameplay continues. |
| Manual save fails | `useSaveGame().status.lastError` is set; `isSaving` returns to false. |
| Manual load fails (missing slot) | Throws inside the hook; error is caught and exposed as `status.lastError`. Store is untouched. |
| Load encounters unsupported schema version | `migrateToCurrent` throws; caught as a manual-load error. |
| `saveSystem` is null (SSR / non-browser) | All hook operations become no-ops. |

## 7. Test Coverage

Authoritative tests for this contract:

- `tests/engine/core/save-system.test.ts` — save/load/list/delete/export/import and migration entry point.
- `tests/stores/persistence-setup.test.ts` — autosave fires on `world` change only; race runtime changes do not trigger writes; error path updates status.
- `tests/hooks/use-save-game.test.ts` — save/load/delete status transitions.

Run the full suite with:

```
npx vitest run tests/engine/core tests/data tests/stores tests/hooks
```

## 8. Boundaries

- Persistence code never imports from `src/components/**` or any React-tree module.
- The store has no awareness of IndexedDB. It does not import from `save-system.ts` directly; only `persistence-setup.ts` does.
- Engine modules under `src/engine/` (except `save-system.ts` itself) never touch persistence.
- New store fields default to "transient" unless this document is updated to move them into §1 as persisted.
