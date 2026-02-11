# Todo App (Live Server + Separate API)

Vanilla JS frontend + Node/Express API with:
- register
- login
- logout
- view todos
- create todo
- edit todo (title, description, completed)
- mark complete
- delete todo

Auth token is stored only in `document.cookie` (`authToken`) and sent as `Authorization: Bearer <token>` on every API request.

## Run with VSCode Live Server

1. Install dependencies:
```bash
npm install
```

2. Start backend API (default `http://localhost:3001`):
```bash
npm start
```

3. Open frontend with VSCode Live Server:
- Open `frontend/index.html`
- Click "Go Live"
- Default URL is usually `http://localhost:5500/frontend/index.html`

## API URL setup

Set frontend API base URL in:

`frontend/config.js`

```js
window.APP_CONFIG = {
  API_URL: "http://localhost:3001/api",
}
```

If your backend runs on a different port (example `3000`), change it to:

```js
API_URL: "http://localhost:3000/api"
```

## CORS for Live Server

Backend allows:
- Origins: `http://localhost:5500`, `http://127.0.0.1:5500`
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Content-Type, Authorization`
- Preflight: responds to `OPTIONS` with `204`

## Backend environment variables

- `PORT` (optional, default `3001`)
- `JWT_SECRET` (optional)
