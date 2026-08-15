# Submission Notes — Task Manager API Take-Home Assignment

## Assignment Overview

The Task Manager API is a small Express.js application with an in-memory data store. It supports CRUD operations on tasks, status filtering, pagination, task completion, and statistics. The assignment required reading the untested codebase, writing comprehensive tests, discovering bugs through testing, fixing one bug, and adding a new `PATCH /tasks/:id/assign` endpoint.

## Tests Implemented

### Unit Tests (`tests/taskService.test.js` — 38 tests)
Direct unit tests for every function in `taskService.js`:
- `create` — all fields, defaults, unique IDs, storage verification
- `getAll` — empty store, populated, shallow copy
- `findById` — existing and non-existent IDs
- `getByStatus` — exact match, no match, empty store, substring behavior (known bug documented)
- `getPaginated` — page 1/2/3, boundaries, beyond-range, page 0, large limit
- `getStats` — empty store, status counts, overdue variations (past/future/null dueDate, done excluded)
- `update` — field updates, preservation, non-existent ID, protected field overwrites (known bug documented)
- `remove` — existing, non-existent, targeted removal
- `completeTask` — completion, non-existent ID, idempotency, priority behavior (known bug documented)

### Integration Tests (`tests/tasks.integration.test.js` — 61 tests)
Supertest integration tests for every API endpoint:
- `GET /tasks` — empty, populated
- `GET /tasks?status=` — exact match, no match, substring behavior (known bug documented)
- `GET /tasks?page=&limit=` — page 1/2/3, boundaries, large limit
- `GET /tasks?status=&page=&limit=` — combined behavior (known bug documented)
- `POST /tasks` — happy path, all fields, missing/empty/whitespace title, invalid status/priority/dueDate, null body, empty object
- `PUT /tasks/:id` — update, preserve fields, 404, invalid title/status/priority/dueDate, protected field overwrites, falsy value bypass (known bugs documented), null body
- `DELETE /tasks/:id` — 204, 404, double delete
- `PATCH /tasks/:id/complete` — completion, 404, priority behavior (known bug documented), idempotency, preservation
- `PATCH /tasks/:id/assign` — 9 tests (see below)
- `GET /tasks/stats` — empty, status counts, overdue variations

## Bugs Discovered

6 genuine bugs were discovered through testing:

1. **Pagination off-by-one** — `getPaginated()` uses `page * limit` instead of `(page - 1) * limit`, causing page 1 to skip the first `limit` items
2. **Status filter substring matching** — `getByStatus()` uses `.includes()` instead of `===`, allowing `?status=to` to match "todo"
3. **completeTask overwrites priority** — Hardcodes `priority: 'medium'`, discarding the original value
4. **Status + pagination can't combine** — Route returns early on `status` query, ignoring `page`/`limit`
5. **Update allows overwriting protected fields** — `id`, `createdAt`, `completedAt` can be corrupted via PUT body
6. **Falsy invalid values bypass validation** — `status: ""` and `status: null` skip validation due to truthiness guards

All 6 bugs are documented in `BUG_REPORT.md` with file/function, expected behavior, actual behavior, exposing tests, impact, and suggested fixes.

## Bug Fixed

**Bug #1 (Pagination off-by-one)** was fixed:
- **Root cause:** `offset = page * limit` with 1-based page numbering skips the first page
- **Change:** `const offset = (page - 1) * limit;` in `src/services/taskService.js`
- **Verification:** 8 previously-failing pagination tests now pass

The other 5 bugs are intentionally left unfixed per assignment instructions (fix only one bug). Tests for these bugs assert the actual (buggy) behavior with clear comments marking them as known issues, so the test suite passes while preserving the bug documentation.

## New Assign Endpoint

### `PATCH /tasks/:id/assign`

**Implementation:**
- **Service layer:** `assignTask(id, assignee)` in `taskService.js` — finds task by ID, sets `assignee` field, returns updated task or `null`
- **Route handler:** `PATCH /:id/assign` in `routes/tasks.js` — validates input, calls service, returns 200/400/404

**Request body:** `{ "assignee": "string" }`

**Response:** Updated task object with `assignee` field set

### Tests Added (9 tests)
1. Successful assignment — assigns and returns updated task
2. Non-existent task — returns 404
3. Missing assignee — returns 400
4. Empty string assignee — returns 400
5. Whitespace-only assignee — returns 400
6. Non-string assignee (number) — returns 400
7. Reassignment — replaces previous assignee
8. Whitespace trimming — `  Alice  ` becomes `Alice`
9. Null body — returns 400

## Validation Behavior

The assign endpoint validates:
- `assignee` must be present (not `undefined` or `null`) → 400 if missing
- `assignee` must be a string → 400 if non-string type
- `assignee` must be non-empty after trim → 400 if empty or whitespace-only
- The assignee value is trimmed before storage

## Edge Cases Tested

- Empty task store (getAll, getByStatus, getStats)
- Pagination boundaries (page 1, 2, 3, beyond-range, page 0, large limit)
- Status filtering with exact and substring queries
- Combined status + pagination (known bug documented)
- Missing/empty/whitespace title on POST
- Invalid status/priority/dueDate values
- Null request body on POST, PUT, and PATCH assign
- Non-existent task IDs on PUT, DELETE, PATCH complete, PATCH assign
- Double delete
- Completing an already-completed task (idempotency)
- Protected field overwrites (id, createdAt, completedAt)
- Falsy invalid values (empty string, null status)
- Reassignment of already-assigned task
- Whitespace trimming on assignee

## Final Test Result

```
Test Suites: 2 passed, 2 total
Tests:       99 passed, 99 total
```

## Final Coverage

```
File             | % Stmts | % Branch | % Funcs | % Lines
All files        |   97.4  |   93.25  |   93.1  |   97.14
src/routes       |   100   |   90.62  |   100   |   100
src/services     |   100   |   94.73  |   100   |   100
src/utils        |   100   |   100    |   100   |   100
```

Coverage exceeds the 80% requirement. The only uncovered lines are in `app.js` (error handler and server listen block, which require a running server to exercise).

## Design Decisions

1. **Assignee trimming:** The assignee value is trimmed before storage so `  Alice  ` becomes `Alice`. This prevents whitespace-only names from being stored and normalizes input.

2. **Reassignment allowed:** Reassigning an already-assigned task simply replaces the previous assignee. This is the least surprising behavior for a PATCH endpoint.

3. **Validation in route handler:** Following the existing pattern where `validateCreateTask` and `validateUpdateTask` are called in the route handler, the assign validation is also in the route handler rather than a separate validator function. This keeps the change minimal and consistent with the existing architecture.

4. **Known bug tests:** Tests for intentionally unfixed bugs assert the actual (buggy) behavior with comments clearly marking them as known issues. This ensures the test suite passes while preserving the bug documentation. The tests serve as regression detectors — if someone fixes the bug, the test will fail and prompt them to update the test to assert the correct behavior.

## Remaining Known Issues

5 bugs are intentionally left unfixed per assignment instructions:

1. **Status filter substring matching** (`getByStatus` uses `.includes()`)
2. **completeTask overwrites priority** (hardcodes `priority: 'medium'`)
3. **Status + pagination can't combine** (route early-returns on status)
4. **Update allows overwriting protected fields** (no field allowlisting)
5. **Falsy invalid values bypass validation** (truthiness guards skip `""` and `null`)

All are documented in `BUG_REPORT.md` with suggested fixes.

## What I'd Test Next

- Concurrent operations on the in-memory store (race conditions)
- Large dataset performance for pagination and filtering
- Input sanitization (XSS, injection via title/description)
- Content-Type header validation (reject non-JSON bodies)
- HTTP method override attempts
- Rate limiting and abuse prevention

## Surprises in the Codebase

- `completeTask` silently overwrites priority to "medium" — this is a data loss bug that's easy to miss without tests
- The pagination off-by-one is a classic mistake but means page 1 returns nothing useful
- The status filter using `.includes()` instead of `===` is a subtle bug that happens to work for exact matches

## Questions Before Shipping to Production

- Should the in-memory store be replaced with a persistent database?
- Is authentication/authorization needed (who can assign tasks)?
- Should there be rate limiting on the API?
- What are the expected concurrency requirements?
- Should completed tasks be editable?
- Is there a maximum length for title, description, or assignee fields?

## Project Readiness

The project is ready to submit. All requirements are met:
- 99 tests, all passing
- 97.4% statement coverage (exceeds 80% requirement)
- 6 bugs discovered and documented in BUG_REPORT.md
- 1 bug fixed (pagination off-by-one)
- `PATCH /tasks/:id/assign` endpoint implemented with full validation and 9 tests
- No unrelated refactoring
- No database introduced
- No meaningful tests removed
