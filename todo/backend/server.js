const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { v4: uuid } = require("uuid")

const app = express()
const PORT = 3001
const SECRET = "your-secret-key-change-in-production"

app.use(cors())
app.use(express.json())

const usersByName = new Map()
const todosByUser = new Map()

const signToken = (user) => jwt.sign({ userId: user.userId, username: user.username }, SECRET, { expiresIn: "24h" })

const readToken = (req) => {
  const h = req.headers.authorization || ""
  const token = h.startsWith("Bearer ") ? h.slice(7) : ""
  return token
}

const auth = (req, res, next) => {
  const token = readToken(req)
  if (!token) return res.status(401).json({ error: "No token provided" })
  try {
    const payload = jwt.verify(token, SECRET)
    req.userId = payload.userId
    next()
  } catch {
    res.status(403).json({ error: "Invalid or expired token" })
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body || {}
  if (!username || !email || !password) return res.status(400).json({ error: "username, email, password required" })
  if (usersByName.has(username)) return res.status(409).json({ error: "Username already exists" })

  const user = { userId: uuid(), username, email, passwordHash: await bcrypt.hash(password, 10) }
  usersByName.set(username, user)
  res.status(201).json({ userId: user.userId, username: user.username })
})

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: "username and password required" })

  const user = usersByName.get(username)
  if (!user) return res.status(401).json({ error: "Invalid username or password" })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: "Invalid username or password" })

  res.json({ token: signToken(user), userId: user.userId, username: user.username })
})

app.get("/api/todos", auth, (req, res) => {
  const list = todosByUser.get(req.userId) || []
  res.json(list)
})

app.post("/api/todos", auth, (req, res) => {
  const { title, description } = req.body || {}
  if (!title) return res.status(400).json({ error: "Title is required" })

  const todo = { id: uuid(), title, description: description || "", completed: false, createdAt: new Date().toISOString() }
  const list = todosByUser.get(req.userId) || []
  list.push(todo)
  todosByUser.set(req.userId, list)
  res.status(201).json(todo)
})

app.put("/api/todos/:id", auth, (req, res) => {
  const id = req.params.id
  const list = todosByUser.get(req.userId) || []
  const t = list.find(x => x.id === id)
  if (!t) return res.status(404).json({ error: "Todo not found" })

  const { title, description, completed } = req.body || {}
  if (title !== undefined) t.title = title
  if (description !== undefined) t.description = description
  if (completed !== undefined) t.completed = !!completed
  t.updatedAt = new Date().toISOString()
  res.json(t)
})

app.delete("/api/todos/:id", auth, (req, res) => {
  const id = req.params.id
  const list = todosByUser.get(req.userId) || []
  const idx = list.findIndex(x => x.id === id)
  if (idx === -1) return res.status(404).json({ error: "Todo not found" })
  const removed = list.splice(idx, 1)[0]
  todosByUser.set(req.userId, list)
  res.json({ ok: true, todo: removed })
})

app.get("/api/health", (req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Todo API running at http://localhost:${PORT}`))
