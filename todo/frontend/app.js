const API_URL = (
  window.API_URL ||
  window.APP_CONFIG?.API_URL ||
  "http://localhost:3001/api"
).replace(/\/$/, "")

const els = {
  authCard: document.getElementById("authCard"),
  appCard: document.getElementById("appCard"),
  userBar: document.getElementById("userBar"),
  who: document.getElementById("who"),
  logoutBtn: document.getElementById("logoutBtn"),
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginMsg: document.getElementById("loginMsg"),
  regMsg: document.getElementById("regMsg"),
  createForm: document.getElementById("createForm"),
  createMsg: document.getElementById("createMsg"),
  title: document.getElementById("title"),
  desc: document.getElementById("desc"),
  list: document.getElementById("list"),
  count: document.getElementById("count"),
  editPanel: document.getElementById("editPanel"),
  editForm: document.getElementById("editForm"),
  editTitle: document.getElementById("editTitle"),
  editDesc: document.getElementById("editDesc"),
  editDone: document.getElementById("editDone"),
  editMsg: document.getElementById("editMsg"),
  cancelEdit: document.getElementById("cancelEdit"),
  loginIdentifier: document.getElementById("loginIdentifier"),
  loginPassword: document.getElementById("loginPassword"),
  regUsername: document.getElementById("regUsername"),
  regEmail: document.getElementById("regEmail"),
  regPassword: document.getElementById("regPassword"),
  loginSubmit: document.getElementById("loginSubmit"),
  loginLoading: document.getElementById("loginLoading"),
  registerSubmit: document.getElementById("registerSubmit"),
  registerLoading: document.getElementById("registerLoading"),
  createSubmit: document.getElementById("createSubmit"),
  createLoading: document.getElementById("createLoading"),
  editSubmit: document.getElementById("editSubmit"),
  editLoading: document.getElementById("editLoading"),
  errs: {
    loginIdentifier: document.getElementById("loginIdentifierErr"),
    loginPassword: document.getElementById("loginPasswordErr"),
    regUsername: document.getElementById("regUsernameErr"),
    regEmail: document.getElementById("regEmailErr"),
    regPassword: document.getElementById("regPasswordErr"),
    title: document.getElementById("titleErr"),
    editTitle: document.getElementById("editTitleErr"),
  },
}

const state = { username: "", userId: "", todos: [], editingId: "", inFlight: false }

const setCookie = (name, value) => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax${secure}`
}

const getCookie = (name) => {
  const parts = document.cookie.split(";").map((s) => s.trim())
  const hit = parts.find((p) => p.startsWith(name + "="))
  return hit ? decodeURIComponent(hit.split("=").slice(1).join("=")) : ""
}

const clearCookie = (name) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${secure}`
}

const decodeJwt = (token) => {
  try {
    const p = token.split(".")[1]
    if (!p) return null
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64 + "===".slice((b64.length + 3) % 4)
    return JSON.parse(atob(pad))
  } catch {
    return null
  }
}

const msg = (el, text, ok = false) => {
  el.textContent = text
  el.classList.remove("hidden", "ok", "error")
  el.classList.add(ok ? "ok" : "error")
}

const clearMsg = (...arr) => {
  arr.forEach((el) => {
    el.textContent = ""
    el.classList.add("hidden")
    el.classList.remove("ok", "error")
  })
}

const setFieldError = (key, text = "") => {
  const el = els.errs[key]
  if (!el) return
  if (text) {
    el.textContent = text
    el.classList.remove("hidden")
  } else {
    el.textContent = ""
    el.classList.add("hidden")
  }
}

const clearFieldErrors = (...keys) => keys.forEach((key) => setFieldError(key, ""))

const withLoading = (buttonEl, loadingEl, enabled, originalLabel) => {
  if (enabled) {
    buttonEl.disabled = false
    if (originalLabel) buttonEl.textContent = originalLabel
    loadingEl.classList.add("hidden")
  } else {
    if (originalLabel) buttonEl.textContent = "Please wait..."
    buttonEl.disabled = true
    loadingEl.classList.remove("hidden")
  }
}

const api = async (path, method = "GET", body) => {
  const headers = { "Content-Type": "application/json" }
  const token = getCookie("authToken")
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    throw new Error(
      `Network/CORS error reaching API (${API_URL}). Check backend URL, backend server, and CORS settings.`,
    )
  }

  const raw = await res.text()
  let data = {}
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { error: raw }
    }
  }

  if (!res.ok) {
    const serverMessage = data.error || data.message || ""
    const statusMessage = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`
    throw new Error(serverMessage ? `${statusMessage}: ${serverMessage}` : statusMessage)
  }

  if (!raw) {
    return null
  }

  return data
}

const showAuth = () => {
  els.authCard.classList.remove("hidden")
  els.appCard.classList.add("hidden")
  els.userBar.classList.add("hidden")
}

const showApp = () => {
  els.authCard.classList.add("hidden")
  els.appCard.classList.remove("hidden")
  els.userBar.classList.remove("hidden")
  els.who.textContent = state.username || "user"
}

const setTab = (name) => {
  const login = name === "login"
  els.tabLogin.classList.toggle("active", login)
  els.tabRegister.classList.toggle("active", !login)
  els.loginForm.classList.toggle("hidden", !login)
  els.registerForm.classList.toggle("hidden", login)
  clearMsg(els.loginMsg, els.regMsg)
  clearFieldErrors("loginIdentifier", "loginPassword", "regUsername", "regEmail", "regPassword")
}

const loadTodos = async () => {
  const todos = await api("/todos")
  state.todos = Array.isArray(todos) ? todos : []
  renderTodos()
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]))

const closeEdit = () => {
  state.editingId = ""
  els.editForm.reset()
  els.editPanel.classList.add("hidden")
  clearMsg(els.editMsg)
  clearFieldErrors("editTitle")
  withLoading(els.editSubmit, els.editLoading, true, "Save")
}

const renderTodos = () => {
  els.count.textContent = state.todos.length ? `${state.todos.length} item(s)` : "No items yet"
  if (!state.todos.length) {
    els.list.innerHTML = '<div class="muted">Create a todo to get started.</div>'
    return
  }

  els.list.innerHTML = state.todos
    .map((t) => {
      const title = escapeHtml(t.title || "")
      const desc = escapeHtml(t.description || "")
      const done = t.completed ? "checked" : ""
      const titleClass = t.completed ? "done" : ""
      const extra = desc ? `<p>${desc}</p>` : ""
      return `
      <div class="todo" data-id="${t.id}">
        <input type="checkbox" class="toggle" ${done} aria-label="Toggle completion for ${title}" />
        <div>
          <h3 class="${titleClass}">${title}</h3>
          ${extra}
        </div>
        <div class="right">
          <button type="button" class="ghost edit">Edit</button>
          <button type="button" class="danger del">Delete</button>
        </div>
      </div>
    `
    })
    .join("")

  els.list.querySelectorAll(".toggle").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.closest(".todo").dataset.id
      const t = state.todos.find((x) => x.id === id)
      if (!t) return
      try {
        await api(`/todos/${id}`, "PUT", { completed: !t.completed })
        await loadTodos()
      } catch (error) {
        msg(els.createMsg, error.message)
      }
    })
  })

  els.list.querySelectorAll(".edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest(".todo").dataset.id
      const t = state.todos.find((x) => x.id === id)
      if (!t) return
      state.editingId = id
      els.editTitle.value = t.title || ""
      els.editDesc.value = t.description || ""
      els.editDone.checked = Boolean(t.completed)
      clearMsg(els.editMsg)
      clearFieldErrors("editTitle")
      els.editPanel.classList.remove("hidden")
      els.editTitle.focus()
    })
  })

  els.list.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".todo").dataset.id
      if (!window.confirm("Delete this todo?")) return
      try {
        await api(`/todos/${id}`, "DELETE")
        await loadTodos()
        if (state.editingId === id) closeEdit()
      } catch (error) {
        msg(els.createMsg, error.message)
      }
    })
  })
}

els.tabLogin.addEventListener("click", () => setTab("login"))
els.tabRegister.addEventListener("click", () => setTab("register"))

els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.regMsg)
  clearFieldErrors("regUsername", "regEmail", "regPassword")

  const username = els.regUsername.value.trim()
  const email = els.regEmail.value.trim()
  const password = els.regPassword.value

  let hasError = false
  if (!username) {
    setFieldError("regUsername", "Username is required")
    hasError = true
  }
  if (!email) {
    setFieldError("regEmail", "Email is required")
    hasError = true
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    setFieldError("regEmail", "Please enter a valid email")
    hasError = true
  }
  if (!password) {
    setFieldError("regPassword", "Password is required")
    hasError = true
  } else if (password.length < 6) {
    setFieldError("regPassword", "Password must be at least 6 characters")
    hasError = true
  }
  if (hasError) return

  withLoading(els.registerSubmit, els.registerLoading, false, "Create account")
  try {
    await api("/auth/register", "POST", { username, email, password })
    msg(els.regMsg, "Account created. Please sign in.", true)
    els.registerForm.reset()
    setTab("login")
  } catch (error) {
    msg(els.regMsg, error.message)
  } finally {
    withLoading(els.registerSubmit, els.registerLoading, true, "Create account")
  }
})

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.loginMsg)
  clearFieldErrors("loginIdentifier", "loginPassword")

  const identifier = els.loginIdentifier.value.trim()
  const password = els.loginPassword.value

  let hasError = false
  if (!identifier) {
    setFieldError("loginIdentifier", "Username or email is required")
    hasError = true
  }
  if (!password) {
    setFieldError("loginPassword", "Password is required")
    hasError = true
  }
  if (hasError) return

  withLoading(els.loginSubmit, els.loginLoading, false, "Login")
  try {
    const result = await api("/auth/login", "POST", { identifier, password })
    const token = result.token || ""
    const payload = decodeJwt(token)
    if (!token || !payload?.userId) {
      throw new Error("Login response is invalid")
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Session expired, please login again")
    }

    state.userId = payload.userId
    state.username = payload.username || identifier
    setCookie("authToken", token)

    showApp()
    closeEdit()
    clearMsg(els.createMsg)
    await loadTodos()
    els.loginForm.reset()
  } catch (error) {
    msg(els.loginMsg, error.message)
  } finally {
    withLoading(els.loginSubmit, els.loginLoading, true, "Login")
  }
})

els.createForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.createMsg)
  clearFieldErrors("title")

  const title = els.title.value.trim()
  const description = els.desc.value.trim()
  if (!title) {
    setFieldError("title", "Title is required")
    return
  }

  withLoading(els.createSubmit, els.createLoading, false, "Add Todo")
  try {
    await api("/todos", "POST", { title, description })
    els.createForm.reset()
    await loadTodos()
  } catch (error) {
    msg(els.createMsg, error.message)
  } finally {
    withLoading(els.createSubmit, els.createLoading, true, "Add Todo")
  }
})

els.editForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.editMsg)
  clearFieldErrors("editTitle")

  const id = state.editingId
  if (!id) return

  const title = els.editTitle.value.trim()
  const description = els.editDesc.value.trim()
  const completed = els.editDone.checked
  if (!title) {
    setFieldError("editTitle", "Title is required")
    return
  }

  withLoading(els.editSubmit, els.editLoading, false, "Save")
  try {
    await api(`/todos/${id}`, "PUT", { title, description, completed })
    closeEdit()
    await loadTodos()
  } catch (error) {
    msg(els.editMsg, error.message)
  } finally {
    withLoading(els.editSubmit, els.editLoading, true, "Save")
  }
})

els.cancelEdit.addEventListener("click", closeEdit)

els.logoutBtn.addEventListener("click", () => {
  clearCookie("authToken")
  state.userId = ""
  state.username = ""
  state.todos = []
  closeEdit()
  showAuth()
  setTab("login")
})

const boot = async () => {
  setTab("login")
  const token = getCookie("authToken")
  if (!token) {
    showAuth()
    return
  }

  const payload = decodeJwt(token)
  if (!payload?.userId || (payload.exp && payload.exp * 1000 < Date.now())) {
    clearCookie("authToken")
    showAuth()
    return
  }

  state.userId = payload.userId
  state.username = payload.username || "user"
  showApp()

  try {
    await loadTodos()
  } catch {
    clearCookie("authToken")
    showAuth()
  }
}

document.addEventListener("DOMContentLoaded", boot)
