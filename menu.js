(() => {
  "use strict";

  const modeButtons = [...document.querySelectorAll(".modeBtn")];
  const difficultyButtons = [...document.querySelectorAll(".difficultyBtn")];
  const difficultyGroup = document.getElementById("difficultyGroup");
  const difficultyHint = document.getElementById("difficultyHint");
  const startBtn = document.getElementById("startBtn");

  const difficultyText = {
    easy: "Easy: AI sangat lambat dan sering salah prediksi.",
    medium: "Medium: AI seimbang, cocok untuk permainan santai.",
    hard: "Hard: AI cepat, prediksi bola akurat, dan lebih agresif.",
    insane: "Insane: AI sangat cepat, agresif, dan sulit dikalahkan."
  };

  let mode = "ai";
  let difficulty = "medium";

  function sanitizeMode(value) {
    return value === "two" ? "two" : "ai";
  }

  function sanitizeDifficulty(value) {
    return ["easy", "medium", "hard", "insane"].includes(value) ? value : "medium";
  }

  function saveConfig() {
    const payload = { mode, difficulty };
    localStorage.setItem("neon-air-hockey-config", JSON.stringify(payload));
  }

  function setMode(value) {
    mode = sanitizeMode(value);
    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    const showDifficulty = mode === "ai";
    difficultyGroup.style.display = showDifficulty ? "block" : "none";
    if (showDifficulty) {
      difficultyHint.textContent = difficultyText[difficulty];
    }
  }

  function setDifficulty(value) {
    difficulty = sanitizeDifficulty(value);
    difficultyButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.difficulty === difficulty);
    });
    difficultyHint.textContent = difficultyText[difficulty];
  }

  function loadInitialConfig() {
    const params = new URLSearchParams(window.location.search);
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("neon-air-hockey-config") || "null");
    } catch {
      saved = null;
    }

    const initialMode = sanitizeMode(params.get("mode") || (saved && saved.mode) || "ai");
    const initialDifficulty = sanitizeDifficulty(params.get("difficulty") || (saved && saved.difficulty) || "medium");

    setDifficulty(initialDifficulty);
    setMode(initialMode);
  }

  function goToGame() {
    saveConfig();
    const query = new URLSearchParams({ mode, difficulty }).toString();
    window.location.href = `game.html?${query}`;
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  difficultyButtons.forEach((btn) => {
    btn.addEventListener("click", () => setDifficulty(btn.dataset.difficulty));
  });

  startBtn.addEventListener("click", goToGame);

  loadInitialConfig();
})();
