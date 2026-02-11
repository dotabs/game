(() => {
  const SESSION_KEY = 'mg_game';
  const TOTAL_KEY = 'mg_totalMoves';

  const difficulties = {
    easy: { label: 'Easy (4x4)', rows: 4, cols: 4 },
    medium: { label: 'Medium (4x6)', rows: 4, cols: 6 },
    hard: { label: 'Hard (6x6)', rows: 6, cols: 6 },
  };

  const themes = {
    classic: {
      label: 'Classic',
      vars: {
        '--bg': '#f1f5f9',
        '--panel': '#ffffff',
        '--text': '#0f172a',
        '--muted': '#64748b',
        '--card-back': '#1e88e5',
        '--card-front': '#ffffff',
        '--card-front-text': '#0f172a',
        '--card-matched': '#22c55e',
        '--card-matched-text': '#ffffff',
        '--accent': '#0f172a',
      },
    },
    ocean: {
      label: 'Ocean',
      vars: {
        '--bg': '#e0f2fe',
        '--panel': '#ffffff',
        '--text': '#0f172a',
        '--muted': '#0369a1',
        '--card-back': '#0284c7',
        '--card-front': '#f0f9ff',
        '--card-front-text': '#0b2a3a',
        '--card-matched': '#06b6d4',
        '--card-matched-text': '#062a33',
        '--accent': '#075985',
      },
    },
  };

  const symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

  const $ = (id) => document.getElementById(id);

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (s) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const buildDeck = (count) => {
    const pairs = Math.floor(count / 2);
    const pick = symbols.slice(0, pairs);
    return shuffle(pick.flatMap((s) => [s, s]));
  };

  const getTotalMoves = () => parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10);
  const addTotalMove = () => {
    localStorage.setItem(TOTAL_KEY, String(getTotalMoves() + 1));
  };

  const applyTheme = (key) => {
    const t = themes[key] || themes.classic;
    Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  };

  const loadGame = () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || !Array.isArray(g.deck) || !Array.isArray(g.matched)) return null;
      if (g.deck.length !== g.matched.length) return null;
      if (typeof g.rows !== 'number' || typeof g.cols !== 'number') return null;
      if (g.rows * g.cols !== g.deck.length) return null;
      g.moves = Number.isFinite(g.moves) ? g.moves : 0;
      g.seconds = Number.isFinite(g.seconds) ? g.seconds : 0;
      g.timerStarted = !!g.timerStarted;
      g.gameOver = !!g.gameOver;
      g.difficultyKey = typeof g.difficultyKey === 'string' ? g.difficultyKey : 'easy';
      g.styleKey = typeof g.styleKey === 'string' ? g.styleKey : 'classic';
      return g;
    } catch {
      return null;
    }
  };

  const saveGame = (g) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(g));
  };

  const createDefaultGame = (difficultyKey, styleKey) => {
    const d = difficulties[difficultyKey] || difficulties.easy;
    const count = d.rows * d.cols;
    return {
      difficultyKey,
      styleKey,
      rows: d.rows,
      cols: d.cols,
      deck: buildDeck(count),
      matched: Array(count).fill(false),
      moves: 0,
      seconds: 0,
      timerStarted: false,
      gameOver: false,
    };
  };

  const ui = {
    board: null,
    moves: null,
    time: null,
    msg: null,
    total: null,
    diff: null,
    style: null,
    btnNew: null,
  };

  const play = {
    first: null,
    second: null,
    lock: false,
    timerId: null,
  };

  let game = null;

  const setCardClass = (btn, mode) => {
    btn.classList.remove('down', 'up', 'matched');
    btn.classList.add(mode);
  };

  const reveal = (i) => {
    const btn = ui.board.querySelector(`[data-i="${i}"]`);
    if (!btn) return;
    btn.textContent = game.deck[i];
    setCardClass(btn, 'up');
  };

  const hide = (i) => {
    const btn = ui.board.querySelector(`[data-i="${i}"]`);
    if (!btn) return;
    btn.textContent = game.deck[i];
    setCardClass(btn, 'down');
  };

  const markMatched = (i) => {
    const btn = ui.board.querySelector(`[data-i="${i}"]`);
    if (!btn) return;
    btn.textContent = game.deck[i];
    btn.disabled = true;
    setCardClass(btn, 'matched');
  };

  const syncStats = () => {
    ui.moves.textContent = String(game.moves);
    ui.time.textContent = fmtTime(game.seconds);
    ui.total.textContent = String(getTotalMoves());
  };

  const stopTimer = () => {
    if (play.timerId) clearInterval(play.timerId);
    play.timerId = null;
  };

  const startTimer = () => {
    if (game.timerStarted || game.gameOver) return;
    game.timerStarted = true;
    saveGame(game);
    stopTimer();
    play.timerId = setInterval(() => {
      game.seconds += 1;
      ui.time.textContent = fmtTime(game.seconds);
      saveGame(game);
    }, 1000);
  };

  const checkWin = () => {
    if (game.matched.every(Boolean)) {
      game.gameOver = true;
      saveGame(game);
      stopTimer();
      ui.msg.textContent = 'You matched them all!';
      ui.board.querySelectorAll('button.card').forEach((b) => (b.disabled = true));
    }
  };

  const finishTurn = (match) => {
    const a = play.first;
    const b = play.second;
    if (a == null || b == null) return;

    if (match) {
      game.matched[a] = true;
      game.matched[b] = true;
      markMatched(a);
      markMatched(b);
      saveGame(game);
      ui.msg.textContent = 'Nice match.';
      checkWin();
    } else {
      hide(a);
      hide(b);
      ui.msg.textContent = '';
    }

    play.first = null;
    play.second = null;
    play.lock = false;
  };

  const onCardClick = (i) => {
    if (play.lock || game.gameOver) return;
    if (game.matched[i]) return;
    if (play.first === i) return;

    startTimer();

    reveal(i);

    if (play.first == null) {
      play.first = i;
      return;
    }

    play.second = i;
    play.lock = true;

    game.moves += 1;
    saveGame(game);
    syncStats();

    addTotalMove();
    ui.total.textContent = String(getTotalMoves());

    const match = game.deck[play.first] === game.deck[play.second];

    setTimeout(() => finishTurn(match), match ? 200 : 650);
  };

  const buildBoard = () => {
    ui.board.innerHTML = '';
    ui.board.style.gridTemplateColumns = `repeat(${game.cols}, 60px)`;

    for (let i = 0; i < game.deck.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.dataset.i = String(i);
      btn.textContent = game.deck[i];
      btn.addEventListener('click', () => onCardClick(i));
      ui.board.appendChild(btn);

      if (game.matched[i]) {
        btn.disabled = true;
        setCardClass(btn, 'matched');
      } else {
        setCardClass(btn, 'down');
      }
    }

    play.first = null;
    play.second = null;
    play.lock = false;
  };

  const startNewGame = () => {
    stopTimer();
    const diffKey = ui.diff.value;
    const styleKey = ui.style.value;
    game = createDefaultGame(diffKey, styleKey);
    applyTheme(styleKey);
    ui.msg.textContent = '';
    saveGame(game);
    syncStats();
    buildBoard();
  };

  const restore = () => {
    const saved = loadGame();
    const diffKey = saved?.difficultyKey || 'easy';
    const styleKey = saved?.styleKey || 'classic';

    ui.diff.value = difficulties[diffKey] ? diffKey : 'easy';
    ui.style.value = themes[styleKey] ? styleKey : 'classic';

    game = saved || createDefaultGame(ui.diff.value, ui.style.value);

    applyTheme(game.styleKey);

    saveGame(game);
    syncStats();
    buildBoard();

    if (game.timerStarted && !game.gameOver) {
      stopTimer();
      play.timerId = setInterval(() => {
        game.seconds += 1;
        ui.time.textContent = fmtTime(game.seconds);
        saveGame(game);
      }, 1000);
    }

    if (game.gameOver) ui.msg.textContent = 'You matched them all!';
  };

  const wire = () => {
    ui.board = $('board');
    ui.moves = $('moves');
    ui.time = $('time');
    ui.msg = $('msg');
    ui.total = $('totalMoves');
    ui.diff = $('difficulty');
    ui.style = $('style');
    ui.btnNew = $('newGame');

    Object.entries(difficulties).forEach(([k, d]) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = d.label;
      ui.diff.appendChild(opt);
    });

    Object.entries(themes).forEach(([k, t]) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = t.label;
      ui.style.appendChild(opt);
    });

    ui.btnNew.addEventListener('click', startNewGame);

    ui.diff.addEventListener('change', () => {
      startNewGame();
    });

    ui.style.addEventListener('change', () => {
      const key = ui.style.value;
      applyTheme(key);
      if (game) {
        game.styleKey = key;
        saveGame(game);
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === TOTAL_KEY) ui.total.textContent = String(getTotalMoves());
    });

    restore();
    ui.total.textContent = String(getTotalMoves());

    window.addEventListener('beforeunload', () => {
      if (game) saveGame(game);
    });
  };

  document.addEventListener('DOMContentLoaded', wire);
})();
