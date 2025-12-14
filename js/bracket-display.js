// Bracket Display Module
// ======================
// Renders the visual playoff bracket for audience display

const BracketDisplay = {
  bracketState: null,
  alliances: {},
  teams: {},
  currentMatchId: null,
  unsubscribers: [],

  async init() {
    await DB.init();
    this.updateConnectionStatus();

    // Load data
    this.teams = await DB.getTeams() || {};
    this.alliances = await DB.getAlliances() || {};
    this.bracketState = await DB.getBracket();
    this.currentMatchId = await DB.getCurrentMatch();

    // Initial render
    this.render();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToTeams((teams) => {
        this.teams = teams || {};
        this.render();
      })
    );

    this.unsubscribers.push(
      DB.subscribeToAlliances((alliances) => {
        this.alliances = alliances || {};
        this.render();
      })
    );

    this.unsubscribers.push(
      DB.subscribeToBracket((bracket) => {
        this.bracketState = bracket;
        this.render();
      })
    );

    this.unsubscribers.push(
      DB.subscribeToCurrentMatch((matchId) => {
        this.currentMatchId = matchId;
        this.render();
      })
    );

    // Listen for connection changes
    window.addEventListener("db:connectionChange", () => this.updateConnectionStatus());
  },

  updateConnectionStatus() {
    const el = document.getElementById("connection-status");
    if (!el) return;

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

  render() {
    const container = document.getElementById("bracket-content");
    if (!container) return;

    if (!this.bracketState || !this.bracketState.matches) {
      container.innerHTML = `
        <div class="no-bracket">
          <h2>No Bracket Yet</h2>
          <p>The playoff bracket will appear here once it's generated in the admin panel.</p>
        </div>
      `;
      return;
    }

    const allianceCount = this.bracketState.allianceCount || Object.keys(this.alliances).length;

    // Render appropriate bracket layout
    switch (allianceCount) {
      case 2:
        container.innerHTML = this.render2AllianceBracket();
        break;
      case 4:
        container.innerHTML = this.render4AllianceBracket();
        break;
      case 6:
        container.innerHTML = this.render6AllianceBracket();
        break;
      case 8:
        container.innerHTML = this.render8AllianceBracket();
        break;
      default:
        container.innerHTML = `
          <div class="no-bracket">
            <h2>Unsupported Bracket Size</h2>
            <p>This bracket size (${allianceCount} alliances) is not currently supported.</p>
          </div>
        `;
    }

    // Render champion if complete
    if (this.bracketState.status === "complete" && this.bracketState.champion) {
      const championDiv = document.createElement("div");
      championDiv.innerHTML = this.renderChampion();
      container.appendChild(championDiv.firstElementChild);
    }
  },

  // Get match display data
  getMatchData(matchId) {
    const match = this.bracketState?.matches[matchId];
    if (!match) return null;

    const isCurrent = match.scoreMatchId === this.currentMatchId;

    return {
      id: matchId,
      red: match.red,
      blue: match.blue,
      winner: match.winner,
      played: match.played,
      isCurrent,
      redDisplay: this.getAllianceDisplay(match.red),
      blueDisplay: this.getAllianceDisplay(match.blue)
    };
  },

  getAllianceDisplay(allianceNum) {
    if (allianceNum == null) {
      return { name: "TBD", teams: "" };
    }

    const alliance = this.bracketState?.alliances[allianceNum] || this.alliances[allianceNum];
    if (!alliance) {
      return { name: `Alliance ${allianceNum}`, teams: "" };
    }

    const teamNumbers = alliance.teams?.map(id => this.teams[id]?.number || "?").join(" & ") || "";

    return {
      name: `Alliance ${allianceNum}`,
      teams: teamNumbers
    };
  },

  // Render a single match box
  renderMatchBox(matchId, isFinalsMatch = false) {
    const data = this.getMatchData(matchId);
    if (!data) return "";

    const boxClass = isFinalsMatch ? "match-box finals-box" : "match-box";
    const currentClass = data.isCurrent ? "current" : "";
    const completedClass = data.played ? "completed" : "";

    const redSlotClass = data.red == null ? "tbd" : (data.winner === "red" ? "winner" : "");
    const blueSlotClass = data.blue == null ? "tbd" : (data.winner === "blue" ? "winner" : "");

    return `
      <div class="${boxClass} ${currentClass} ${completedClass}">
        <div class="match-header">${matchId}</div>
        <div class="alliance-slot red ${redSlotClass}">
          <span class="alliance-name">${data.red != null ? data.redDisplay.name : "TBD"}</span>
          ${data.winner === "red" ? '<span class="winner-icon">&#9654;</span>' : ""}
        </div>
        <div class="alliance-slot blue ${blueSlotClass}">
          <span class="alliance-name">${data.blue != null ? data.blueDisplay.name : "TBD"}</span>
          ${data.winner === "blue" ? '<span class="winner-icon">&#9654;</span>' : ""}
        </div>
      </div>
    `;
  },

  renderChampion() {
    const champion = this.bracketState?.champion;
    if (!champion) return "";

    const alliance = this.bracketState?.alliances[champion] || this.alliances[champion];
    const teams = alliance?.teams?.map(id => {
      const team = this.teams[id];
      return team ? `${team.number} - ${team.name || ""}` : "";
    }).filter(Boolean).join("<br>") || "";

    return `
      <div class="champion-display">
        <div class="champion-trophy">&#127942;</div>
        <div class="champion-title">TOURNAMENT CHAMPION</div>
        <div class="champion-teams">
          <strong>Alliance ${champion}</strong><br>
          ${teams}
        </div>
      </div>
    `;
  },

  // Render combined finals box for double elimination
  renderFinalsBox(finalsMatchIds) {
    const matches = this.bracketState?.matches || {};
    const finalsMatches = finalsMatchIds.map(id => ({ id, ...matches[id] })).filter(m => m);

    if (finalsMatches.length === 0) return "";

    // Get the alliances from the first finals match (or TBD)
    const firstMatch = finalsMatches[0];
    const redAlliance = firstMatch.red;
    const blueAlliance = firstMatch.blue;
    const redDisplay = this.getAllianceDisplay(redAlliance);
    const blueDisplay = this.getAllianceDisplay(blueAlliance);

    // Count wins for each alliance
    let redWins = 0;
    let blueWins = 0;
    for (const match of finalsMatches) {
      if (match.played) {
        if (match.winner === "red") redWins++;
        else if (match.winner === "blue") blueWins++;
      }
    }

    // Check if any finals match is current
    const isAnyCurrent = finalsMatches.some(m => m.scoreMatchId === this.currentMatchId);
    const currentClass = isAnyCurrent ? "current" : "";

    // Determine series status
    let seriesStatus = "";
    const totalNeeded = finalsMatches.length === 3 ? 2 : 1; // Best of 3 vs single elimination style
    if (redWins > 0 || blueWins > 0) {
      if (finalsMatches.length === 3) {
        seriesStatus = `Best of 3: ${redWins} - ${blueWins}`;
      } else {
        // For standard double elim finals
        const matchesPlayed = finalsMatches.filter(m => m.played).length;
        const totalFinalsMatches = finalsMatches.length;
        seriesStatus = `Match ${matchesPlayed} of ${totalFinalsMatches}`;
      }
    }

    return `
      <div class="finals-box ${currentClass}">
        <div class="match-header">FINALS</div>
        <div class="alliance-slot red ${redWins > blueWins && this.bracketState?.champion ? 'winner' : ''}">
          <span class="alliance-name">${redAlliance != null ? redDisplay.name : "TBD"}</span>
          <span class="finals-wins">${redWins > 0 ? redWins : ""}</span>
        </div>
        <div class="alliance-slot blue ${blueWins > redWins && this.bracketState?.champion ? 'winner' : ''}">
          <span class="alliance-name">${blueAlliance != null ? blueDisplay.name : "TBD"}</span>
          <span class="finals-wins">${blueWins > 0 ? blueWins : ""}</span>
        </div>
        ${seriesStatus ? `<div class="finals-status">${seriesStatus}</div>` : ""}
      </div>
    `;
  },

  // 2-Alliance Bracket (Best of 3)
  render2AllianceBracket() {
    return `
      <div class="round-labels">
        <div class="round-label">Finals (Best of 3)</div>
      </div>
      <div class="bracket-wrapper">
        <div class="bracket-row" style="justify-content: center;">
          ${this.renderFinalsBox(["M1", "M2", "M3"])}
        </div>
      </div>
    `;
  },

  // 4-Alliance Bracket
  render4AllianceBracket() {
    return `
      <div class="round-labels">
        <div class="round-label">Round 1</div>
        <div class="round-label">Round 2</div>
        <div class="round-label">Round 3</div>
        <div class="round-label">Finals</div>
      </div>
      <div class="bracket-wrapper">
        <!-- Upper Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Upper Bracket</span>
          <div class="bracket-row">
            <div class="round-column">
              ${this.renderMatchBox("M1")}
              ${this.renderMatchBox("M2")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M4")}
            </div>
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderFinalsBox(["M6", "M7"])}
            </div>
          </div>
        </div>

        <div class="bracket-divider"></div>

        <!-- Lower Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Lower Bracket</span>
          <div class="bracket-row">
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderMatchBox("M3")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M5")}
            </div>
            <div class="round-column"></div>
          </div>
        </div>
      </div>
    `;
  },

  // 6-Alliance Bracket
  render6AllianceBracket() {
    return `
      <div class="round-labels">
        <div class="round-label">Round 1</div>
        <div class="round-label">Round 2</div>
        <div class="round-label">Round 3</div>
        <div class="round-label">Round 4</div>
        <div class="round-label">Finals</div>
      </div>
      <div class="bracket-wrapper">
        <!-- Upper Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Upper Bracket</span>
          <div class="bracket-row">
            <div class="round-column">
              ${this.renderMatchBox("M1")}
              ${this.renderMatchBox("M2")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M3")}
              ${this.renderMatchBox("M4")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M7")}
            </div>
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderFinalsBox(["M10", "M11"])}
            </div>
          </div>
        </div>

        <div class="bracket-divider"></div>

        <!-- Lower Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Lower Bracket</span>
          <div class="bracket-row">
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderMatchBox("M5")}
              ${this.renderMatchBox("M6")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M8")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M9")}
            </div>
            <div class="round-column"></div>
          </div>
        </div>
      </div>
    `;
  },

  // 8-Alliance Bracket
  render8AllianceBracket() {
    return `
      <div class="round-labels">
        <div class="round-label">Round 1</div>
        <div class="round-label">Round 2</div>
        <div class="round-label">Round 3</div>
        <div class="round-label">Round 4</div>
        <div class="round-label">Round 5</div>
        <div class="round-label">Finals</div>
      </div>
      <div class="bracket-wrapper">
        <!-- Upper Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Upper Bracket</span>
          <div class="bracket-row">
            <div class="round-column">
              ${this.renderMatchBox("M1")}
              ${this.renderMatchBox("M2")}
              ${this.renderMatchBox("M3")}
              ${this.renderMatchBox("M4")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M7")}
              ${this.renderMatchBox("M8")}
            </div>
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderMatchBox("M11")}
            </div>
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderFinalsBox(["M14", "M15"])}
            </div>
          </div>
        </div>

        <div class="bracket-divider"></div>

        <!-- Lower Bracket -->
        <div class="bracket-section">
          <span class="bracket-section-label">Lower Bracket</span>
          <div class="bracket-row">
            <div class="round-column"></div>
            <div class="round-column">
              ${this.renderMatchBox("M5")}
              ${this.renderMatchBox("M6")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M9")}
              ${this.renderMatchBox("M10")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M12")}
            </div>
            <div class="round-column">
              ${this.renderMatchBox("M13")}
            </div>
            <div class="round-column"></div>
          </div>
        </div>
      </div>
    `;
  },

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
  }
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => BracketDisplay.init());

// Cleanup on unload
window.addEventListener("beforeunload", () => BracketDisplay.destroy());
