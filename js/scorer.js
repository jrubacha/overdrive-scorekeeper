// Scorer Interface Logic
// ======================

const Scorer = {
  // State
  position: null,        // blue1, blue2, red1, red2
  matchId: null,
  teamId: null,
  actions: {},           // Current scoring actions
  isScoring: false,
  unsubscribers: [],     // For cleanup

  // DOM Elements
  elements: {},

  // Initialize the scorer
  async init() {
    this.cacheElements();
    this.bindEvents();
    this.renderScoringActions();

    await DB.init();
    this.updateConnectionStatus();
    this.loadMatches();
    this.loadSavedState();

    // Listen for connection changes
    window.addEventListener("db:connectionChange", () => this.updateConnectionStatus());
  },

  // Cache DOM elements for performance
  cacheElements() {
    this.elements = {
      positionBadge: document.getElementById("position-badge"),
      connectionStatus: document.getElementById("connection-status"),
      setupPanel: document.getElementById("setup-panel"),
      scoringPanel: document.getElementById("scoring-panel"),
      positionSelect: document.getElementById("position-select"),
      matchSelect: document.getElementById("match-select"),
      teamSelect: document.getElementById("team-select"),
      startBtn: document.getElementById("start-scoring-btn"),
      matchLabel: document.getElementById("match-label"),
      teamLabel: document.getElementById("team-label"),
      runningScore: document.getElementById("running-score"),
      clearBtn: document.getElementById("clear-btn"),
      finalizeBtn: document.getElementById("finalize-btn"),
      periodTabs: document.querySelectorAll(".period-tab"),
      periodContents: document.querySelectorAll(".period-content"),
      autonomousActions: document.getElementById("autonomous-actions"),
      teleopActions: document.getElementById("teleop-actions"),
      penaltyActions: document.getElementById("penalty-actions")
    };
  },

  // Bind event listeners
  bindEvents() {
    // Setup form events
    this.elements.positionSelect.addEventListener("change", () => this.onPositionChange());
    this.elements.matchSelect.addEventListener("change", () => this.onMatchChange());
    this.elements.startBtn.addEventListener("click", () => this.startScoring());

    // Scoring control events
    this.elements.clearBtn.addEventListener("click", () => this.confirmClear());
    this.elements.finalizeBtn.addEventListener("click", () => this.confirmFinalize());

    // Period tab switching
    this.elements.periodTabs.forEach(tab => {
      tab.addEventListener("click", () => this.switchPeriod(tab.dataset.period));
    });
  },

  // Update connection status indicator
  updateConnectionStatus() {
    const el = this.elements.connectionStatus;
    const isOnline = navigator.onLine && FirebaseConfig.isConfigured();

    if (!FirebaseConfig.isConfigured()) {
      el.textContent = "Demo";
      el.className = "connection-status offline";
    } else if (isOnline) {
      el.textContent = "Online";
      el.className = "connection-status online";
    } else {
      el.textContent = "Offline";
      el.className = "connection-status offline";
    }
  },

  // Load matches from database
  async loadMatches() {
    const matches = await DB.getMatches();
    const select = this.elements.matchSelect;

    select.innerHTML = '<option value="">Select match...</option>';

    if (!matches || Object.keys(matches).length === 0) {
      select.innerHTML += '<option value="" disabled>No matches created yet</option>';
      return;
    }

    // Sort matches by number
    const sortedMatches = Object.entries(matches)
      .sort((a, b) => (a[1].number || 0) - (b[1].number || 0));

    for (const [id, match] of sortedMatches) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `Match ${match.number}`;
      select.appendChild(option);
    }

    // Subscribe to match updates
    this.unsubscribers.push(
      DB.subscribeToMatches((matches) => this.loadMatches())
    );
  },

  // Load saved state from localStorage
  loadSavedState() {
    const saved = localStorage.getItem("overdrive_scorer_state");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.position) {
          this.elements.positionSelect.value = state.position;
          this.onPositionChange();
        }
        if (state.matchId) {
          this.elements.matchSelect.value = state.matchId;
          this.onMatchChange();
        }
      } catch (e) {
        console.warn("Failed to load saved state:", e);
      }
    }
  },

  // Save state to localStorage
  saveState() {
    const state = {
      position: this.position,
      matchId: this.matchId,
      teamId: this.teamId
    };
    localStorage.setItem("overdrive_scorer_state", JSON.stringify(state));
  },

  // Handle position selection change
  onPositionChange() {
    this.position = this.elements.positionSelect.value;

    // Update badge
    const badge = this.elements.positionBadge;
    if (this.position) {
      const alliance = this.position.startsWith("blue") ? "blue" : "red";
      badge.className = `scorer-position ${alliance}`;
      badge.textContent = this.position.toUpperCase().replace(/(\d)/, " $1");
    } else {
      badge.className = "scorer-position";
      badge.textContent = "Not Set";
    }

    this.updateTeamSelect();
    this.checkCanStart();
    this.saveState();
  },

  // Handle match selection change
  async onMatchChange() {
    this.matchId = this.elements.matchSelect.value;
    this.updateTeamSelect();
    this.checkCanStart();
    this.saveState();
  },

  // Update team select based on position and match
  async updateTeamSelect() {
    const teamSelect = this.elements.teamSelect;
    teamSelect.innerHTML = '<option value="">Select position and match first</option>';
    teamSelect.disabled = true;

    if (!this.position || !this.matchId) return;

    const matches = await DB.getMatches();
    const match = matches?.[this.matchId];

    if (!match) return;

    // Get the team for this position
    const teamId = match[this.position];

    if (!teamId) {
      teamSelect.innerHTML = '<option value="">No team assigned to this position</option>';
      return;
    }

    // Get team details
    const teams = await DB.getTeams();
    const team = teams?.[teamId];

    if (team) {
      teamSelect.innerHTML = `<option value="${teamId}">${team.number} - ${team.name}</option>`;
      this.teamId = teamId;
    } else {
      teamSelect.innerHTML = `<option value="${teamId}">Team ${teamId}</option>`;
      this.teamId = teamId;
    }

    teamSelect.disabled = false;
  },

  // Check if we can start scoring
  checkCanStart() {
    const canStart = this.position && this.matchId && this.teamId;
    this.elements.startBtn.disabled = !canStart;
  },

  // Start scoring session
  async startScoring() {
    if (!this.position || !this.matchId || !this.teamId) return;

    // Initialize empty actions
    this.actions = ScoringRules.getEmptyActions();

    // Load existing scores if any
    const existingScores = await DB.getMatchScores(this.matchId);
    if (existingScores?.[this.position]?.actions) {
      this.actions = { ...this.actions, ...existingScores[this.position].actions };
    }

    // Update UI
    this.elements.setupPanel.style.display = "none";
    this.elements.scoringPanel.classList.add("active");

    const matches = await DB.getMatches();
    const match = matches?.[this.matchId];
    this.elements.matchLabel.textContent = `Match ${match?.number || "??"}`;

    const teams = await DB.getTeams();
    const team = teams?.[this.teamId];
    this.elements.teamLabel.textContent = team ? `Team ${team.number}` : `Team ${this.teamId}`;

    this.isScoring = true;
    this.updateAllCounters();
    this.updateRunningScore();

    this.showToast("Scoring started! Good luck!", "success");
  },

  // Render scoring action UI elements
  renderScoringActions() {
    // Group autonomous actions by category
    const autoRobot = [];
    const autoBall = [];

    for (const [key, rule] of Object.entries(ScoringRules.autonomous)) {
      if (rule.category === "Robot") {
        autoRobot.push(rule);
      } else {
        autoBall.push(rule);
      }
    }

    this.elements.autonomousActions.innerHTML = `
      <div class="category-header">Robot Actions</div>
      ${autoRobot.map(r => this.renderActionRow(r)).join("")}
      <div class="category-header">Trackball Actions</div>
      ${autoBall.map(r => this.renderActionRow(r)).join("")}
    `;

    // Group teleop actions by category
    const teleRobot = [];
    const teleBall = [];

    for (const [key, rule] of Object.entries(ScoringRules.teleop)) {
      if (rule.category === "Robot") {
        teleRobot.push(rule);
      } else {
        teleBall.push(rule);
      }
    }

    this.elements.teleopActions.innerHTML = `
      <div class="category-header">Robot Actions</div>
      ${teleRobot.map(r => this.renderActionRow(r)).join("")}
      <div class="category-header">Trackball Actions</div>
      ${teleBall.map(r => this.renderActionRow(r)).join("")}
    `;

    // Penalties
    const penalties = Object.values(ScoringRules.penalties);
    this.elements.penaltyActions.innerHTML = penalties.map(r => this.renderActionRow(r)).join("");

    // Bind counter/checkbox events
    this.bindActionEvents();
  },

  // Render a single action row
  renderActionRow(rule) {
    if (rule.type === "checkbox") {
      return `
        <div class="scoring-action" data-id="${rule.id}">
          <div class="scoring-action-info">
            <div class="scoring-action-name">${rule.name}</div>
            <div class="scoring-action-points">${rule.points} points</div>
          </div>
          <label class="checkbox-toggle">
            <input type="checkbox" data-action="${rule.id}">
            <span class="toggle"></span>
          </label>
        </div>
      `;
    } else {
      return `
        <div class="scoring-action" data-id="${rule.id}">
          <div class="scoring-action-info">
            <div class="scoring-action-name">${rule.name}</div>
            <div class="scoring-action-points">${rule.points} points each</div>
          </div>
          <div class="counter">
            <button class="btn counter-btn minus" data-action="${rule.id}" data-delta="-1">−</button>
            <span class="counter-value" data-counter="${rule.id}">0</span>
            <button class="btn counter-btn plus" data-action="${rule.id}" data-delta="1">+</button>
          </div>
        </div>
      `;
    }
  },

  // Bind events to action buttons
  bindActionEvents() {
    // Counter buttons
    document.querySelectorAll(".counter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const actionId = btn.dataset.action;
        const delta = parseInt(btn.dataset.delta);
        this.updateAction(actionId, delta);
      });
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"][data-action]').forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        const actionId = checkbox.dataset.action;
        this.setAction(actionId, checkbox.checked ? 1 : 0);
      });
    });
  },

  // Update an action by delta
  updateAction(actionId, delta) {
    if (!this.isScoring) return;

    const current = this.actions[actionId] || 0;
    const newValue = Math.max(0, current + delta);
    this.actions[actionId] = newValue;

    this.updateCounter(actionId);
    this.updateRunningScore();
    this.syncScores();
  },

  // Set an action to a specific value
  setAction(actionId, value) {
    if (!this.isScoring) return;

    this.actions[actionId] = value;
    this.updateRunningScore();
    this.syncScores();
  },

  // Update a single counter display
  updateCounter(actionId) {
    const counter = document.querySelector(`[data-counter="${actionId}"]`);
    if (counter) {
      counter.textContent = this.actions[actionId] || 0;

      // Flash animation
      counter.classList.remove("flash");
      void counter.offsetWidth; // Trigger reflow
      counter.classList.add("flash");
    }
  },

  // Update all counter displays
  updateAllCounters() {
    // Update counters
    document.querySelectorAll("[data-counter]").forEach(el => {
      const actionId = el.dataset.counter;
      el.textContent = this.actions[actionId] || 0;
    });

    // Update checkboxes
    document.querySelectorAll('input[type="checkbox"][data-action]').forEach(el => {
      const actionId = el.dataset.action;
      el.checked = (this.actions[actionId] || 0) > 0;
    });
  },

  // Update running score display
  updateRunningScore() {
    const score = ScoringRules.calculateRobotScore(this.actions);
    this.elements.runningScore.textContent = score;

    // Flash animation
    this.elements.runningScore.classList.remove("flash");
    void this.elements.runningScore.offsetWidth;
    this.elements.runningScore.classList.add("flash");
  },

  // Sync scores to database
  syncScores() {
    if (!this.matchId || !this.position) return;

    DB.saveRobotScore(this.matchId, this.position, this.actions);
  },

  // Switch period tab
  switchPeriod(period) {
    this.elements.periodTabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.period === period);
    });

    this.elements.periodContents.forEach(content => {
      content.classList.toggle("active", content.id === `${period}-panel`);
    });
  },

  // Confirm clear action
  confirmClear() {
    showModal(
      "Clear All Scores?",
      "This will reset all scoring actions to zero. This cannot be undone.",
      () => this.clearScores()
    );
  },

  // Clear all scores
  clearScores() {
    this.actions = ScoringRules.getEmptyActions();
    this.updateAllCounters();
    this.updateRunningScore();
    this.syncScores();
    this.showToast("Scores cleared", "warning");
    closeModal();
  },

  // Confirm finalize
  confirmFinalize() {
    const score = ScoringRules.calculateRobotScore(this.actions);
    const penalties = ScoringRules.calculatePenalties(this.actions);

    let message = `Final score: ${score} points`;
    if (penalties > 0) {
      message += `\n${penalties} penalty points to opponent`;
    }
    message += "\n\nAre you sure you want to finalize?";

    showModal("Finalize Score?", message, () => this.finalizeScore());
  },

  // Finalize the score
  async finalizeScore() {
    // Mark as finalized in database
    await DB.update(`scores/${this.matchId}/${this.position}`, {
      finalized: true,
      finalizedAt: Date.now()
    });

    this.showToast("Score finalized!", "success");
    closeModal();

    // Return to setup
    setTimeout(() => {
      this.isScoring = false;
      this.elements.scoringPanel.classList.remove("active");
      this.elements.setupPanel.style.display = "block";
    }, 1500);
  },

  // Show toast notification
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
};

// Modal functions
function showModal(title, message, onConfirm) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  document.getElementById("confirm-modal").classList.add("active");

  const confirmBtn = document.getElementById("modal-confirm-btn");
  confirmBtn.onclick = onConfirm;
}

function closeModal() {
  document.getElementById("confirm-modal").classList.remove("active");
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => Scorer.init());

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(reg => console.log("Service Worker registered"))
    .catch(err => console.log("Service Worker registration failed:", err));
}
