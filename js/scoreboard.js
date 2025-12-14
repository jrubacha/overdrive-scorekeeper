// Scoreboard Display Logic
// ========================

const Scoreboard = {
  currentMatchId: null,
  teams: {},
  matches: {},
  unsubscribers: [],

  // DOM Elements
  elements: {},

  // Initialize
  async init() {
    this.cacheElements();
    this.bindEvents();

    await DB.init();
    this.updateConnectionStatus();

    // Load initial data
    await this.loadTeams();
    await this.loadMatches();

    // Subscribe to current match changes
    this.subscribeToCurrentMatch();

    // Listen for connection changes
    window.addEventListener("db:connectionChange", () => this.updateConnectionStatus());
  },

  // Cache DOM elements
  cacheElements() {
    this.elements = {
      connectionStatus: document.getElementById("connection-status"),
      matchSelect: document.getElementById("match-select"),
      matchIndicator: document.getElementById("match-indicator"),
      noMatchOverlay: document.getElementById("no-match-overlay"),
      scoreboardMain: document.getElementById("scoreboard-main"),
      fullscreenBtn: document.getElementById("fullscreen-btn"),
      // Red alliance
      redScore: document.getElementById("red-score"),
      redTeams: document.getElementById("red-teams"),
      redAuto: document.getElementById("red-auto"),
      redTeleop: document.getElementById("red-teleop"),
      redPenalty: document.getElementById("red-penalty"),
      // Blue alliance
      blueScore: document.getElementById("blue-score"),
      blueTeams: document.getElementById("blue-teams"),
      blueAuto: document.getElementById("blue-auto"),
      blueTeleop: document.getElementById("blue-teleop"),
      bluePenalty: document.getElementById("blue-penalty")
    };
  },

  // Bind events
  bindEvents() {
    this.elements.matchSelect.addEventListener("change", (e) => {
      this.selectMatch(e.target.value);
    });

    this.elements.fullscreenBtn.addEventListener("click", () => {
      this.toggleFullscreen();
    });

    // Handle keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "f" || e.key === "F") {
        this.toggleFullscreen();
      }
    });
  },

  // Update connection status
  updateConnectionStatus() {
    const el = this.elements.connectionStatus;
    const isOnline = navigator.onLine && FirebaseConfig.isConfigured();

    if (!FirebaseConfig.isConfigured()) {
      el.textContent = "Demo";
      el.className = "connection-status offline";
    } else if (isOnline) {
      el.textContent = "Live";
      el.className = "connection-status online";
    } else {
      el.textContent = "Offline";
      el.className = "connection-status offline";
    }
  },

  // Load teams
  async loadTeams() {
    this.teams = (await DB.getTeams()) || {};

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToTeams((teams) => {
        this.teams = teams || {};
        this.updateTeamDisplays();
      })
    );
  },

  // Load matches
  async loadMatches() {
    this.matches = (await DB.getMatches()) || {};
    this.populateMatchSelect();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToMatches((matches) => {
        this.matches = matches || {};
        this.populateMatchSelect();
      })
    );
  },

  // Populate match dropdown
  populateMatchSelect() {
    const select = this.elements.matchSelect;
    const currentValue = select.value;

    select.innerHTML = '<option value="">Select Match</option>';

    if (!this.matches || Object.keys(this.matches).length === 0) {
      return;
    }

    const sortedMatches = Object.entries(this.matches)
      .sort((a, b) => (a[1].number || 0) - (b[1].number || 0));

    for (const [id, match] of sortedMatches) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `Match ${match.number}`;
      select.appendChild(option);
    }

    // Restore selection
    if (currentValue && this.matches[currentValue]) {
      select.value = currentValue;
    }
  },

  // Subscribe to current match changes (from admin)
  subscribeToCurrentMatch() {
    this.unsubscribers.push(
      DB.subscribeToCurrentMatch((matchId) => {
        if (matchId && matchId !== this.currentMatchId) {
          this.selectMatch(matchId);
          this.elements.matchSelect.value = matchId;
        }
      })
    );
  },

  // Select a match to display
  selectMatch(matchId) {
    // Unsubscribe from previous match
    if (this.scoreUnsubscriber) {
      this.scoreUnsubscriber();
    }

    this.currentMatchId = matchId;

    if (!matchId) {
      this.showNoMatch();
      return;
    }

    const match = this.matches[matchId];
    if (!match) {
      this.showNoMatch();
      return;
    }

    // Update UI
    this.elements.matchIndicator.textContent = `Match ${match.number}`;
    this.elements.noMatchOverlay.classList.add("hidden");
    this.elements.scoreboardMain.style.visibility = "visible";

    // Update team displays
    this.updateTeamDisplays();

    // Subscribe to score updates
    this.scoreUnsubscriber = DB.subscribeToMatchScores(matchId, (scores) => {
      this.updateScores(scores);
    });

    // Reset scores initially
    this.updateScores({});
  },

  // Show no match overlay
  showNoMatch() {
    this.elements.matchIndicator.textContent = "No Match Selected";
    this.elements.noMatchOverlay.classList.remove("hidden");
    this.elements.scoreboardMain.style.visibility = "hidden";
  },

  // Update team displays
  updateTeamDisplays() {
    if (!this.currentMatchId) return;

    const match = this.matches[this.currentMatchId];
    if (!match) return;

    // Red teams
    const red1 = this.teams[match.red1];
    const red2 = this.teams[match.red2];
    this.elements.redTeams.innerHTML = `
      <span class="team-number">${red1?.number || match.red1 || "---"}</span>
      <span class="team-number">${red2?.number || match.red2 || "---"}</span>
    `;

    // Blue teams
    const blue1 = this.teams[match.blue1];
    const blue2 = this.teams[match.blue2];
    this.elements.blueTeams.innerHTML = `
      <span class="team-number">${blue1?.number || match.blue1 || "---"}</span>
      <span class="team-number">${blue2?.number || match.blue2 || "---"}</span>
    `;
  },

  // Update scores from database
  updateScores(scores) {
    // Calculate red alliance score
    const red1Actions = scores?.red1?.actions || {};
    const red2Actions = scores?.red2?.actions || {};
    const blue1Actions = scores?.blue1?.actions || {};
    const blue2Actions = scores?.blue2?.actions || {};

    // Red gets points from: red1 + red2 scoring + blue penalties
    const red1Score = ScoringRules.calculateRobotScore(red1Actions);
    const red2Score = ScoringRules.calculateRobotScore(red2Actions);
    const blue1Penalties = ScoringRules.calculatePenalties(blue1Actions);
    const blue2Penalties = ScoringRules.calculatePenalties(blue2Actions);
    const redTotal = red1Score + red2Score + blue1Penalties + blue2Penalties;

    // Blue gets points from: blue1 + blue2 scoring + red penalties
    const blue1Score = ScoringRules.calculateRobotScore(blue1Actions);
    const blue2Score = ScoringRules.calculateRobotScore(blue2Actions);
    const red1Penalties = ScoringRules.calculatePenalties(red1Actions);
    const red2Penalties = ScoringRules.calculatePenalties(red2Actions);
    const blueTotal = blue1Score + blue2Score + red1Penalties + red2Penalties;

    // Calculate breakdowns
    const redAuto = this.calculatePeriodScore(red1Actions, red2Actions, "autonomous");
    const redTeleop = this.calculatePeriodScore(red1Actions, red2Actions, "teleop");
    const blueAuto = this.calculatePeriodScore(blue1Actions, blue2Actions, "autonomous");
    const blueTeleop = this.calculatePeriodScore(blue1Actions, blue2Actions, "teleop");

    // Update displays with animation
    this.animateScoreUpdate(this.elements.redScore, redTotal);
    this.animateScoreUpdate(this.elements.blueScore, blueTotal);

    // Update breakdowns
    this.elements.redAuto.textContent = redAuto;
    this.elements.redTeleop.textContent = redTeleop;
    this.elements.redPenalty.textContent = blue1Penalties + blue2Penalties;

    this.elements.blueAuto.textContent = blueAuto;
    this.elements.blueTeleop.textContent = blueTeleop;
    this.elements.bluePenalty.textContent = red1Penalties + red2Penalties;
  },

  // Calculate score for a specific period
  calculatePeriodScore(actions1, actions2, period) {
    let score = 0;
    const rules = ScoringRules[period];

    for (const [key, rule] of Object.entries(rules)) {
      const count1 = actions1[rule.id] || 0;
      const count2 = actions2[rule.id] || 0;
      score += (count1 + count2) * rule.points;
    }

    return score;
  },

  // Animate score update
  animateScoreUpdate(element, newScore) {
    const currentScore = parseInt(element.textContent) || 0;

    if (newScore !== currentScore) {
      element.textContent = newScore;
      element.classList.add("updated");

      setTimeout(() => {
        element.classList.remove("updated");
      }, 300);
    }
  },

  // Toggle fullscreen
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen();
    }
  },

  // Cleanup
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    if (this.scoreUnsubscriber) {
      this.scoreUnsubscriber();
    }
  }
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => Scoreboard.init());

// Cleanup on unload
window.addEventListener("beforeunload", () => Scoreboard.destroy());
