// Admin Interface Logic
// =====================

const Admin = {
  teams: {},
  matches: {},
  currentMatchId: null,
  currentMatchScores: null,
  scoreUnsubscriber: null,
  unsubscribers: [],

  // Initialize
  async init() {
    this.bindNavigation();
    this.bindEvents();

    await DB.init();
    this.updateConnectionStatus();
    this.checkFirebaseConfig();

    // Load data
    await this.loadTeams();
    await this.loadMatches();
    this.loadCurrentMatch();

    // Listen for connection changes
    window.addEventListener("db:connectionChange", () => this.updateConnectionStatus());
  },

  // Bind navigation
  bindNavigation() {
    document.querySelectorAll(".admin-nav a").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.showSection(section);

        // Update URL hash
        window.location.hash = section;
      });
    });

    // Handle initial hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      this.showSection(hash);
    }
  },

  // Show a section
  showSection(sectionId) {
    // Update nav
    document.querySelectorAll(".admin-nav a").forEach(link => {
      link.classList.toggle("active", link.dataset.section === sectionId);
    });

    // Update sections
    document.querySelectorAll(".admin-section").forEach(section => {
      section.classList.toggle("active", section.id === `${sectionId}-section`);
    });
  },

  // Bind events
  bindEvents() {
    // Add team form
    document.getElementById("add-team-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.addTeam();
    });

    // Add match form
    document.getElementById("add-match-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.addMatch();
    });

    // Set current match
    document.getElementById("set-current-match-btn").addEventListener("click", () => {
      this.setCurrentMatch();
    });

    // Clear match scores
    document.getElementById("clear-match-scores-btn").addEventListener("click", () => {
      this.confirmClearMatchScores();
    });

    // Finalize match
    document.getElementById("finalize-match-btn").addEventListener("click", () => {
      this.confirmFinalizeMatch();
    });

    // Data management
    document.getElementById("export-data-btn").addEventListener("click", () => this.exportData());
    document.getElementById("import-data-input").addEventListener("change", (e) => this.importData(e));
    document.getElementById("clear-cache-btn").addEventListener("click", () => this.confirmClearCache());
    document.getElementById("reset-all-btn").addEventListener("click", () => this.confirmResetAll());
  },

  // Update connection status
  updateConnectionStatus() {
    const el = document.getElementById("connection-status");
    const isOnline = navigator.onLine && FirebaseConfig.isConfigured();

    if (!FirebaseConfig.isConfigured()) {
      el.textContent = "Demo Mode";
      el.className = "connection-status offline";
    } else if (isOnline) {
      el.textContent = "Online";
      el.className = "connection-status online";
    } else {
      el.textContent = "Offline";
      el.className = "connection-status offline";
    }
  },

  // Check Firebase configuration
  checkFirebaseConfig() {
    const statusEl = document.getElementById("firebase-config-status");

    if (FirebaseConfig.isConfigured()) {
      statusEl.innerHTML = `
        <span style="color: var(--accent-green);">✓ Firebase is configured</span><br>
        <small style="color: var(--text-secondary);">Project ID: ${FirebaseConfig.config.projectId}</small>
      `;
    } else {
      statusEl.innerHTML = `
        <span style="color: var(--accent-orange);">⚠ Firebase not configured</span><br>
        <small style="color: var(--text-secondary);">
          Edit <code>js/firebase-config.js</code> with your Firebase credentials.<br>
          Data will be stored locally only until configured.
        </small>
      `;
    }
  },

  // ================
  // TEAMS
  // ================

  async loadTeams() {
    this.teams = (await DB.getTeams()) || {};
    this.renderTeams();
    this.populateTeamSelects();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToTeams((teams) => {
        this.teams = teams || {};
        this.renderTeams();
        this.populateTeamSelects();
      })
    );
  },

  renderTeams() {
    const container = document.getElementById("team-list");
    const countEl = document.getElementById("team-count");
    const teamArray = Object.entries(this.teams);

    countEl.textContent = `${teamArray.length} team${teamArray.length !== 1 ? "s" : ""}`;

    if (teamArray.length === 0) {
      container.innerHTML = '<p class="text-secondary">No teams added yet</p>';
      return;
    }

    // Sort by team number
    teamArray.sort((a, b) => {
      const numA = parseInt(a[1].number) || 0;
      const numB = parseInt(b[1].number) || 0;
      return numA - numB;
    });

    container.innerHTML = teamArray.map(([id, team]) => `
      <div class="team-card" data-id="${id}">
        <div class="team-number">${team.number}</div>
        <div class="team-name">${team.name || "No name"}</div>
        <div class="team-actions">
          <button class="btn btn-secondary btn-icon" onclick="Admin.editTeam('${id}')" title="Edit">✎</button>
          <button class="btn btn-danger btn-icon" onclick="Admin.confirmDeleteTeam('${id}')" title="Delete">×</button>
        </div>
      </div>
    `).join("");
  },

  populateTeamSelects() {
    const selects = [
      document.getElementById("match-red1"),
      document.getElementById("match-red2"),
      document.getElementById("match-blue1"),
      document.getElementById("match-blue2")
    ];

    const teamOptions = Object.entries(this.teams)
      .sort((a, b) => (parseInt(a[1].number) || 0) - (parseInt(b[1].number) || 0))
      .map(([id, team]) => `<option value="${id}">${team.number} - ${team.name || "No name"}</option>`)
      .join("");

    selects.forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select team...</option>' + teamOptions;
      if (currentValue) select.value = currentValue;
    });
  },

  async addTeam() {
    const numberInput = document.getElementById("team-number");
    const nameInput = document.getElementById("team-name");

    const number = numberInput.value.trim();
    const name = nameInput.value.trim();

    if (!number) {
      this.showToast("Team number is required", "error");
      return;
    }

    // Generate ID from team number
    const teamId = `team_${number}`;

    // Check if team already exists
    if (this.teams[teamId]) {
      this.showToast("Team already exists", "error");
      return;
    }

    await DB.saveTeam(teamId, {
      number,
      name: name || `Team ${number}`,
      createdAt: Date.now()
    });

    // Clear form
    numberInput.value = "";
    nameInput.value = "";

    this.showToast(`Team ${number} added!`, "success");
  },

  editTeam(teamId) {
    const team = this.teams[teamId];
    if (!team) return;

    const newName = prompt("Enter new team name:", team.name);
    if (newName !== null) {
      DB.saveTeam(teamId, { ...team, name: newName });
      this.showToast("Team updated", "success");
    }
  },

  confirmDeleteTeam(teamId) {
    const team = this.teams[teamId];
    if (!team) return;

    showModal(
      "Delete Team?",
      `Are you sure you want to delete Team ${team.number}? This cannot be undone.`,
      () => this.deleteTeam(teamId)
    );
  },

  async deleteTeam(teamId) {
    await DB.deleteTeam(teamId);
    this.showToast("Team deleted", "warning");
    closeModal();
  },

  // ================
  // MATCHES
  // ================

  async loadMatches() {
    this.matches = (await DB.getMatches()) || {};
    this.renderMatches();
    this.populateCurrentMatchSelect();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToMatches((matches) => {
        this.matches = matches || {};
        this.renderMatches();
        this.populateCurrentMatchSelect();
      })
    );
  },

  renderMatches() {
    const container = document.getElementById("match-list");
    const countEl = document.getElementById("match-count");
    const matchArray = Object.entries(this.matches);

    countEl.textContent = `${matchArray.length} match${matchArray.length !== 1 ? "es" : ""}`;

    if (matchArray.length === 0) {
      container.innerHTML = '<p class="text-secondary">No matches created yet</p>';
      return;
    }

    // Sort by match number
    matchArray.sort((a, b) => (a[1].number || 0) - (b[1].number || 0));

    container.innerHTML = matchArray.map(([id, match]) => {
      const isCurrent = id === this.currentMatchId;
      const red1 = this.teams[match.red1]?.number || match.red1 || "?";
      const red2 = this.teams[match.red2]?.number || match.red2 || "?";
      const blue1 = this.teams[match.blue1]?.number || match.blue1 || "?";
      const blue2 = this.teams[match.blue2]?.number || match.blue2 || "?";

      return `
        <div class="match-card ${isCurrent ? "current" : ""}" data-id="${id}">
          <div class="match-header">
            <span class="match-number">Match ${match.number}</span>
            ${isCurrent ? '<span class="match-status current">Current</span>' : ""}
            <button class="btn btn-danger btn-icon" onclick="Admin.confirmDeleteMatch('${id}')" title="Delete">×</button>
          </div>
          <div class="match-alliances">
            <div class="alliance-box red">
              <div class="alliance-label text-red">Red Alliance</div>
              <div class="alliance-teams">${red1} & ${red2}</div>
            </div>
            <div class="alliance-box blue">
              <div class="alliance-label text-blue">Blue Alliance</div>
              <div class="alliance-teams">${blue1} & ${blue2}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  populateCurrentMatchSelect() {
    const select = document.getElementById("current-match-select");
    const currentValue = select.value;

    select.innerHTML = '<option value="">No match selected</option>';

    const sortedMatches = Object.entries(this.matches)
      .sort((a, b) => (a[1].number || 0) - (b[1].number || 0));

    for (const [id, match] of sortedMatches) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `Match ${match.number}`;
      if (id === this.currentMatchId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    if (currentValue && !this.currentMatchId) {
      select.value = currentValue;
    }
  },

  async addMatch() {
    const numberInput = document.getElementById("match-number");
    const red1Select = document.getElementById("match-red1");
    const red2Select = document.getElementById("match-red2");
    const blue1Select = document.getElementById("match-blue1");
    const blue2Select = document.getElementById("match-blue2");

    const number = parseInt(numberInput.value);
    const red1 = red1Select.value;
    const red2 = red2Select.value;
    const blue1 = blue1Select.value;
    const blue2 = blue2Select.value;

    if (!number || !red1 || !red2 || !blue1 || !blue2) {
      this.showToast("All fields are required", "error");
      return;
    }

    // Check for duplicate teams
    const teams = [red1, red2, blue1, blue2];
    if (new Set(teams).size !== 4) {
      this.showToast("Each team can only appear once per match", "error");
      return;
    }

    const matchId = `match_${number}`;

    // Check if match number exists
    for (const [id, match] of Object.entries(this.matches)) {
      if (match.number === number) {
        this.showToast("Match number already exists", "error");
        return;
      }
    }

    await DB.saveMatch(matchId, {
      number,
      red1,
      red2,
      blue1,
      blue2,
      createdAt: Date.now()
    });

    // Clear form
    numberInput.value = "";
    red1Select.value = "";
    red2Select.value = "";
    blue1Select.value = "";
    blue2Select.value = "";

    // Auto-increment match number
    numberInput.value = number + 1;

    this.showToast(`Match ${number} created!`, "success");
  },

  confirmDeleteMatch(matchId) {
    const match = this.matches[matchId];
    if (!match) return;

    showModal(
      "Delete Match?",
      `Are you sure you want to delete Match ${match.number}? This will also delete all scores for this match.`,
      () => this.deleteMatch(matchId)
    );
  },

  async deleteMatch(matchId) {
    await DB.deleteMatch(matchId);

    // Also delete scores for this match
    if (DB.db) {
      await DB.db.ref(`scores/${matchId}`).remove();
    }

    // If this was the current match, clear it
    if (matchId === this.currentMatchId) {
      await DB.setCurrentMatch(null);
      this.currentMatchId = null;
    }

    this.showToast("Match deleted", "warning");
    closeModal();
  },

  // ================
  // CURRENT MATCH
  // ================

  async loadCurrentMatch() {
    this.currentMatchId = await DB.getCurrentMatch();
    this.updateCurrentMatchDisplay();
    this.subscribeToCurrentMatchScores();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToCurrentMatch((matchId) => {
        this.currentMatchId = matchId;
        this.updateCurrentMatchDisplay();
        this.renderMatches();
        this.subscribeToCurrentMatchScores();
      })
    );
  },

  subscribeToCurrentMatchScores() {
    // Unsubscribe from previous match scores
    if (this.scoreUnsubscriber) {
      this.scoreUnsubscriber();
      this.scoreUnsubscriber = null;
    }

    if (!this.currentMatchId) {
      this.currentMatchScores = null;
      this.updateScorerStatus();
      return;
    }

    this.scoreUnsubscriber = DB.subscribeToMatchScores(this.currentMatchId, (scores) => {
      this.currentMatchScores = scores;
      this.updateScorerStatus();
    });
  },

  updateScorerStatus() {
    const container = document.getElementById("scorer-status");
    if (!container) return;

    if (!this.currentMatchId) {
      container.innerHTML = '<p class="text-secondary">Select a match to see scorer status</p>';
      return;
    }

    const positions = ["red1", "red2", "blue1", "blue2"];
    const positionLabels = {
      red1: "Red 1",
      red2: "Red 2",
      blue1: "Blue 1",
      blue2: "Blue 2"
    };

    const statusHtml = positions.map(pos => {
      const scoreData = this.currentMatchScores?.[pos];
      const hasData = scoreData?.actions && Object.values(scoreData.actions).some(v => v > 0);
      const isFinalized = scoreData?.finalized;

      let statusClass = "pending";
      let statusText = "No data";

      if (isFinalized) {
        statusClass = "finalized";
        statusText = "Finalized";
      } else if (hasData) {
        statusClass = "scoring";
        statusText = "Scoring...";
      }

      const alliance = pos.startsWith("red") ? "red" : "blue";

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 4px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--${alliance}-alliance);">
          <span style="font-weight: 600;">${positionLabels[pos]}</span>
          <span class="scorer-status-${statusClass}" style="font-size: 0.85rem; padding: 2px 8px; border-radius: 4px; background: ${isFinalized ? 'var(--accent-green)' : hasData ? 'var(--accent-yellow)' : 'var(--bg-card)'}; color: ${isFinalized ? 'white' : hasData ? '#000' : 'var(--text-secondary)'};">${statusText}</span>
        </div>
      `;
    }).join("");

    container.innerHTML = statusHtml;
  },

  updateCurrentMatchDisplay() {
    const infoEl = document.getElementById("current-match-info");
    const selectEl = document.getElementById("current-match-select");

    if (this.currentMatchId) {
      selectEl.value = this.currentMatchId;
    }

    if (!this.currentMatchId || !this.matches[this.currentMatchId]) {
      infoEl.innerHTML = '<p class="text-secondary">No match currently selected</p>';
      return;
    }

    const match = this.matches[this.currentMatchId];
    const red1 = this.teams[match.red1];
    const red2 = this.teams[match.red2];
    const blue1 = this.teams[match.blue1];
    const blue2 = this.teams[match.blue2];

    infoEl.innerHTML = `
      <div class="match-card current">
        <div class="match-header">
          <span class="match-number">Match ${match.number}</span>
          <span class="match-status current">Current</span>
        </div>
        <div class="match-alliances">
          <div class="alliance-box red">
            <div class="alliance-label text-red">Red Alliance</div>
            <div class="alliance-teams">
              ${red1?.number || "?"} (${red1?.name || "Unknown"})<br>
              ${red2?.number || "?"} (${red2?.name || "Unknown"})
            </div>
          </div>
          <div class="alliance-box blue">
            <div class="alliance-label text-blue">Blue Alliance</div>
            <div class="alliance-teams">
              ${blue1?.number || "?"} (${blue1?.name || "Unknown"})<br>
              ${blue2?.number || "?"} (${blue2?.name || "Unknown"})
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async setCurrentMatch() {
    const select = document.getElementById("current-match-select");
    const matchId = select.value;

    await DB.setCurrentMatch(matchId || null);
    this.currentMatchId = matchId || null;
    this.updateCurrentMatchDisplay();
    this.renderMatches();

    if (matchId) {
      const match = this.matches[matchId];
      this.showToast(`Match ${match?.number} is now current`, "success");
    } else {
      this.showToast("Current match cleared", "warning");
    }
  },

  confirmClearMatchScores() {
    if (!this.currentMatchId) {
      this.showToast("No match selected", "error");
      return;
    }

    const match = this.matches[this.currentMatchId];
    showModal(
      "Clear Match Scores?",
      `This will reset all scores for Match ${match?.number} to zero. This cannot be undone.`,
      () => this.clearMatchScores()
    );
  },

  async clearMatchScores() {
    if (!this.currentMatchId) return;

    if (DB.db) {
      await DB.db.ref(`scores/${this.currentMatchId}`).remove();
    }

    this.showToast("Match scores cleared", "warning");
    closeModal();
  },

  confirmFinalizeMatch() {
    if (!this.currentMatchId) {
      this.showToast("No match selected", "error");
      return;
    }

    const match = this.matches[this.currentMatchId];
    const positions = ["red1", "red2", "blue1", "blue2"];
    const positionLabels = {
      red1: "Red 1",
      red2: "Red 2",
      blue1: "Blue 1",
      blue2: "Blue 2"
    };

    // Check which positions haven't finalized
    const unfinalized = positions.filter(pos => {
      const scoreData = this.currentMatchScores?.[pos];
      return !scoreData?.finalized;
    });

    if (unfinalized.length === 0) {
      // All already finalized
      this.showToast("Match already finalized by all scorers", "success");
      return;
    }

    // Check if any have data but aren't finalized
    const unfinalizedWithData = unfinalized.filter(pos => {
      const scoreData = this.currentMatchScores?.[pos];
      return scoreData?.actions && Object.values(scoreData.actions).some(v => v > 0);
    });

    const unfinalizedNoData = unfinalized.filter(pos => {
      const scoreData = this.currentMatchScores?.[pos];
      return !scoreData?.actions || !Object.values(scoreData.actions).some(v => v > 0);
    });

    let message = `Finalizing Match ${match?.number}.\n\n`;

    if (unfinalizedWithData.length > 0) {
      message += `Scorers with data NOT finalized:\n${unfinalizedWithData.map(p => "  - " + positionLabels[p]).join("\n")}\n\n`;
    }

    if (unfinalizedNoData.length > 0) {
      message += `Scorers with NO data:\n${unfinalizedNoData.map(p => "  - " + positionLabels[p]).join("\n")}\n\n`;
    }

    message += "Are you sure you want to finalize this match?";

    showModal("Finalize Match?", message, () => this.finalizeMatch());
  },

  async finalizeMatch() {
    if (!this.currentMatchId) return;

    const positions = ["red1", "red2", "blue1", "blue2"];

    // Finalize all positions
    for (const pos of positions) {
      await DB.update(`scores/${this.currentMatchId}/${pos}`, {
        finalized: true,
        finalizedAt: Date.now(),
        finalizedBy: "admin"
      });
    }

    this.showToast("Match finalized", "success");
    closeModal();
  },

  // ================
  // DATA MANAGEMENT
  // ================

  async exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      teams: this.teams,
      matches: this.matches,
      currentMatch: this.currentMatchId
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `overdrive-data-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    this.showToast("Data exported", "success");
  },

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Import teams
      if (data.teams) {
        for (const [id, team] of Object.entries(data.teams)) {
          await DB.saveTeam(id, team);
        }
      }

      // Import matches
      if (data.matches) {
        for (const [id, match] of Object.entries(data.matches)) {
          await DB.saveMatch(id, match);
        }
      }

      this.showToast("Data imported successfully", "success");
    } catch (e) {
      console.error("Import error:", e);
      this.showToast("Failed to import data", "error");
    }

    // Clear the input
    event.target.value = "";
  },

  confirmClearCache() {
    showModal(
      "Clear Local Cache?",
      "This will remove locally stored data. Firebase data will not be affected.",
      () => {
        DB.clearLocalData();
        this.showToast("Cache cleared", "success");
        closeModal();
      }
    );
  },

  confirmResetAll() {
    showModal(
      "Reset Everything?",
      "This will DELETE ALL DATA including teams, matches, and scores. This cannot be undone!",
      () => this.resetAll()
    );
  },

  async resetAll() {
    try {
      // Clear Firebase data
      if (DB.db) {
        await DB.db.ref().remove();
      }

      // Clear local data
      DB.clearLocalData();
      localStorage.clear();

      this.teams = {};
      this.matches = {};
      this.currentMatchId = null;

      this.renderTeams();
      this.renderMatches();
      this.updateCurrentMatchDisplay();
      this.populateTeamSelects();
      this.populateCurrentMatchSelect();

      this.showToast("All data has been reset", "warning");
      closeModal();
    } catch (e) {
      console.error("Reset error:", e);
      this.showToast("Failed to reset data", "error");
    }
  },

  // Toast notification
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }
};

// Modal functions
function showModal(title, message, onConfirm) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  document.getElementById("confirm-modal").classList.add("active");
  document.getElementById("modal-confirm-btn").onclick = onConfirm;
}

function closeModal() {
  document.getElementById("confirm-modal").classList.remove("active");
}

// Initialize
document.addEventListener("DOMContentLoaded", () => Admin.init());
