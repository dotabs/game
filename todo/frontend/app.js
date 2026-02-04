const API = "http://localhost:3001/api"

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
}

const state = { token: "", username: "", userId: "", todos: [], editingId: "" }

const setCookie = (name, value) => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`
}

const getCookie = (name) => {
  const parts = document.cookie.split(";").map(s => s.trim())
  const hit = parts.find(p => p.startsWith(name + "="))
  return hit ? decodeURIComponent(hit.split("=").slice(1).join("=")) : ""
}

const clearCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
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
  arr.forEach(el => {
    el.textContent = ""
    el.classList.add("hidden")
    el.classList.remove("ok", "error")
  })
}

const api = async (path, method = "GET", body) => {
  const headers = { "Content-Type": "application/json" }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Request failed")
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
}

const loadTodos = async () => {
  const todos = await api("/todos")
  state.todos = Array.isArray(todos) ? todos : []
  renderTodos()
}

const renderTodos = () => {
  els.count.textContent = state.todos.length ? `${state.todos.length} item(s)` : "No items yet"
  if (!state.todos.length) {
    els.list.innerHTML = `<div class="muted">Create a todo to get started.</div>`
    return
  }

  els.list.innerHTML = state.todos.map(t => {
    const title = escapeHtml(t.title || "")
    const desc = escapeHtml(t.description || "")
    const done = t.completed ? "checked" : ""
    const extra = desc ? `<p>${desc}</p>` : ""
    return `
      <div class="todo" data-id="${t.id}">
        <input type="checkbox" class="toggle" ${done} />
        <div>
          <h3>${title}</h3>
          ${extra}
        </div>
        <div class="right">
          <button type="button" class="ghost edit">Edit</button>
          <button type="button" class="danger del">Delete</button>
        </div>
      </div>
    `
  }).join("")

  els.list.querySelectorAll(".toggle").forEach(cb => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.closest(".todo").dataset.id
      const t = state.todos.find(x => x.id === id)
      if (!t) return
      try {
        await api(`/todos/${id}`, "PUT", { completed: !t.completed })
        await loadTodos()
      } catch (err) {
        msg(els.createMsg, err.message)
      }
    })
  })

  els.list.querySelectorAll(".edit").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest(".todo").dataset.id
      const t = state.todos.find(x => x.id === id)
      if (!t) return
      state.editingId = id
      els.editTitle.value = t.title || ""
      els.editDesc.value = t.description || ""
      els.editDone.checked = !!t.completed
      els.editPanel.classList.remove("hidden")
      clearMsg(els.editMsg)
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
  })

  els.list.querySelectorAll(".del").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".todo").dataset.id
      if (!confirm("Delete this todo?")) return
      try {
        await api(`/todos/${id}`, "DELETE")
        await loadTodos()
        if (state.editingId === id) closeEdit()
      } catch (err) {
        msg(els.createMsg, err.message)
      }
    })
  })
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]))

const closeEdit = () => {
  state.editingId = ""
  els.editForm.reset()
  els.editPanel.classList.add("hidden")
  clearMsg(els.editMsg)
}

els.tabLogin.addEventListener("click", () => setTab("login"))
els.tabRegister.addEventListener("click", () => setTab("register"))

els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.regMsg)
  const username = document.getElementById("regUsername").value.trim()
  const email = document.getElementById("regEmail").value.trim()
  const password = document.getElementById("regPassword").value
  if (!username || !email || !password) return msg(els.regMsg, "Fill in all fields")
  try {
    await api("/auth/register", "POST", { username, email, password })
    msg(els.regMsg, "Account created. You can login now.", true)
    els.registerForm.reset()
    setTab("login")
  } catch (err) {
    msg(els.regMsg, err.message)
  }
})

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.loginMsg)
  const username = document.getElementById("loginUsername").value.trim()
  const password = document.getElementById("loginPassword").value
  if (!username || !password) return msg(els.loginMsg, "Enter username and password")
  try {
    const r = await api("/auth/login", "POST", { username, password })
    state.token = r.token || ""
    const payload = decodeJwt(state.token)
    if (!state.token || !payload?.userId) throw new Error("Login failed")
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("Token expired")
    state.userId = payload.userId
    state.username = payload.username || username
    setCookie("authToken", state.token)
    showApp()
    closeEdit()
    clearMsg(els.createMsg)
    await loadTodos()
    els.loginForm.reset()
  } catch (err) {
    msg(els.loginMsg, err.message)
  }
})

els.createForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.createMsg)
  const title = els.title.value.trim()
  const description = els.desc.value.trim()
  if (!title) return msg(els.createMsg, "Title is required")
  try {
    await api("/todos", "POST", { title, description })
    els.createForm.reset()
    await loadTodos()
  } catch (err) {
    msg(els.createMsg, err.message)
  }
})

els.editForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearMsg(els.editMsg)
  const id = state.editingId
  if (!id) return
  const title = els.editTitle.value.trim()
  const description = els.editDesc.value.trim()
  const completed = els.editDone.checked
  if (!title) return msg(els.editMsg, "Title is required")
  try {
    await api(`/todos/${id}`, "PUT", { title, description, completed })
    closeEdit()
    await loadTodos()
  } catch (err) {
    msg(els.editMsg, err.message)
  }
})

els.cancelEdit.addEventListener("click", closeEdit)

els.logoutBtn.addEventListener("click", () => {
  clearCookie("authToken")
  state.token = ""
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
  if (!token) return showAuth()
  const payload = decodeJwt(token)
  if (!payload?.userId) {
    clearCookie("authToken")
    return showAuth()
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearCookie("authToken")
    return showAuth()
  }
  state.token = token
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
