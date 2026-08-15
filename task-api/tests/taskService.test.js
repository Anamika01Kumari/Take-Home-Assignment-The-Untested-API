const taskService = require('../src/services/taskService');

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    test('should create a task with all provided fields', () => {
      const data = {
        title: 'Test task',
        description: 'A description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59Z',
      };
      const task = taskService.create(data);

      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('Test task');
      expect(task.description).toBe('A description');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2026-12-31T23:59:59Z');
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(typeof task.createdAt).toBe('string');
    });

    test('should apply default values for omitted fields', () => {
      const task = taskService.create({ title: 'Minimal task' });

      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
    });

    test('should generate unique ids for different tasks', () => {
      const task1 = taskService.create({ title: 'Task 1' });
      const task2 = taskService.create({ title: 'Task 2' });

      expect(task1.id).not.toBe(task2.id);
    });

    test('should store the task so getAll returns it', () => {
      const task = taskService.create({ title: 'Stored task' });
      const all = taskService.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(task.id);
    });
  });

  describe('getAll', () => {
    test('should return empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    test('should return all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      expect(taskService.getAll()).toHaveLength(3);
    });

    test('should return a shallow copy of the array', () => {
      taskService.create({ title: 'Task 1' });
      const snapshot = taskService.getAll();
      taskService.create({ title: 'Task 2' });

      expect(snapshot).toHaveLength(1);
      expect(taskService.getAll()).toHaveLength(2);
    });
  });

  describe('findById', () => {
    test('should return the task when id exists', () => {
      const created = taskService.create({ title: 'Find me' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find me');
    });

    test('should return undefined when id does not exist', () => {
      const found = taskService.findById('nonexistent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    test('should return only tasks matching the exact status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });
      taskService.create({ title: 'Task 4', status: 'todo' });

      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(2);
      todoTasks.forEach((t) => expect(t.status).toBe('todo'));
    });

    test('should return empty array when no tasks match the status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      expect(taskService.getByStatus('done')).toEqual([]);
    });

    // KNOWN BUG (Bug #2): getByStatus uses .includes() instead of ===, so substring queries match.
    // See BUG_REPORT.md. Intentionally left unfixed — tests document actual behavior.
    test('should match on substring "to" — known bug: getByStatus uses .includes()', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });

      const results = taskService.getByStatus('to');
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('todo');
    });

    test('should match on substring "in" — known bug: getByStatus uses .includes()', () => {
      taskService.create({ title: 'Task 1', status: 'in_progress' });

      const results = taskService.getByStatus('in');
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('in_progress');
    });

    test('should return empty array for empty store', () => {
      expect(taskService.getByStatus('todo')).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 25; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    test('page 1 should return the first `limit` tasks', () => {
      const page1 = taskService.getPaginated(1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[9].title).toBe('Task 10');
    });

    test('page 2 should return the next `limit` tasks', () => {
      const page2 = taskService.getPaginated(2, 10);
      expect(page2).toHaveLength(10);
      expect(page2[0].title).toBe('Task 11');
      expect(page2[9].title).toBe('Task 20');
    });

    test('last page should return remaining tasks', () => {
      const page3 = taskService.getPaginated(3, 10);
      expect(page3).toHaveLength(5);
      expect(page3[0].title).toBe('Task 21');
      expect(page3[4].title).toBe('Task 25');
    });

    test('page beyond available data should return empty array', () => {
      const page4 = taskService.getPaginated(4, 10);
      expect(page4).toEqual([]);
    });

    test('page 0 should return empty array (pages are 1-based)', () => {
      const page0 = taskService.getPaginated(0, 10);
      expect(page0).toEqual([]);
    });

    test('limit larger than total should return all tasks', () => {
      const result = taskService.getPaginated(1, 100);
      expect(result).toHaveLength(25);
    });
  });

  describe('getStats', () => {
    test('should return zero counts for empty store', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    test('should count tasks by status correctly', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'todo' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      taskService.create({ title: 'T4', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(2);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(0);
    });

    test('should count overdue tasks (past dueDate, not done)', () => {
      const pastDate = '2020-01-01T00:00:00Z';
      taskService.create({ title: 'Overdue task', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'In progress overdue', status: 'in_progress', dueDate: pastDate });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(2);
    });

    test('should not count done tasks with past dueDate as overdue', () => {
      const pastDate = '2020-01-01T00:00:00Z';
      taskService.create({ title: 'Done task', status: 'done', dueDate: pastDate });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });

    test('should not count tasks with future dueDate as overdue', () => {
      const futureDate = '2099-12-31T23:59:59Z';
      taskService.create({ title: 'Future task', status: 'todo', dueDate: futureDate });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });

    test('should not count tasks with null dueDate as overdue', () => {
      taskService.create({ title: 'No due date', status: 'todo', dueDate: null });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });
  });

  describe('update', () => {
    test('should update fields on an existing task', () => {
      const task = taskService.create({ title: 'Original', priority: 'low' });
      const updated = taskService.update(task.id, { title: 'Updated', priority: 'high' });

      expect(updated.title).toBe('Updated');
      expect(updated.priority).toBe('high');
      expect(updated.id).toBe(task.id);
    });

    test('should preserve unmodified fields', () => {
      const task = taskService.create({ title: 'Original', priority: 'low', status: 'todo' });
      const updated = taskService.update(task.id, { priority: 'high' });

      expect(updated.title).toBe('Original');
      expect(updated.status).toBe('todo');
      expect(updated.priority).toBe('high');
    });

    test('should return null for non-existent id', () => {
      const result = taskService.update('nonexistent', { title: 'Updated' });
      expect(result).toBeNull();
    });

    test('should allow overwriting id field (protected field)', () => {
      const task = taskService.create({ title: 'Original' });
      const updated = taskService.update(task.id, { id: 'hacked-id' });

      expect(updated.id).toBe('hacked-id');
    });

    test('should allow overwriting createdAt field (protected field)', () => {
      const task = taskService.create({ title: 'Original' });
      const originalCreatedAt = task.createdAt;
      const updated = taskService.update(task.id, { createdAt: '2000-01-01T00:00:00Z' });

      expect(updated.createdAt).not.toBe(originalCreatedAt);
      expect(updated.createdAt).toBe('2000-01-01T00:00:00Z');
    });

    test('should allow overwriting completedAt field (protected field)', () => {
      const task = taskService.create({ title: 'Original' });
      const updated = taskService.update(task.id, { completedAt: '2000-01-01T00:00:00Z' });

      expect(updated.completedAt).toBe('2000-01-01T00:00:00Z');
    });
  });

  describe('remove', () => {
    test('should remove an existing task and return true', () => {
      const task = taskService.create({ title: 'Delete me' });
      const result = taskService.remove(task.id);

      expect(result).toBe(true);
      expect(taskService.getAll()).toHaveLength(0);
    });

    test('should return false for non-existent id', () => {
      const result = taskService.remove('nonexistent-id');
      expect(result).toBe(false);
    });

    test('should only remove the targeted task', () => {
      const task1 = taskService.create({ title: 'Keep me' });
      const task2 = taskService.create({ title: 'Delete me' });
      taskService.remove(task2.id);

      expect(taskService.getAll()).toHaveLength(1);
      expect(taskService.getAll()[0].id).toBe(task1.id);
    });
  });

  describe('completeTask', () => {
    test('should mark a task as done and set completedAt', () => {
      const task = taskService.create({ title: 'Complete me', status: 'todo' });
      const completed = taskService.completeTask(task.id);

      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(typeof completed.completedAt).toBe('string');
    });

    // KNOWN BUG (Bug #3): completeTask hardcodes priority: 'medium', overwriting the original.
    // See BUG_REPORT.md. Intentionally left unfixed — test documents actual behavior.
    test('should overwrite priority to "medium" — known bug: completeTask hardcodes priority', () => {
      const task = taskService.create({ title: 'High priority', status: 'todo', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      expect(completed.priority).toBe('medium');
    });

    test('should return null for non-existent id', () => {
      const result = taskService.completeTask('nonexistent-id');
      expect(result).toBeNull();
    });

    test('should be idempotent — completing an already completed task', () => {
      const task = taskService.create({ title: 'Already done', status: 'todo' });
      const firstComplete = taskService.completeTask(task.id);
      const firstCompletedAt = firstComplete.completedAt;

      const secondComplete = taskService.completeTask(task.id);
      expect(secondComplete.status).toBe('done');
      expect(secondComplete.completedAt).toBeDefined();
    });

    test('should preserve id and title after completion', () => {
      const task = taskService.create({ title: 'My task', status: 'todo' });
      const completed = taskService.completeTask(task.id);

      expect(completed.id).toBe(task.id);
      expect(completed.title).toBe('My task');
    });
  });
});
