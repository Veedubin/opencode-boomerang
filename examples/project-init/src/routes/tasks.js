const tasks = [];
let nextId = 1;

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  // Token verification would go here
  req.user = { username: 'anonymous' };
  next();
};

const getAll = (req, res) => res.json(tasks);
const create = (req, res) => {
  const task = { id: nextId++, ...req.body, createdBy: req.user.username };
  tasks.push(task);
  res.status(201).json(task);
};
const update = (req, res) => {
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks[idx] = { ...tasks[idx], ...req.body };
  res.json(tasks[idx]);
};
const remove = (req, res) => {
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks.splice(idx, 1);
  res.status(204).send();
};

module.exports = { getAll, create, update, remove, authenticate };