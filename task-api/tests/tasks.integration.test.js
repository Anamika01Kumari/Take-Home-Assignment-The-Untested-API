const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Task API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  // ─── GET /tasks ────────────────────────────────────────────────────────

  describe('GET /tasks', () => {
    test('should return empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return all tasks', async () => {
      await request(app).post('/tasks').send({ title: 'Task 1' });
      await request(app).post('/tasks').send({ title: 'Task 2' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // ─── GET /tasks?status=... ─────────────────────────────────────────────

  describe('GET /tasks?status=', () => {
    test('should return only tasks matching the exact status', async () => {
      await request(app).post('/tasks').send({ title: 'T1', status: 'todo' });
      await request(app).post('/tasks').send({ title: 'T2', status: 'in_progress' });
      await request(app).post('/tasks').send({ title: 'T3', status: 'done' });
      await request(app).post('/tasks').send({ title: 'T4', status: 'todo' });

      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      res.body.forEach((t) => expect(t.status).toBe('todo'));
    });

    test('should return empty array when no tasks match the status', async () => {
      await request(app).post('/tasks').send({ title: 'T1', status: 'todo' });

      const res = await request(app).get('/tasks?status=done');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    // KNOWN BUG (Bug #2): getByStatus uses .includes() instead of ===, so substring queries match.
    // See BUG_REPORT.md. Intentionally left unfixed — tests document actual behavior.
    test('should match on substring "to" — known bug: .includes() instead of ===', async () => {
      await request(app).post('/tasks').send({ title: 'T1', status: 'todo' });

      const res = await request(app).get('/tasks?status=to');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('todo');
    });

    test('should match on substring "in" — known bug: .includes() instead of ===', async () => {
      await request(app).post('/tasks').send({ title: 'T1', status: 'in_progress' });

      const res = await request(app).get('/tasks?status=in');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('in_progress');
    });
  });

  // ─── GET /tasks?page=...&limit=... ─────────────────────────────────────

  describe('GET /tasks?page=&limit=', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 25; i++) {
        await request(app).post('/tasks').send({ title: `Task ${i}` });
      }
    });

    test('page 1 should return the first `limit` tasks', async () => {
      const res = await request(app).get('/tasks?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(10);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[9].title).toBe('Task 10');
    });

    test('page 2 should return the next `limit` tasks', async () => {
      const res = await request(app).get('/tasks?page=2&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(10);
      expect(res.body[0].title).toBe('Task 11');
      expect(res.body[9].title).toBe('Task 20');
    });

    test('last page should return remaining tasks', async () => {
      const res = await request(app).get('/tasks?page=3&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body[0].title).toBe('Task 21');
      expect(res.body[4].title).toBe('Task 25');
    });

    test('page beyond available data should return empty array', async () => {
      const res = await request(app).get('/tasks?page=4&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('limit larger than total should return all tasks', async () => {
      const res = await request(app).get('/tasks?page=1&limit=100');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(25);
    });
  });

  // ─── GET /tasks?status=...&page=...&limit=... (combined) ────────────────

  describe('GET /tasks?status=&page=&limit= (combined)', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 15; i++) {
        await request(app).post('/tasks').send({ title: `Todo ${i}`, status: 'todo' });
      }
      for (let i = 1; i <= 5; i++) {
        await request(app).post('/tasks').send({ title: `Done ${i}`, status: 'done' });
      }
    });

    // KNOWN BUG (Bug #4): Route returns early on status query, ignoring page/limit.
    // See BUG_REPORT.md. Intentionally left unfixed — tests document actual behavior.
    test('should ignore pagination when status is present — known bug: early return', async () => {
      const res = await request(app).get('/tasks?status=todo&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(15);
      res.body.forEach((t) => expect(t.status).toBe('todo'));
    });

    test('should ignore pagination on page 2 when status is present — known bug: early return', async () => {
      const res = await request(app).get('/tasks?status=todo&page=2&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(15);
      res.body.forEach((t) => expect(t.status).toBe('todo'));
    });
  });

  // ─── POST /tasks ───────────────────────────────────────────────────────

  describe('POST /tasks', () => {
    test('should create a task with only title and return 201', async () => {
      const res = await request(app).post('/tasks').send({ title: 'New task' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('New task');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.completedAt).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    test('should create a task with all fields', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Full task',
        description: 'A description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59Z',
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Full task');
      expect(res.body.description).toBe('A description');
      expect(res.body.status).toBe('in_progress');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe('2026-12-31T23:59:59Z');
    });

    test('should return 400 when title is missing', async () => {
      const res = await request(app).post('/tasks').send({ description: 'No title' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('should return 400 when title is empty string', async () => {
      const res = await request(app).post('/tasks').send({ title: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('should return 400 when title is whitespace only', async () => {
      const res = await request(app).post('/tasks').send({ title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('should return 400 when status is invalid', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Task', status: 'pending' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    test('should return 400 when priority is invalid', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Task', priority: 'urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority');
    });

    test('should return 400 when dueDate is invalid', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Task', dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate');
    });

    test('should return 400 when body is null', async () => {
      const res = await request(app).post('/tasks').send(null);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('should return 400 when body is empty object', async () => {
      const res = await request(app).post('/tasks').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title');
    });
  });

  // ─── PUT /tasks/:id ────────────────────────────────────────────────────

  describe('PUT /tasks/:id', () => {
    test('should update an existing task', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original', priority: 'low' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: 'Updated', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
      expect(res.body.priority).toBe('high');
    });

    test('should preserve unmodified fields', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original', status: 'todo', priority: 'low' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Original');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('high');
    });

    test('should return 404 for non-existent id', async () => {
      const res = await request(app).put('/tasks/nonexistent').send({ title: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('should return 400 for whitespace-only title', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title');
    });

    test('should return 400 for invalid status', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ status: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    test('should return 400 for invalid priority', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ priority: 'urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority');
    });

    test('should return 400 for invalid dueDate', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate');
    });

    test('should allow overwriting id (protected field)', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ id: 'hacked-id' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('hacked-id');
    });

    test('should allow overwriting createdAt (protected field)', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ createdAt: '2000-01-01T00:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body.createdAt).toBe('2000-01-01T00:00:00Z');
    });

    test('should allow overwriting completedAt (protected field)', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ completedAt: '2000-01-01T00:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body.completedAt).toBe('2000-01-01T00:00:00Z');
    });

    test('should accept empty string status without validation error', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ status: '' });

      // Empty string is falsy so it bypasses validation — this is a bug
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('');
    });

    test('should accept null status without validation error', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send({ status: null });

      // null is falsy so it bypasses validation — this is a bug
      expect(res.status).toBe(200);
      expect(res.body.status).toBeNull();
    });

    test('should return 200 for empty body (supertest send(null) results in {})', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Original' });
      const res = await request(app).put(`/tasks/${created.body.id}`).send(null);
      // supertest .send(null) results in req.body = {} — no fields to validate,
      // so the update succeeds as a no-op. This is correct PUT behavior.
      expect(res.status).toBe(200);
    });
  });

  // ─── DELETE /tasks/:id ─────────────────────────────────────────────────

  describe('DELETE /tasks/:id', () => {
    test('should delete an existing task and return 204', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Delete me' });
      const res = await request(app).delete(`/tasks/${created.body.id}`);
      expect(res.status).toBe(204);

      const all = await request(app).get('/tasks');
      expect(all.body).toHaveLength(0);
    });

    test('should return 404 for non-existent id', async () => {
      const res = await request(app).delete('/tasks/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('should return 404 on double delete', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Delete me' });
      await request(app).delete(`/tasks/${created.body.id}`);
      const res = await request(app).delete(`/tasks/${created.body.id}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /tasks/:id/complete ─────────────────────────────────────────

  describe('PATCH /tasks/:id/complete', () => {
    test('should mark a task as done and set completedAt', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Complete me', status: 'todo' });
      const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
    });

    test('should return 404 for non-existent id', async () => {
      const res = await request(app).patch('/tasks/nonexistent/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    // KNOWN BUG (Bug #3): completeTask hardcodes priority: 'medium', overwriting the original.
    // See BUG_REPORT.md. Intentionally left unfixed — test documents actual behavior.
    test('should overwrite priority to "medium" — known bug: completeTask hardcodes priority', async () => {
      const created = await request(app).post('/tasks').send({ title: 'High priority', priority: 'high' });
      const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('medium');
    });

    test('should be idempotent — completing an already completed task', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Complete me' });
      await request(app).patch(`/tasks/${created.body.id}/complete`);
      const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
    });

    test('should preserve id and title after completion', async () => {
      const created = await request(app).post('/tasks').send({ title: 'My task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('My task');
    });
  });

  // ─── PATCH /tasks/:id/assign ───────────────────────────────────────────

  describe('PATCH /tasks/:id/assign', () => {
    test('should assign a task and return the updated task', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Assign me' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Alice');
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('Assign me');
    });

    test('should return 404 for non-existent task', async () => {
      const res = await request(app).patch('/tasks/nonexistent/assign').send({ assignee: 'Alice' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('should return 400 when assignee is missing', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee');
    });

    test('should return 400 when assignee is empty string', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee');
    });

    test('should return 400 when assignee is whitespace only', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee');
    });

    test('should return 400 when assignee is not a string', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 42 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee');
    });

    test('should allow reassigning an already assigned task', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    test('should trim whitespace around assignee name', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: '  Alice  ' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Alice');
    });

    test('should return 400 when body is null', async () => {
      const created = await request(app).post('/tasks').send({ title: 'Task' });
      const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send(null);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee');
    });
  });

  // ─── GET /tasks/stats ──────────────────────────────────────────────────

  describe('GET /tasks/stats', () => {
    test('should return zero counts for empty store', async () => {
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    test('should count tasks by status correctly', async () => {
      await request(app).post('/tasks').send({ title: 'T1', status: 'todo' });
      await request(app).post('/tasks').send({ title: 'T2', status: 'todo' });
      await request(app).post('/tasks').send({ title: 'T3', status: 'in_progress' });
      await request(app).post('/tasks').send({ title: 'T4', status: 'done' });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body.todo).toBe(2);
      expect(res.body.in_progress).toBe(1);
      expect(res.body.done).toBe(1);
      expect(res.body.overdue).toBe(0);
    });

    test('should count overdue tasks (past dueDate, not done)', async () => {
      const pastDate = '2020-01-01T00:00:00Z';
      await request(app).post('/tasks').send({ title: 'Overdue', status: 'todo', dueDate: pastDate });
      await request(app).post('/tasks').send({ title: 'Also overdue', status: 'in_progress', dueDate: pastDate });

      const res = await request(app).get('/tasks/stats');
      expect(res.body.overdue).toBe(2);
    });

    test('should not count done tasks with past dueDate as overdue', async () => {
      const pastDate = '2020-01-01T00:00:00Z';
      await request(app).post('/tasks').send({ title: 'Done', status: 'done', dueDate: pastDate });

      const res = await request(app).get('/tasks/stats');
      expect(res.body.overdue).toBe(0);
    });

    test('should not count tasks with future dueDate as overdue', async () => {
      const futureDate = '2099-12-31T23:59:59Z';
      await request(app).post('/tasks').send({ title: 'Future', status: 'todo', dueDate: futureDate });

      const res = await request(app).get('/tasks/stats');
      expect(res.body.overdue).toBe(0);
    });

    test('should not count tasks with null dueDate as overdue', async () => {
      await request(app).post('/tasks').send({ title: 'No due date', status: 'todo', dueDate: null });

      const res = await request(app).get('/tasks/stats');
      expect(res.body.overdue).toBe(0);
    });
  });
});
