const User = require('../models/user');
const Task = require('../models/task');

module.exports = function (router) {
  router.get('/users', async (req, res) => {
    const where = parseJSONParam(req.query.where) ?? {};
    if (req.query.where && where === null) return fail(res, 400, 'Invalid JSON in "where"');
    const sort = parseJSONParam(req.query.sort);
    if (req.query.sort && sort === null) return fail(res, 400, 'Invalid JSON in "sort"');
    const select = parseJSONParam(req.query.select);
    if (req.query.select && select === null) return fail(res, 400, 'Invalid JSON in "select"');
    const skip = req.query.skip ? parseInt(req.query.skip, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const countOnly = req.query.count === 'true';
    try {
      if (countOnly) {
        const count = await User.countDocuments(where);
        return ok(res, count);
      }
      let q = User.find(where);
      if (sort) q = q.sort(sort);
      if (select) q = q.select(select);
      if (skip) q = q.skip(skip);
      if (limit) q = q.limit(limit);
      const users = await q.exec();
      return ok(res, users);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.post('/users', async (req, res) => {
    const { name, email } = req.body || {};
    if (!name || !email) return fail(res, 400, 'Name and email are required');
    try {
      const exists = await User.findOne({ email }).exec();
      if (exists) return fail(res, 400, 'A user with that email already exists');
      const user = await User.create({
        name,
        email,
        pendingTasks: Array.isArray(req.body.pendingTasks) ? req.body.pendingTasks : []
      });
      return ok(res, user, 'User created', 201);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.get('/users/:id', async (req, res) => {
    const select = parseJSONParam(req.query.select);
    if (req.query.select && select === null) return fail(res, 400, 'Invalid JSON in "select"');
    try {
      const user = await User.findById(req.params.id, select || undefined).exec();
      if (!user) return fail(res, 404, 'User not found');
      return ok(res, user);
    } catch {
      return fail(res, 404, 'User not found');
    }
  });

  router.put('/users/:id', async (req, res) => {
    const { name, email, pendingTasks } = req.body || {};
    if (!name || !email) return fail(res, 400, 'Name and email are required');
    try {
      const user = await User.findById(req.params.id).exec();
      if (!user) return fail(res, 404, 'User not found');
      const dup = await User.findOne({ email, _id: { $ne: user._id } }).exec();
      if (dup) return fail(res, 400, 'A user with that email already exists');

      const newList = Array.isArray(pendingTasks) ? pendingTasks : [];
      const oldSet = new Set(user.pendingTasks.map(String));
      const newSet = new Set(newList.map(String));
      const toRemove = [...oldSet].filter(id => !newSet.has(id));
      const toAdd = [...newSet].filter(id => !oldSet.has(id));

      if (toRemove.length) {
        await Task.updateMany(
          { _id: { $in: toRemove }, assignedUser: String(user._id) },
          { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
        );
      }
      if (toAdd.length) {
        await Task.updateMany(
          { _id: { $in: toAdd } },
          { $set: { assignedUser: String(user._id), assignedUserName: name } }
        );
      }

      user.name = name;
      user.email = email;
      user.pendingTasks = newList;
      await user.save();
      return ok(res, user);
    } catch {
      return fail(res, 500, 'Server error');
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id).exec();
      if (!user) return fail(res, 404, 'User not found');
      await Task.updateMany(
        { assignedUser: String(user._id) },
        { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
      );
      await user.deleteOne();
      return ok(res, {}, 'User deleted', 204);
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
