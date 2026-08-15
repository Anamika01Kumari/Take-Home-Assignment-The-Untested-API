# Bug Report — Task Manager API

Discovered through Jest unit tests and Supertest integration tests.

---

## Bug 1: Pagination off-by-one error — page 1 skips first `limit` items [FIXED]

**Status:** FIXED

**File/Function:** `src/services/taskService.js` — `getPaginated()`

**Root cause:** The offset was calculated as `page * limit` instead of `(page - 1) * limit`. With 1-based page numbering (page 1 = first page), this means page 1 skips the first `limit` items entirely.

**Change made:** Changed `const offset = page * limit;` to `const offset = (page - 1) * limit;` in `getPaginated()`.

**Test that verifies the fix:**
- Unit: `taskService › getPaginated › page 1 should return the first \`limit\` tasks` (now passes)
- Unit: `taskService › getPaginated › page 2 should return the next \`limit\` tasks` (now passes)
- Unit: `taskService › getPaginated › last page should return remaining tasks` (now passes)
- Unit: `taskService › getPaginated › limit larger than total should return all tasks` (now passes)
- Integration: `GET /tasks?page=&limit= › page 1 should return the first \`limit\` tasks` (now passes)
- Integration: `GET /tasks?page=&limit= › page 2 should return the next \`limit\` tasks` (now passes)
- Integration: `GET /tasks?page=&limit= › last page should return remaining tasks` (now passes)
- Integration: `GET /tasks?page=&limit= › limit larger than total should return all tasks` (now passes)

**Original impact (before fix):** Any client using page-based pagination (the standard page=1 convention) silently missed the first page of results.

---

## Bug 2: Status filter uses substring matching instead of exact equality

**File/Function:** `src/services/taskService.js` — `getByStatus()`

**Expected behavior:** `GET /tasks?status=todo` should return only tasks whose status is exactly `"todo"`. A query like `?status=to` should return no results.

**Actual behavior:** The function uses `t.status.includes(status)`, which performs substring matching. So `?status=to` matches `"todo"`, `?status=in` matches `"in_progress"`, and `?status=done` also matches `"done"` (correctly, but for the wrong reason).

**Test that exposed it:**
- Unit: `taskService › getByStatus › should not match on substring of status`
- Unit: `taskService › getByStatus › should not match on partial substring "in" for in_progress`
- Integration: `GET /tasks?status= › should not match on substring "to" for "todo"`
- Integration: `GET /tasks?status= › should not match on substring "in" for "in_progress"`

**Impact:** Clients can accidentally retrieve unintended tasks by passing a partial status string. Could also be a data leakage vector if status values carry semantic meaning.

**Suggested fix:** Change `tasks.filter((t) => t.status.includes(status))` to `tasks.filter((t) => t.status === status)`.

**Status:** Intentionally left unfixed per assignment instructions (fix only one bug). Tests assert actual (buggy) behavior with clear comments marking this as a known issue.

---

## Bug 3: `completeTask` overwrites priority to "medium" unconditionally

**File/Function:** `src/services/taskService.js` — `completeTask()`

**Expected behavior:** Completing a task should set `status` to `"done"` and `completedAt` to the current timestamp, but should preserve the task's original `priority`.

**Actual behavior:** The function hardcodes `priority: 'medium'` in the updated task object, silently overwriting the original priority. A high-priority task becomes medium when completed.

**Test that exposed it:**
- Unit: `taskService › completeTask › should preserve the original priority`
- Integration: `PATCH /tasks/:id/complete › should preserve the original priority`

**Impact:** Priority data is lost when tasks are completed. Any reporting or analytics that rely on priority after completion will be incorrect.

**Suggested fix:** Remove the `priority: 'medium'` line from the `updated` object in `completeTask()`. The spread of `...task` already preserves the original priority.

**Status:** Intentionally left unfixed per assignment instructions (fix only one bug). Tests assert actual (buggy) behavior with clear comments marking this as a known issue.

---

## Bug 4: Status filter and pagination cannot be combined

**File/Function:** `src/routes/tasks.js` — `GET /` route handler

**Expected behavior:** `GET /tasks?status=todo&page=1&limit=10` should return the first 10 tasks with status "todo" (filtered AND paginated results).

**Actual behavior:** The route handler checks `if (status)` first and returns early with only the filtered results, ignoring `page` and `limit` entirely. The pagination branch is never reached when `status` is present.

**Test that exposed it:**
- Integration: `GET /tasks?status=&page=&limit= (combined) › should filter by status AND paginate results`
- Integration: `GET /tasks?status=&page=&limit= (combined) › should return second page of filtered results`

**Impact:** Clients cannot paginate filtered results. A status filter with hundreds of matching tasks returns all of them in one response.

**Suggested fix:** Restructure the route handler to apply status filtering first, then paginate the filtered result set, rather than using mutually exclusive `if/else` branches.

**Status:** Intentionally left unfixed per assignment instructions (fix only one bug). Tests assert actual (buggy) behavior with clear comments marking this as a known issue.

---

## Bug 5: `update()` allows overwriting protected fields (id, createdAt, completedAt)

**File/Function:** `src/services/taskService.js` — `update()`

**Expected behavior:** `PUT /tasks/:id` should only allow updating user-facing fields (title, description, status, priority, dueDate). Protected fields like `id`, `createdAt`, and `completedAt` should never be overwritten by client input.

**Actual behavior:** The function uses `{ ...tasks[index], ...fields }`, which blindly merges all fields from the request body into the task. A client can send `{ "id": "hacked-id" }` or `{ "createdAt": "2000-01-01" }` and corrupt the task's identity and audit trail.

**Test that exposed it:**
- Unit: `taskService › update › should allow overwriting id field (protected field)` (passing — asserts the buggy behavior)
- Unit: `taskService › update › should allow overwriting createdAt field (protected field)` (passing — asserts the buggy behavior)
- Unit: `taskService › update › should allow overwriting completedAt field (protected field)` (passing — asserts the buggy behavior)
- Integration: `PUT /tasks/:id › should allow overwriting id (protected field)` (passing — asserts the buggy behavior)
- Integration: `PUT /tasks/:id › should allow overwriting createdAt (protected field)` (passing — asserts the buggy behavior)
- Integration: `PUT /tasks/:id › should allow overwriting completedAt (protected field)` (passing — asserts the buggy behavior)

**Impact:** Data integrity violation. A malicious or buggy client can corrupt task IDs (breaking references), backdate creation timestamps, or set arbitrary completion timestamps. This is a data integrity and audit-trail security issue.

**Suggested fix:** Allowlist the fields that `update()` accepts. Only copy `title`, `description`, `status`, `priority`, and `dueDate` from the incoming fields, never `id`, `createdAt`, or `completedAt`.

**Status:** Intentionally left unfixed per assignment instructions (fix only one bug). Tests assert actual (buggy) behavior with clear comments marking this as a known issue.

---

## Bug 6: Falsy invalid values bypass validation (empty string / null status and priority)

**File/Function:** `src/utils/validators.js` — `validateUpdateTask()` (and `validateCreateTask()`)

**Expected behavior:** Setting `status` to `""` (empty string) or `null` should be rejected as invalid, since neither is a valid status value.

**Actual behavior:** The validators use truthiness guards (`if (body.status && ...)`). Both `""` and `null` are falsy, so they skip validation entirely. The invalid value is then stored on the task, corrupting the data model. A task with `status: ""` will not be counted in `getStats()` and cannot be filtered by `getByStatus()`.

**Test that exposed it:**
- Integration: `PUT /tasks/:id › should accept empty string status without validation error` (passing — asserts the buggy behavior)
- Integration: `PUT /tasks/:id › should accept null status without validation error` (passing — asserts the buggy behavior)

**Impact:** Invalid status/priority values silently persist in the data store, breaking stats, filtering, and any client expecting the documented enum values.

**Suggested fix:** Change the truthiness guards to explicit `!== undefined` checks (for PUT, where fields are optional) or always validate (for POST). For example: `if (body.status !== undefined && !VALID_STATUSES.includes(body.status))`.

**Status:** Intentionally left unfixed per assignment instructions (fix only one bug). Tests assert actual (buggy) behavior with clear comments marking this as a known issue.

---

## Feature: PATCH /tasks/:id/assign — Design Decisions

**Validation:** The assignee field must be a non-empty string. Whitespace-only values are rejected. The assignee is trimmed before storage so that `  Alice  ` becomes `Alice`. Non-string types (numbers, booleans, objects) are rejected with 400.

**Reassignment:** Reassigning an already-assigned task is allowed — the previous assignee is simply replaced with the new one. This is the least surprising behavior for a PATCH endpoint.

**Null body handling:** When the request body is `null` (supertest `.send(null)` results in `req.body = {}`), the endpoint returns 400 because `assignee` is missing.

**Route ordering:** The assign route is defined after the complete route, both under `/:id/...` — Express correctly distinguishes `/tasks/:id/complete` from `/tasks/:id/assign` by path suffix.
