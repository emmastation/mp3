const Task = require('../models/task');
const User = require('../models/user');

module.exports = function (router) {
  router.get('/tasks', async (req, res) => {
    const where = parseJSONParam(req.query.where) ?? {};
    if (req.query.where && where === null) return fail(res, 400, 'Invalid JSON in "where"');
    const sort = parseJSONParam(req.query.sort);
    if (req.query.sort && sort === null) return fail(res, 400, 'Invalid JSON in "sort"');
    const select = parseJSONParam(req.query.select);
    if (req.query.select && select === null) return fail(res, 400, 'Invalid JSON in "select"');
    const skip = req.query.skip ? parseInt(req.query.skip, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const countOnly = req.query.count === 'true';
    try {
      if (countOnly) {
        const count = await Task.countDocuments(where);
        return ok(res, count);
      }
      let q = Task.find(where);
      if (sort) q = q.sort(sort);
      if (select) q = q.select(select);
      if (skip) q = q.skip(skip);
      if (limit) q = q.limit(limit);
      const tasks = await q.exec();
      return ok(res, tasks);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.post('/tasks', async (req, res) => {
    const { name, deadline } = req.body || {};
    if (!name || !deadline) return fail(res, 400, 'Task name and deadline are required');
    try {
      let assignedUser = req.body.assignedUser || '';
      let assignedUserName = 'unassigned';
      if (assignedUser) {
        const u = await User.findById(assignedUser).exec();
        if (!u) return fail(res, 400, 'Assigned user does not exist');
        assignedUserName = u.name;
      }
      const task = await Task.create({
        name,
        description: req.body.description || '',
        deadline,
        completed: !!req.body.completed,
        assignedUser,
        assignedUserName
      });
      if (assignedUser && !task.completed) {
        await User.updateOne(
          { _id: assignedUser },
          { $addToSet: { pendingTasks: String(task._id) } }
        );
      }
      return ok(res, task, 'Task created', 201);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.get('/tasks/:id', async (req, res) => {
    const select = parseJSONParam(req.query.select);
    if (req.query.select && select === null) return fail(res, 400, 'Invalid JSON in "select"');
    try {
      const task = await Task.findById(req.params.id, select || undefined).exec();
      if (!task) return fail(res, 404, 'Task not found');
      return ok(res, task);
    } catch {
      return fail(res, 404, 'Task not found');
    }
  });

  router.put('/tasks/:id', async (req, res) => {
    const { name, deadline } = req.body || {};
    if (!name || !deadline) return fail(res, 400, 'Task name and deadline are required');
    try {
      const task = await Task.findById(req.params.id).exec();
      if (!task) return fail(res, 404, 'Task not found');

      const oldUserId = task.assignedUser ? String(task.assignedUser) : '';
      const oldCompleted = !!task.completed;

      let newUserId = req.body.assignedUser || '';
      let newUserName = 'unassigned';
      if (newUserId) {
        const u = await User.findById(newUserId).exec();
        if (!u) return fail(res, 400, 'Assigned user does not exist');
        newUserName = u.name;
      }

      task.name = req.body.name;
      task.description = req.body.description || '';
      task.deadline = req.body.deadline;
      task.completed = !!req.body.completed;
      task.assignedUser = newUserId;
      task.assignedUserName = newUserName;
      await task.save();

      if (oldUserId && (oldUserId !== newUserId || !oldCompleted)) {
        await User.updateOne(
          { _id: oldUserId },
          { $pull: { pendingTasks: String(task._id) } }
        );
      }
      if (newUserId && !task.completed) {
        await User.updateOne(
          { _id: newUserId },
          { $addToSet: { pendingTasks: String(task._id) } }
        );
      }

      return ok(res, task);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.delete('/tasks/:id', async (req, res) => {
    try {
      const task = await Task.findById(req.params.id).exec();
      if (!task) return fail(res, 404, 'Task not found');
      if (task.assignedUser) {
        await User.updateOne(
          { _id: task.assignedUser },
          { $pull: { pendingTasks: String(task._id) } }
        );
      }
      await task.deleteOne();
      return ok(res, {}, 'Task deleted', 204);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });
};

function parseJSONParam(param) {
  if (!param) return undefined;
  try { return JSON.parse(param); } catch { return null; }
}
function ok(res, data, message = 'OK', status = 200) {
  return res.status(status).json({ message, data });
}
function fail(res, status, message, data = {}) {
  return res.status(status).json({ message, data });
}
