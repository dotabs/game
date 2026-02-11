const express = require("express")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const morgan = require("morgan")
const path = require("path")

const db = require("./db")

const app = express()
const PORT = Number(process.env.PORT) || 3001
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me"
const isDev = process.env.NODE_ENV !== "production"
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
])

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const frontendDir = path.join(__dirname, "..", "frontend")

app.use(morgan("dev"))
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization")

  if (req.method === "OPTIONS") {
    return res.sendStatus(204)
  }
  return next()
})
app.use(express.json())
app.use(express.static(frontendDir))

const signToken = (user) => jwt.sign({ userId: user.userId, username: user.username }, JWT_SECRET, { expiresIn: "24h" })

const readToken = (req) => {
  const header = req.headers.authorization || ""
  return header.startsWith("Bearer ") ? header.slice(7) : ""
}

const auth = (req, _res, next) => {
  const token = readToken(req)
  if (!token) {
    console.warn("[auth-error] missing token", { method: req.method, path: req.path })
    return next(new ApiError(401, "No token provided"))
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    req.username = payload.username
    return next()
  } catch {
    console.warn("[auth-error] invalid token", { method: req.method, path: req.path })
    return next(new ApiError(403, "Invalid or expired token"))
  }
}

const api = express.Router()

api.get("/health", (_req, res) => {
  res.json({ ok: true })
})

api.post("/auth/register", asyncHandler(async (req, res) => {
  const { username, email, password } = req.body || {}

  if (!username || !email || !password) {
    throw new ApiError(400, "username, email, password required")
  }
  if (String(password).length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters")
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.createUser({ username, email, passwordHash })
  res.status(201).json(user)
}))

api.post("/auth/login", asyncHandler(async (req, res) => {
  const { identifier, username, email, password } = req.body || {}
  const loginId = identifier || username || email

  if (!loginId || !password) {
    console.warn("[auth-error] login validation failed", { loginId: loginId || "(empty)" })
    throw new ApiError(400, "username/email and password required")
  }

  const user = await db.findUserForLogin(loginId)
  if (!user) {
    console.warn("[auth-error] login user not found", { loginId })
    throw new ApiError(401, "Invalid username/email or password")
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    console.warn("[auth-error] invalid password", { loginId })
    throw new ApiError(401, "Invalid username/email or password")
  }

  res.json({ token: signToken(user), userId: user.userId, username: user.username })
}))

api.get("/todos", auth, asyncHandler(async (req, res) => {
  const list = await db.getTodosByUser(req.userId)
  res.json(list)
}))

api.post("/todos", auth, asyncHandler(async (req, res) => {
  const { title, description } = req.body || {}
  if (!title || !String(title).trim()) {
    throw new ApiError(400, "Title is required")
  }

  const todo = await db.createTodo({ userId: req.userId, title, description })
  res.status(201).json(todo)
}))

api.put("/todos/:id", auth, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { title, description, completed } = req.body || {}

  if (title !== undefined && !String(title).trim()) {
    throw new ApiError(400, "Title cannot be empty")
  }

  const todo = await db.updateTodo({ userId: req.userId, id, title, description, completed })
  if (!todo) {
    throw new ApiError(404, "Todo not found")
  }

  res.json(todo)
}))

api.delete("/todos/:id", auth, asyncHandler(async (req, res) => {
  const { id } = req.params
  const removed = await db.deleteTodo({ userId: req.userId, id })
  if (!removed) {
    throw new ApiError(404, "Todo not found")
  }
  res.json({ ok: true, todo: removed })
}))

app.use("/api", api)

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next(new ApiError(404, "API route not found"))
  }
  return res.sendFile(path.join(frontendDir, "index.html"))
})

app.use((err, req, _res, next) => {
  const status = Number(err.status) || 500
  const message = err.message || "Internal server error"
  const logPayload = {
    method: req.method,
    path: req.path,
    status,
    message,
  }
  if (status >= 500) {
    console.error("[server-error]", isDev ? { ...logPayload, stack: err.stack } : logPayload)
  } else {
    console.error("[request-error]", logPayload)
  }
  req.errorStatus = status
  req.errorMessage = message
  next(err)
})

app.use((err, req, res, _next) => {
  const status = Number(req.errorStatus) || Number(err.status) || 500
  const message = req.errorMessage || err.message || "Internal server error"
  res.status(status).json({ error: message })
})

const start = async () => {
  await db.initDb()
  app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error("Failed to start server", error)
  process.exit(1)
})
