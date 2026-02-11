const fs = require("fs/promises")
const path = require("path")
const { v4: uuid } = require("uuid")

const DB_PATH = path.join(__dirname, "data.json")
const DEFAULT_DB = { users: [], todos: [] }

let db = null
let writeQueue = Promise.resolve()

const normalize = (value) => String(value || "").trim().toLowerCase()

const persist = async () => {
  const payload = JSON.stringify(db, null, 2)
  const tempPath = `${DB_PATH}.tmp`
  writeQueue = writeQueue
    .then(async () => {
      await fs.writeFile(tempPath, payload, "utf8")
      await fs.rename(tempPath, DB_PATH)
    })
    .catch(() => {})
  await writeQueue
}

const ensureDbLoaded = async () => {
  if (db) {
    return
  }

  try {
    const content = await fs.readFile(DB_PATH, "utf8")
    const parsed = JSON.parse(content)
    db = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error
    }
    db = { ...DEFAULT_DB }
    await persist()
  }
}

const sanitizeUser = (user) => ({
  userId: user.userId,
  username: user.username,
  email: user.email,
})

const findUserByUsername = (username) => db.users.find((u) => normalize(u.username) === normalize(username))
const findUserByEmail = (email) => db.users.find((u) => normalize(u.email) === normalize(email))

const initDb = async () => {
  await ensureDbLoaded()
}

const createUser = async ({ username, email, passwordHash }) => {
  await ensureDbLoaded()

  if (findUserByUsername(username)) {
    const err = new Error("Username already exists")
    err.status = 409
    throw err
  }

  if (findUserByEmail(email)) {
    const err = new Error("Email already exists")
    err.status = 409
    throw err
  }

  const user = {
    userId: uuid(),
    username: String(username).trim(),
    email: String(email).trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  db.users.push(user)
  await persist()
  return sanitizeUser(user)
}

const findUserForLogin = async (identifier) => {
  await ensureDbLoaded()
  const needle = normalize(identifier)
  return db.users.find((u) => normalize(u.username) === needle || normalize(u.email) === needle) || null
}

const getTodosByUser = async (userId) => {
  await ensureDbLoaded()
  return db.todos
    .filter((t) => t.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

const createTodo = async ({ userId, title, description }) => {
  await ensureDbLoaded()
  const now = new Date().toISOString()
  const todo = {
    id: uuid(),
    userId,
    title: String(title).trim(),
    description: String(description || "").trim(),
    completed: false,
    createdAt: now,
    updatedAt: now,
  }
  db.todos.push(todo)
  await persist()
  return todo
}

const updateTodo = async ({ userId, id, title, description, completed }) => {
  await ensureDbLoaded()
  const todo = db.todos.find((t) => t.userId === userId && t.id === id)
  if (!todo) {
    return null
  }

  if (title !== undefined) {
    todo.title = String(title).trim()
  }
  if (description !== undefined) {
    todo.description = String(description).trim()
  }
  if (completed !== undefined) {
    todo.completed = Boolean(completed)
  }
  todo.updatedAt = new Date().toISOString()

  await persist()
  return todo
}

const deleteTodo = async ({ userId, id }) => {
  await ensureDbLoaded()
  const idx = db.todos.findIndex((t) => t.userId === userId && t.id === id)
  if (idx === -1) {
    return null
  }
  const [removed] = db.todos.splice(idx, 1)
  await persist()
  return removed
}

module.exports = {
  initDb,
  createUser,
  findUserForLogin,
  getTodosByUser,
  createTodo,
  updateTodo,
  deleteTodo,
}
