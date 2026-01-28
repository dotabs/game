(() => {
  "use strict";
  const DIFFICULTIES = {
    easy:   { label: "Easy (4x4)", rows: 4, cols: 4 },
    medium: { label: "Medium (4x6)", rows: 4, cols: 6 },
    hard:   { label: "Hard (6x6)", rows: 6, cols: 6 },
  };

  const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

  const apply = (node, styles) => Object.assign(node.style, styles);

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "style") apply(node, v);
      else if (k === "className") node.className = v;
      else if (k === "text") node.textContent = v;
      else node[k] = v;
    });
    children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  };

  const pad2 = (n) => String(n).padStart(2, "0"); 
  const fmtTime = (s) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

  const shuffle = (arr) => {
    const a = [...arr]; 
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]; 
    }
    return a;
  };

  const buildDeck = (pairsNeeded) =>
    shuffle(SYMBOLS.slice(0, pairsNeeded).flatMap((s) => [s, s])); 

  const state = {
    rows: 4,
    cols: 4,
    first: null,
    second: null,
    lock: false,
    moves: 0,
    matchedPairs: 0,
    totalPairs: 0,
    seconds: 0,
    timerId: null,
    timerStarted: false,
    gameOver: false,
  };

  const ui = {};

  const COLORS = {
    bg: "#f1f5f9",
    panel: "#ffffff",
    shadow: "0 12px 30px rgba(2,6,23,.12)",
    text: "#0f172a",
    muted: "#64748b",
    blue: "#1e88e5",
    green: "#4caf50",
    border: "#cbd5e1",
  };

 
  const startTimerIfNeeded = () => {
    if (state.timerStarted || state.gameOver) return;
    state.timerStarted = true;
    state.timerId = setInterval(() => {
      state.seconds += 1;
      ui.time.textContent = fmtTime(state.seconds);
    }, 1000);
  };

  const stopTimer = () => {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
    state.timerStarted = false;
  };


  const setCardFace = (card, { up, matched }) => {
    const show = up || matched;

    card.dataset.face = matched ? "matched" : up ? "up" : "down";
    card.disabled = !!matched;

    apply(card, {
      width: "56px",
      height: "56px",
      borderRadius: "6px",
      border: "none",
      cursor: matched ? "default" : "pointer",
      fontWeight: "900",
      fontSize: "22px",
      background: matched ? COLORS.green : up ? COLORS.green : COLORS.blue,
      color: show ? (matched ? "#fff" : COLORS.text) : "transparent",
      userSelect: "none",
    });
  };


  const setMessage = (text) => (ui.msg.textContent = text);
  const updateMoves = () => (ui.moves.textContent = String(state.moves));

  const resetTurn = () => {
    state.first = null;
    state.second = null;
    state.lock = false;
  };

  const checkWin = () => {
    if (state.matchedPairs !== state.totalPairs) return;
    state.gameOver = true;
    stopTimer();
    setMessage(`Game Over! Moves: ${state.moves} • Time: ${fmtTime(state.seconds)}`);
  };

  const handleMatch = () => {
    setCardFace(state.first, { up: true, matched: true });
    setCardFace(state.second, { up: true, matched: true });
    state.matchedPairs += 1;
    setMessage("Match!");
    resetTurn();
    checkWin();
  };

  const handleMiss = () => {
    setMessage("Not a match…");
    setTimeout(() => {
      setCardFace(state.first, { up: false, matched: false });
      setCardFace(state.second, { up: false, matched: false });
      setMessage("Try again.");
      resetTurn();
    }, 650);
  };

  const onGridClick = (e) => {
    const card = e.target.closest("button[data-symbol]");
    if (!card) return;
    if (state.gameOver || state.lock) return;
    if (card.disabled) return;
    if (card === state.first) return;

    startTimerIfNeeded();
    setCardFace(card, { up: true, matched: false });

    if (!state.first) {
      state.first = card;
      setMessage("Pick another card.");
      return;
    }

    state.second = card;
    state.lock = true;

    state.moves += 1;
    updateMoves();

    const isMatch = state.first.dataset.symbol === state.second.dataset.symbol;
    isMatch ? handleMatch() : handleMiss();
  };

  const renderGrid = (deck) => {
    ui.grid.replaceChildren(); 

    apply(ui.grid, {
      display: "grid",
      gap: "10px",
      justifyContent: "center",
      gridTemplateColumns: `repeat(${state.cols}, 56px)`, 
      padding: "6px 0",
    });

    deck.forEach((symbol) => {
      const card = el("button", { type: "button" }, []);
      card.dataset.symbol = symbol;
      card.textContent = symbol; 
      setCardFace(card, { up: false, matched: false });
      ui.grid.appendChild(card); 
    });
  };

  const newGame = () => {
    stopTimer();

    const d = DIFFICULTIES[ui.diff.value] ?? DIFFICULTIES.easy;
    state.rows = d.rows;
    state.cols = d.cols;

    state.first = null;
    state.second = null;
    state.lock = false;
    state.moves = 0;
    state.matchedPairs = 0;
    state.seconds = 0;
    state.timerStarted = false;
    state.gameOver = false;

    state.totalPairs = (state.rows * state.cols) / 2;
    if (state.totalPairs > SYMBOLS.length) {
      throw new Error("Not enough symbols to build this deck.");
    }

    ui.time.textContent = "00:00";
    updateMoves();
    setMessage("Start flipping cards.");

    const deck = buildDeck(state.totalPairs);
    renderGrid(deck);
  };

  const init = () => {
    apply(document.body, {
      margin: "0",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: COLORS.bg,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      color: COLORS.text,
      padding: "24px",
    });

    const app = document.getElementById("app");

    const panel = el("div", { className: "panel" });
    apply(panel, {
      width: "min(360px, 92vw)",
      background: COLORS.panel,
      borderRadius: "12px",
      padding: "18px",
      boxShadow: COLORS.shadow,
    });

    const title = el("div", { text: "Memory Game" });
    apply(title, {
      textAlign: "center",
      fontSize: "28px",
      fontWeight: "800",
      margin: "4px 0 12px",
    });

    ui.diff = el("select");
    Object.entries(DIFFICULTIES).forEach(([k, v]) => {
      ui.diff.appendChild(el("option", { value: k, text: v.label }));
    });
    apply(ui.diff, {
      padding: "10px 12px",
      borderRadius: "8px",
      border: `1px solid ${COLORS.border}`,
      background: "#fff",
      fontSize: "14px",
    });

    ui.newBtn = el("button", { type: "button", text: "New Game" });
    apply(ui.newBtn, {
      padding: "10px 12px",
      borderRadius: "8px",
      border: `1px solid ${COLORS.blue}`,
      background: COLORS.blue,
      color: "#fff",
      fontWeight: "800",
      cursor: "pointer",
      fontSize: "14px",
    });

    const controls = el("div");
    apply(controls, { display: "flex", gap: "10px", justifyContent: "center", alignItems: "center" });
    controls.append(ui.diff, ui.newBtn);

    const stats = el("div");
    apply(stats, { display: "flex", justifyContent: "center", gap: "28px", margin: "10px 0 8px", fontWeight: "800" });

    const movesBox = el("div");
    const timeBox = el("div");

    ui.moves = el("b", { text: "0" });
    ui.time = el("b", { text: "00:00" });

    const movesLabel = el("span", { text: "Moves: " });
    const timeLabel = el("span", { text: "Time: " });
    apply(movesLabel, { color: COLORS.muted, fontWeight: "700" });
    apply(timeLabel, { color: COLORS.muted, fontWeight: "700" });

    movesBox.append(movesLabel, ui.moves);
    timeBox.append(timeLabel, ui.time);
    stats.append(movesBox, timeBox);

    ui.msg = el("div", { text: "Choose a difficulty and start flipping cards." });
    apply(ui.msg, { textAlign: "center", color: COLORS.muted, fontSize: "13px", minHeight: "18px", margin: "6px 0 12px" });

    ui.grid = el("div", { id: "grid" });

    panel.append(title, controls, stats, ui.msg, ui.grid);


    app.replaceChildren(panel); 


    ui.grid.addEventListener("click", onGridClick); 
    ui.newBtn.addEventListener("click", newGame);
    ui.diff.addEventListener("change", newGame);

    newGame();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
