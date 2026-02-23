const STORAGE_KEY = "dice-bank-game-v2";

const setupCard = document.getElementById("setupCard");
const gameCard = document.getElementById("gameCard");
const setupForm = document.getElementById("setupForm");
const playerNameInput = document.getElementById("playerNameInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const setupPlayerList = document.getElementById("setupPlayerList");
const roundCountInput = document.getElementById("roundCount");
const roundOptions = document.getElementById("roundOptions");
const themeBtn = document.getElementById("themeBtn");

const roundLabel = document.getElementById("roundLabel");
const bankTotalLabel = document.getElementById("bankTotalLabel");
const turnBanner = document.getElementById("turnBanner");
const topBankCard = document.querySelector(".top-card-bank");
const bankLockup = document.querySelector(".bank-lockup");
const bankLockupScale = document.querySelector(".bank-lockup-scale");
const bankLockupUnit = document.querySelector(".bank-lockup-unit");
const bankPig = document.querySelector(".bank-art-piggy");

const rollPad = document.getElementById("rollPad");
let doubleBtn;

const bankButtons = document.getElementById("bankButtons");
const scoreList = document.getElementById("scoreList");
const eventLog = document.getElementById("eventLog");
const eventLogWrap = document.getElementById("eventLogWrap");
const toggleLogBtn = document.getElementById("toggleLogBtn");

const undoBtn = document.getElementById("undoBtn");
const newGameBtn = document.getElementById("newGameBtn");

let state = loadState();
let undoStack = [];
let displayedBankTotal = state.inProgress ? state.bankTotal : 0;
let bankTotalTarget = displayedBankTotal;
let bankTotalAnimFrame = 0;
let pendingBankFx = "";
let isLogVisible = false;
let didPlayWinConfetti = false;
let setupPlayers = [];
const THEME_STORAGE_KEY = "dice-bank-theme-v1";
const THEMES = [
  { id: "peach-note", className: "theme-peach-note", label: "Peach Note", themeColor: "#fff7fb", icon: "fa-heart" },
  { id: "mint-memo", className: "theme-mint-memo", label: "Mint Memo", themeColor: "#f4fffb", icon: "fa-seedling" },
  {
    id: "lavender-tab",
    className: "theme-lavender-tab",
    label: "Lavender Tab",
    themeColor: "#faf6ff",
    icon: "fa-star"
  },
  { id: "butter-desk", className: "theme-butter-desk", label: "Butter Desk", themeColor: "#fffdf2", icon: "fa-sun" },
  {
    id: "midnight-sticker",
    className: "theme-midnight-sticker",
    label: "Midnight Sticker",
    themeColor: "#1f1a2a",
    icon: "fa-moon"
  }
];
bootstrapRollPad();
renderSetupPlayers();
setBankTotalImmediate(displayedBankTotal);
applyTheme(loadThemeId());
render();

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const names = [...setupPlayers];
  if (names.length < 2) {
    alert("Enter at least 2 player names.");
    return;
  }

  state = createInitialGame(names, Number(roundCountInput.value));
  undoStack = [];
  saveState(state);
  render();
});

roundOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".round-option");
  if (!button) {
    return;
  }
  const value = Number(button.dataset.round);
  if (![10, 15, 20].includes(value)) {
    return;
  }
  roundCountInput.value = String(value);
  roundOptions.querySelectorAll(".round-option").forEach((option) => {
    const isActive = option === button;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
});

addPlayerBtn.addEventListener("click", () => {
  addSetupPlayer(playerNameInput.value);
});

playerNameInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  addSetupPlayer(playerNameInput.value);
});

turnBanner.addEventListener("click", () => {
  startNextRoundFromBanner();
});

toggleLogBtn.addEventListener("click", () => {
  isLogVisible = !isLogVisible;
  render();
});

themeBtn.addEventListener("click", () => {
  const currentIndex = THEMES.findIndex((theme) => document.body.classList.contains(theme.className));
  const next = THEMES[(currentIndex + 1) % THEMES.length];
  applyTheme(next.id);
});

undoBtn.addEventListener("click", () => {
  if (undoStack.length === 0) {
    return;
  }

  state = undoStack.pop();
  saveState(state);
  render();
});

newGameBtn.addEventListener("click", () => {
  undoStack = [];
  state = createEmptyState();
  saveState(state);
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  });
}

window.addEventListener("resize", () => {
  updateBankTotalFit();
});

function bootstrapRollPad() {
  for (let total = 2; total <= 12; total += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(total);
    button.addEventListener("click", () => {
      if (!state.inProgress || state.roundEnded || state.gameEnded) {
        return;
      }
      pushUndoSnapshot();
      applyRoll(total);
      saveState(state);
      render();
    });
    rollPad.appendChild(button);
  }

  doubleBtn = document.createElement("button");
  doubleBtn.type = "button";
  doubleBtn.id = "doubleBtn";
  doubleBtn.textContent = "DOUBLES!";
  doubleBtn.addEventListener("click", () => {
    if (!state.inProgress || state.roundEnded || state.gameEnded) {
      return;
    }
    if (state.rollCountInRound < 3) {
      return;
    }
    pushUndoSnapshot();
    applyDoubleRoll();
    saveState(state);
    render();
  });
  rollPad.appendChild(doubleBtn);
}

function createEmptyState() {
  return {
    inProgress: false,
    gameEnded: false,
    totalRounds: 20,
    round: 1,
    bankTotal: 0,
    rollCountInRound: 0,
    currentPlayerIndex: 0,
    roundEnded: false,
    players: [],
    eventHistory: []
  };
}

function createInitialGame(names, totalRounds) {
  const players = names.map((name, index) => ({
    id: index + 1,
    name,
    score: 0,
    bankedThisRound: false,
    bankedAmountThisRound: 0
  }));

  return {
    inProgress: true,
    gameEnded: false,
    totalRounds,
    round: 1,
    bankTotal: 0,
    rollCountInRound: 0,
    currentPlayerIndex: 0,
    roundEnded: false,
    players,
    eventHistory: ["Round 1 started."]
  };
}

function resetRoundState() {
  state.bankTotal = 0;
  state.rollCountInRound = 0;
  state.currentPlayerIndex = 0;
  state.roundEnded = false;
  state.players.forEach((player) => {
    player.bankedThisRound = false;
    player.bankedAmountThisRound = 0;
  });
}

function addSetupPlayer(rawName) {
  const name = rawName.trim();
  if (!name) {
    playerNameInput.focus();
    return;
  }
  const exists = setupPlayers.some((playerName) => playerName.toLowerCase() === name.toLowerCase());
  if (exists) {
    playerNameInput.value = "";
    playerNameInput.focus();
    return;
  }
  setupPlayers.push(name);
  playerNameInput.value = "";
  renderSetupPlayers();
  playerNameInput.focus();
}

function removeSetupPlayer(name) {
  setupPlayers = setupPlayers.filter((playerName) => playerName !== name);
  renderSetupPlayers();
}

function renderSetupPlayers() {
  setupPlayerList.innerHTML = "";
  setupPlayers.forEach((name) => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "setup-player-name";
    nameSpan.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "setup-player-remove";
    removeBtn.setAttribute("aria-label", `Remove ${name}`);
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    removeBtn.addEventListener("click", () => {
      removeSetupPlayer(name);
    });

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    setupPlayerList.appendChild(li);
  });
}

function applyRoll(sum) {
  const roller = state.players[state.currentPlayerIndex];
  if (!roller || roller.bankedThisRound) {
    moveToNextEligiblePlayer();
    return;
  }

  const isSpecialWindow = state.rollCountInRound < 3;

  state.rollCountInRound += 1;

  if (sum === 7 && isSpecialWindow) {
    state.bankTotal += 70;
    pendingBankFx = "jump";
    addEvent(`${roller.name} rolled 7 in first three rolls: +70.`);
    moveToNextEligiblePlayer();
    return;
  }

  if (sum === 7) {
    addEvent(`${roller.name} rolled 7. Round ${state.round} ended.`);
    endRound();
    return;
  }

  state.bankTotal += sum;
  addEvent(`${roller.name} rolled ${sum}: +${sum}.`);

  moveToNextEligiblePlayer();
}

function applyDoubleRoll() {
  const roller = state.players[state.currentPlayerIndex];
  if (!roller || roller.bankedThisRound) {
    moveToNextEligiblePlayer();
    return;
  }

  state.rollCountInRound += 1;
  state.bankTotal *= 2;
  pendingBankFx = "burst";
  addEvent(`${roller.name} rolled DOUBLES! Bank total doubled.`);
  moveToNextEligiblePlayer();
}

function bankForPlayer(playerId) {
  if (!state.inProgress || state.roundEnded || state.gameEnded) {
    return;
  }
  if (state.rollCountInRound < 3) {
    return;
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.bankedThisRound) {
    return;
  }

  pushUndoSnapshot();
  player.bankedAmountThisRound = state.bankTotal;
  player.score += state.bankTotal;
  player.bankedThisRound = true;
  addEvent(`${player.name} BANKED ${state.bankTotal}.`);

  if (state.players.every((p) => p.bankedThisRound)) {
    addEvent("All players banked. Round ended.");
    endRound();
    return;
  }

  if (state.players[state.currentPlayerIndex] && state.players[state.currentPlayerIndex].bankedThisRound) {
    moveToNextEligiblePlayer();
  }
}

function endRound() {
  state.roundEnded = true;
  if (state.round >= state.totalRounds) {
    state.gameEnded = true;
  }
}

function moveToNextEligiblePlayer() {
  if (state.players.every((player) => player.bankedThisRound)) {
    endRound();
    return;
  }

  let steps = 0;
  let idx = state.currentPlayerIndex;

  while (steps < state.players.length) {
    idx = (idx + 1) % state.players.length;
    if (!state.players[idx].bankedThisRound) {
      state.currentPlayerIndex = idx;
      return;
    }
    steps += 1;
  }
}

function addEvent(message) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  state.eventHistory.unshift(`${timestamp} ${message}`);
  state.eventHistory = state.eventHistory.slice(0, 60);
}

function render() {
  setupCard.classList.toggle("hidden", state.inProgress);
  gameCard.classList.toggle("hidden", !state.inProgress);

  if (!state.inProgress) {
    roundLabel.textContent = "--/--";
    setBankTotalImmediate(0);
    turnBanner.textContent = "-";
    pendingBankFx = "";
    didPlayWinConfetti = false;
    return;
  }

  const current = state.players[state.currentPlayerIndex];

  roundLabel.textContent = `${state.round}/${state.totalRounds}`;
  animateBankTotalTo(state.bankTotal);
  if (pendingBankFx) {
    playBankTotalFx(pendingBankFx);
    pendingBankFx = "";
  }
  if (state.roundEnded) {
    if (state.round >= state.totalRounds) {
      const winner = getTopPlayer();
      turnBanner.textContent = winner ? `${winner.name} Wins!` : "GAME COMPLETE";
      turnBanner.classList.remove("actionable");
      if (!didPlayWinConfetti) {
        playWinConfetti();
        didPlayWinConfetti = true;
      }
    } else {
      turnBanner.textContent = `BEGIN ROUND ${state.round + 1}`;
      turnBanner.classList.add("actionable");
    }
  } else {
    if (!current) {
      turnBanner.textContent = "-";
    } else if (state.rollCountInRound < 3) {
      turnBanner.textContent = `Build that bank, ${current.name}!`;
    } else {
      turnBanner.textContent = `${toPossessive(current.name)} turn!`;
    }
    turnBanner.classList.remove("actionable");
  }
  if (!state.gameEnded) {
    didPlayWinConfetti = false;
  }

  const inputsLocked = state.roundEnded || state.gameEnded;
  rollPad.querySelectorAll("button").forEach((button) => {
    const isDoubleButton = button === doubleBtn;
    button.disabled = inputsLocked || (isDoubleButton && state.rollCountInRound < 3);
  });
  undoBtn.disabled = undoStack.length === 0;
  toggleLogBtn.textContent = isLogVisible ? "Hide Log" : "Show Log";
  eventLogWrap.classList.toggle("hidden", !isLogVisible);

  renderBankButtons();
  renderScores();
  renderEvents();
}

function pushUndoSnapshot() {
  undoStack.push(JSON.parse(JSON.stringify(state)));
  if (undoStack.length > 80) {
    undoStack = undoStack.slice(undoStack.length - 80);
  }
}

function renderBankButtons() {
  bankButtons.innerHTML = "";
  const bankLocked = state.rollCountInRound < 3;
  state.players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<i class="fa-solid fa-piggy-bank" aria-hidden="true"></i> ${player.name}`;
    button.setAttribute(
      "aria-label",
      player.bankedThisRound ? `${player.name} already banked this round` : `Bank for ${player.name}`
    );
    button.disabled = player.bankedThisRound || state.roundEnded || state.gameEnded || bankLocked;
    button.addEventListener("click", () => {
      bankForPlayer(player.id);
      saveState(state);
      render();
    });
    bankButtons.appendChild(button);
  });
}

function renderScores() {
  scoreList.innerHTML = "";
  const ordered = [...state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  ordered.forEach((player) => {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.className = "score-name";
    const status = player.bankedThisRound && !state.roundEnded ? ` (banked ${player.bankedAmountThisRound ?? 0})` : "";
    nameSpan.textContent = `${player.name}${status}`;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "score-points";
    scoreSpan.textContent = String(player.score);

    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);

    scoreList.appendChild(li);
  });
}

function getTopPlayer() {
  if (!Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }
  return [...state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0] ?? null;
}

function playWinConfetti() {
  const existingLayer = document.getElementById("confettiLayer");
  if (existingLayer) {
    existingLayer.remove();
  }

  const layer = document.createElement("div");
  layer.id = "confettiLayer";
  layer.className = "confetti-layer";
  const colors = ["#ff89b4", "#ffcb77", "#7ecfbb", "#8ac7ff", "#ffd0e4", "#bfa7ff"];

  for (let i = 0; i < 64; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--drift", `${(Math.random() * 24 - 12).toFixed(2)}vw`);
    piece.style.setProperty("--rot", `${Math.round(Math.random() * 880 - 440)}deg`);
    piece.style.setProperty("--dur", `${(2.5 + Math.random() * 1.9).toFixed(2)}s`);
    piece.style.setProperty("--delay", `${(Math.random() * 0.36).toFixed(2)}s`);
    piece.style.background = colors[i % colors.length];
    piece.style.opacity = `${(0.72 + Math.random() * 0.28).toFixed(2)}`;
    if (Math.random() > 0.5) {
      piece.style.borderRadius = "999px";
      piece.style.width = `${(7 + Math.random() * 6).toFixed(0)}px`;
      piece.style.height = piece.style.width;
    }
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => {
    layer.remove();
  }, 5000);
}

function renderEvents() {
  eventLog.innerHTML = "";
  if (state.eventHistory.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No events yet.";
    eventLog.appendChild(li);
    return;
  }

  state.eventHistory.slice(0, 12).forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    eventLog.appendChild(li);
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createEmptyState();
    }

    return {
      ...createEmptyState(),
      ...parsed,
      players: Array.isArray(parsed.players)
        ? parsed.players.map((player) => ({
            ...player,
            bankedAmountThisRound:
              typeof player.bankedAmountThisRound === "number" ? player.bankedAmountThisRound : 0
          }))
        : [],
      eventHistory: Array.isArray(parsed.eventHistory) ? parsed.eventHistory : []
    };
  } catch {
    return createEmptyState();
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function setBankTotalImmediate(total) {
  if (bankTotalAnimFrame) {
    cancelAnimationFrame(bankTotalAnimFrame);
    bankTotalAnimFrame = 0;
  }
  displayedBankTotal = total;
  bankTotalTarget = total;
  bankTotalLabel.innerHTML = formatBankTotal(total);
  updateBankTotalSize(total);
}

function animateBankTotalTo(total) {
  if (total === bankTotalTarget) {
    return;
  }

  if (bankTotalAnimFrame) {
    cancelAnimationFrame(bankTotalAnimFrame);
    bankTotalAnimFrame = 0;
  }

  const start = displayedBankTotal;
  const delta = total - start;
  if (delta === 0) {
    setBankTotalImmediate(total);
    return;
  }

  bankTotalTarget = total;
  const durationMs = Math.min(700, Math.max(220, Math.abs(delta) * 8));
  const startedAt = performance.now();

  const step = (now) => {
    const elapsed = now - startedAt;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = 1 - (1 - progress) ** 3;
    displayedBankTotal = start + delta * eased;
    bankTotalLabel.innerHTML = formatBankTotal(displayedBankTotal);
    updateBankTotalSize(displayedBankTotal);

    if (progress < 1) {
      bankTotalAnimFrame = requestAnimationFrame(step);
      return;
    }

    displayedBankTotal = total;
    bankTotalLabel.innerHTML = formatBankTotal(total);
    updateBankTotalSize(total);
    bankTotalAnimFrame = 0;
  };

  bankTotalAnimFrame = requestAnimationFrame(step);
}

function formatBankTotal(total) {
  const value = `$${Math.round(total).toLocaleString()}`;
  const chars = value
    .split("")
    .map((char, index) => {
      const currencyClass = index === 0 ? " currency" : "";
      return `<span class="bank-total-char${currencyClass}" style="--char-index:${index}">${char}</span>`;
    })
    .join("");
  return `<span class="bank-total-sway">${chars}</span>`;
}

function updateBankTotalSize(total) {
  bankTotalLabel.classList.remove("size-1", "size-2", "size-3", "size-4");
  const digits = Math.abs(Math.round(total)).toString().length;
  if (digits >= 4) {
    bankTotalLabel.classList.add("size-4");
  } else if (digits >= 3) {
    bankTotalLabel.classList.add("size-3");
  } else if (digits >= 2) {
    bankTotalLabel.classList.add("size-2");
  } else {
    bankTotalLabel.classList.add("size-1");
  }
  updatePigScale(total);
  updateBankTotalFit();
  requestAnimationFrame(updateBankTotalFit);
}

function updatePigScale(total) {
  if (!bankPig) {
    return;
  }

  const value = Math.abs(Math.round(total));
  let scale;

  if (value < 10) {
    scale = 1;
  } else if (value < 100) {
    scale = lerp(1, 0.92, (value - 10) / 90);
  } else if (value < 1000) {
    scale = lerp(0.92, 0.78, (value - 100) / 900);
  } else if (value < 10000) {
    scale = lerp(0.78, 0.66, (value - 1000) / 9000);
  } else {
    scale = 0.62;
  }

  bankPig.style.setProperty("--pig-scale", String(scale));
}

function lerp(start, end, t) {
  return start + (end - start) * Math.min(1, Math.max(0, t));
}

function updateBankTotalFit() {
  if (!topBankCard || !bankLockup || !bankLockupScale || !bankLockupUnit) {
    return;
  }

  bankLockupScale.style.setProperty("--lockup-scale", "1");
  const previousAnimation = bankLockupUnit.style.animation;
  bankLockupUnit.style.animation = "none";

  const hostWidth = bankLockup.clientWidth;
  const hostHeight = bankLockup.clientHeight;
  if (hostWidth <= 0 || hostHeight <= 0) {
    bankLockupUnit.style.animation = previousAnimation;
    return;
  }

  const safety = 0.96;
  const lockupWidth = Math.max(1, bankLockupUnit.scrollWidth);
  const lockupHeight = Math.max(1, bankLockupUnit.scrollHeight);
  const widthScale = (hostWidth * safety) / lockupWidth;
  const heightScale = (hostHeight * safety) / lockupHeight;
  const scale = Math.min(1, Math.max(0.08, Math.min(widthScale, heightScale)));
  bankLockupScale.style.setProperty("--lockup-scale", String(scale));
  bankLockupUnit.style.animation = previousAnimation;
}

function playBankTotalFx(kind) {
  bankTotalLabel.classList.remove("fx-jump", "fx-burst");
  void bankTotalLabel.offsetWidth;
  bankTotalLabel.classList.add(kind === "burst" ? "fx-burst" : "fx-jump");
}

function toPossessive(name) {
  return name.endsWith("s") || name.endsWith("S") ? `${name}'` : `${name}'s`;
}

function startNextRoundFromBanner() {
  if (!state.inProgress || state.gameEnded || !state.roundEnded) {
    return;
  }
  if (state.round >= state.totalRounds) {
    return;
  }

  pushUndoSnapshot();
  state.round += 1;
  resetRoundState();
  addEvent(`Round ${state.round} started.`);
  saveState(state);
  render();
}

function applyTheme(themeId) {
  const selected = THEMES.find((theme) => theme.id === themeId) || THEMES[0];
  THEMES.forEach((theme) => document.body.classList.remove(theme.className));
  document.body.classList.add(selected.className);
  document.documentElement.style.background = selected.themeColor;
  themeBtn.innerHTML = `<i class="fa-solid ${selected.icon}" aria-hidden="true"></i>`;
  themeBtn.setAttribute("aria-label", `Theme: ${selected.label}`);
  themeBtn.setAttribute("title", `Theme: ${selected.label}`);
  localStorage.setItem(THEME_STORAGE_KEY, selected.id);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", selected.themeColor);
  }
}

function loadThemeId() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.some((theme) => theme.id === saved) ? saved : THEMES[0].id;
}
