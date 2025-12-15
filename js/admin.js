// Admin Interface Logic
// =====================

const Admin = {
  teams: {},
  matches: {},
  currentMatchId: null,
  currentMatchScores: null,
  scoreUnsubscriber: null,
  unsubscribers: [],
  matchSettings: { format: "2v2", maxMatches: 45 },

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
    await this.loadMatchSettings();

    // Initialize playoffs
    await this.initPlayoffs();

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

    // Match generation
    document.getElementById("format-1v1")?.addEventListener("click", () => this.setMatchFormat("1v1"));
    document.getElementById("format-2v2")?.addEventListener("click", () => this.setMatchFormat("2v2"));
    document.getElementById("max-matches-input")?.addEventListener("change", (e) => {
      this.matchSettings.maxMatches = Math.max(1, Math.min(200, parseInt(e.target.value) || 45));
      e.target.value = this.matchSettings.maxMatches;
      this.updateMatchGenEstimate();
      DB.saveMatchSettings(this.matchSettings);
    });
    document.getElementById("generate-matches-btn")?.addEventListener("click", () => this.confirmGenerateMatches());
    document.getElementById("clear-qual-matches-btn")?.addEventListener("click", () => this.confirmClearQualMatches());

    // Printable schedule
    document.getElementById("print-schedule-btn")?.addEventListener("click", () => this.printMatchSchedule());
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
    this.updateMatchGenUI();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToTeams((teams) => {
        this.teams = teams || {};
        this.renderTeams();
        this.populateTeamSelects();
        this.updateMatchGenUI();
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

  // ================
  // MATCH GENERATION
  // ================

  async loadMatchSettings() {
    this.matchSettings = await DB.getMatchSettings();
    this.updateMatchGenUI();
  },

  setMatchFormat(format) {
    if (format === this.matchSettings.format) return;

    this.matchSettings.format = format;
    DB.saveMatchSettings(this.matchSettings);
    this.updateMatchGenUI();
  },

  updateMatchGenUI() {
    // Update format toggle
    document.getElementById("format-1v1")?.classList.toggle("selected", this.matchSettings.format === "1v1");
    document.getElementById("format-2v2")?.classList.toggle("selected", this.matchSettings.format === "2v2");

    // Update max matches input
    const maxInput = document.getElementById("max-matches-input");
    if (maxInput) maxInput.value = this.matchSettings.maxMatches;

    // Update team count
    const teamCount = Object.keys(this.teams).length;
    const teamCountEl = document.getElementById("match-gen-team-count");
    if (teamCountEl) teamCountEl.textContent = teamCount;

    // Update match estimate
    this.updateMatchGenEstimate();
  },

  updateMatchGenEstimate() {
    const teamCount = Object.keys(this.teams).length;
    const estimateEl = document.getElementById("match-gen-estimate");
    if (!estimateEl) return;

    let totalPossible = 0;
    if (this.matchSettings.format === "1v1") {
      // For 1v1: n*(n-1)/2 unique matchups
      totalPossible = (teamCount * (teamCount - 1)) / 2;
    } else {
      // For 2v2: more complex - estimate based on combinations
      // Each match needs 4 unique teams, and we want variety
      if (teamCount >= 4) {
        // Rough estimate: combinations of 4 teams from n teams, divided by some factor
        totalPossible = Math.floor((teamCount * (teamCount - 1) * (teamCount - 2) * (teamCount - 3)) / 24);
        // Cap at a reasonable round-robin estimate
        totalPossible = Math.min(totalPossible, teamCount * 5);
      }
    }

    const matchCount = Math.min(totalPossible, this.matchSettings.maxMatches);
    estimateEl.textContent = teamCount < (this.matchSettings.format === "1v1" ? 2 : 4)
      ? "Need more teams"
      : matchCount;
  },

  confirmGenerateMatches() {
    const teamCount = Object.keys(this.teams).length;
    const minTeams = this.matchSettings.format === "1v1" ? 2 : 4;

    if (teamCount < minTeams) {
      this.showToast(`Need at least ${minTeams} teams for ${this.matchSettings.format} matches`, "error");
      return;
    }

    // Check if qualification matches already exist
    const qualMatches = Object.values(this.matches).filter(m => m.type !== "playoff");
    if (qualMatches.length > 0) {
      showModal(
        "Replace Existing Matches?",
        `There are ${qualMatches.length} qualification matches. Generating new matches will delete them. Continue?`,
        () => this.generateMatches()
      );
    } else {
      this.generateMatches();
    }
  },

  async generateMatches() {
    closeModal();

    const teamIds = Object.keys(this.teams);
    const format = this.matchSettings.format;
    const maxMatches = this.matchSettings.maxMatches;

    this.showToast("Generating matches...", "info");

    // Delete existing qualification matches
    await DB.deleteAllQualificationMatches();

    let matchList = [];

    if (format === "1v1") {
      matchList = this.generate1v1Matches(teamIds, maxMatches);
    } else {
      matchList = this.generate2v2Matches(teamIds, maxMatches);
    }

    // Save matches to database
    for (let i = 0; i < matchList.length; i++) {
      const match = matchList[i];
      const matchId = `match_${Date.now()}_${i}`;
      await DB.saveMatch(matchId, {
        number: i + 1,
        red1: match.red1,
        red2: match.red2 || match.red1, // For 1v1, duplicate the team
        blue1: match.blue1,
        blue2: match.blue2 || match.blue1, // For 1v1, duplicate the team
        type: "qualification",
        createdAt: Date.now()
      });
    }

    this.showToast(`Generated ${matchList.length} matches!`, "success");
  },

  generate1v1Matches(teamIds, maxMatches) {
    // Generate all unique 1v1 pairings
    const allPairings = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        allPairings.push([teamIds[i], teamIds[j]]);
      }
    }

    // Shuffle for randomness
    this.shuffleArray(allPairings);

    // Limit to maxMatches
    const selectedPairings = allPairings.slice(0, maxMatches);

    // Balance red/blue positions
    const positionCount = {}; // teamId -> { red: count, blue: count }
    teamIds.forEach(id => positionCount[id] = { red: 0, blue: 0 });

    const matches = [];
    for (const [teamA, teamB] of selectedPairings) {
      // Decide which team is red based on position balance
      const aNetRed = positionCount[teamA].red - positionCount[teamA].blue;
      const bNetRed = positionCount[teamB].red - positionCount[teamB].blue;

      let red1, blue1;
      if (aNetRed <= bNetRed) {
        red1 = teamA;
        blue1 = teamB;
      } else {
        red1 = teamB;
        blue1 = teamA;
      }

      positionCount[red1].red++;
      positionCount[blue1].blue++;

      matches.push({ red1, blue1 });
    }

    return matches;
  },

  generate2v2Matches(teamIds, maxMatches) {
    const n = teamIds.length;
    if (n < 4) return [];

    // Track statistics for balancing
    const stats = {};
    teamIds.forEach(id => {
      stats[id] = {
        played: 0,
        partners: new Set(),
        opponents: new Set(),
        red: 0,
        blue: 0
      };
    });

    const matches = [];
    const usedCombinations = new Set();

    // Generate matches using a greedy algorithm that prioritizes:
    // 1. Teams playing with new partners
    // 2. Teams playing against new opponents
    // 3. Balancing total games played
    // 4. Balancing red/blue positions

    const maxIterations = maxMatches * 100; // Prevent infinite loops
    let iterations = 0;

    while (matches.length < maxMatches && iterations < maxIterations) {
      iterations++;

      // Find teams with fewest games played
      const teamsByGames = [...teamIds].sort((a, b) => stats[a].played - stats[b].played);

      // Try to build a match with the least-played teams
      const match = this.tryBuildMatch(teamsByGames, stats, usedCombinations);

      if (match) {
        matches.push(match);

        // Update stats
        const { red1, red2, blue1, blue2 } = match;
        const redTeam = [red1, red2];
        const blueTeam = [blue1, blue2];
        const allTeams = [...redTeam, ...blueTeam];

        allTeams.forEach(t => stats[t].played++);

        // Partners
        stats[red1].partners.add(red2);
        stats[red2].partners.add(red1);
        stats[blue1].partners.add(blue2);
        stats[blue2].partners.add(blue1);

        // Opponents
        redTeam.forEach(r => blueTeam.forEach(b => {
          stats[r].opponents.add(b);
          stats[b].opponents.add(r);
        }));

        // Position tracking
        stats[red1].red++;
        stats[red2].red++;
        stats[blue1].blue++;
        stats[blue2].blue++;

        // Mark combination as used
        const key = this.getMatchKey(red1, red2, blue1, blue2);
        usedCombinations.add(key);
      }
    }

    return matches;
  },

  tryBuildMatch(teamsByGames, stats, usedCombinations) {
    // Try multiple times to find a valid match
    for (let attempt = 0; attempt < 50; attempt++) {
      // Select 4 teams, preferring those with fewer games
      const candidates = [];
      const available = [...teamsByGames];

      while (candidates.length < 4 && available.length > 0) {
        // Weight selection towards less-played teams
        const weights = available.map(t => 1 / (stats[t].played + 1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalWeight;

        for (let i = 0; i < available.length; i++) {
          r -= weights[i];
          if (r <= 0) {
            candidates.push(available.splice(i, 1)[0]);
            break;
          }
        }
      }

      if (candidates.length < 4) continue;

      // Try all ways to divide 4 teams into 2 alliances
      const divisions = [
        [[0, 1], [2, 3]],
        [[0, 2], [1, 3]],
        [[0, 3], [1, 2]]
      ];

      // Shuffle divisions for variety
      this.shuffleArray(divisions);

      for (const [[r1, r2], [b1, b2]] of divisions) {
        const redTeam = [candidates[r1], candidates[r2]];
        const blueTeam = [candidates[b1], candidates[b2]];

        // Check if this combination was used
        const key = this.getMatchKey(redTeam[0], redTeam[1], blueTeam[0], blueTeam[1]);
        if (usedCombinations.has(key)) continue;

        // Score this division based on novelty
        let score = 0;

        // Prefer new partnerships
        if (!stats[redTeam[0]].partners.has(redTeam[1])) score += 10;
        if (!stats[blueTeam[0]].partners.has(blueTeam[1])) score += 10;

        // Prefer new opponents
        redTeam.forEach(r => blueTeam.forEach(b => {
          if (!stats[r].opponents.has(b)) score += 5;
        }));

        // Balance red/blue
        const redDiff = redTeam.reduce((sum, t) => sum + stats[t].red - stats[t].blue, 0);
        const blueDiff = blueTeam.reduce((sum, t) => sum + stats[t].blue - stats[t].red, 0);

        // Swap if it would improve balance
        let finalRed = redTeam;
        let finalBlue = blueTeam;
        if (redDiff > blueDiff) {
          finalRed = blueTeam;
          finalBlue = redTeam;
        }

        return {
          red1: finalRed[0],
          red2: finalRed[1],
          blue1: finalBlue[0],
          blue2: finalBlue[1]
        };
      }
    }

    return null;
  },

  getMatchKey(r1, r2, b1, b2) {
    // Create a unique key for a match combination
    const redKey = [r1, r2].sort().join("-");
    const blueKey = [b1, b2].sort().join("-");
    return [redKey, blueKey].sort().join("_vs_");
  },

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  confirmClearQualMatches() {
    const qualMatches = Object.values(this.matches).filter(m => m.type !== "playoff");
    if (qualMatches.length === 0) {
      this.showToast("No qualification matches to clear", "info");
      return;
    }

    showModal(
      "Clear Qualification Matches?",
      `This will delete ${qualMatches.length} qualification matches and their scores. Playoff matches will not be affected.`,
      () => this.clearQualMatches()
    );
  },

  async clearQualMatches() {
    await DB.deleteAllQualificationMatches();
    this.showToast("Qualification matches cleared", "warning");
    closeModal();
  },

  // Print match schedule
  printMatchSchedule() {
    const startTimeInput = document.getElementById("schedule-start-time");
    const cycleTimeInput = document.getElementById("schedule-cycle-time");

    const startTimeStr = startTimeInput?.value || "09:00";
    const cycleMinutes = parseInt(cycleTimeInput?.value) || 8;

    // Parse start time
    const [startHour, startMin] = startTimeStr.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(startHour, startMin, 0, 0);

    // Get and sort qualification matches
    const qualMatches = Object.entries(this.matches)
      .filter(([id, m]) => m.type !== "playoff")
      .sort((a, b) => {
        const numA = typeof a[1].number === "number" ? a[1].number : parseInt(a[1].number) || 0;
        const numB = typeof b[1].number === "number" ? b[1].number : parseInt(b[1].number) || 0;
        return numA - numB;
      });

    if (qualMatches.length === 0) {
      this.showToast("No matches to print", "error");
      return;
    }

    const is1v1 = this.matchSettings.format === "1v1";

    // Build schedule rows
    const rows = qualMatches.map(([id, match], index) => {
      // Calculate time for this match
      const matchTime = new Date(startDate.getTime() + index * cycleMinutes * 60000);
      const timeStr = matchTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });

      // Get team names
      const red1 = this.teams[match.red1];
      const red2 = this.teams[match.red2];
      const blue1 = this.teams[match.blue1];
      const blue2 = this.teams[match.blue2];

      let redTeams, blueTeams;
      if (is1v1) {
        redTeams = red1 ? `${red1.number} - ${red1.name || ""}` : "TBD";
        blueTeams = blue1 ? `${blue1.number} - ${blue1.name || ""}` : "TBD";
      } else {
        const redNames = [red1, red2].filter(Boolean).map(t => `${t.number}`).join(" & ");
        const blueNames = [blue1, blue2].filter(Boolean).map(t => `${t.number}`).join(" & ");
        redTeams = redNames || "TBD";
        blueTeams = blueNames || "TBD";
      }

      return `
        <tr>
          <td>${match.number}</td>
          <td>${timeStr}</td>
          <td>${redTeams}</td>
          <td>${blueTeams}</td>
        </tr>
      `;
    }).join("");

    // Calculate end time
    const endDate = new Date(startDate.getTime() + qualMatches.length * cycleMinutes * 60000);
    const endTimeStr = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    // Build print-friendly HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Match Schedule</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      padding: 0.5in;
      color: #000;
    }
    h1 {
      font-size: 16pt;
      margin-bottom: 4px;
      text-align: center;
    }
    .subtitle {
      font-size: 10pt;
      color: #666;
      text-align: center;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #333;
      padding: 4px 8px;
      text-align: left;
    }
    th {
      background: #eee;
      font-weight: bold;
    }
    .match-num { width: 60px; text-align: center; }
    .match-time { width: 80px; text-align: center; }
    .red-col { background: #fee; }
    .blue-col { background: #eef; }
    tr:nth-child(even) td { background: #f9f9f9; }
    tr:nth-child(even) td.red-col { background: #fdd; }
    tr:nth-child(even) td.blue-col { background: #ddf; }
    .footer {
      margin-top: 12px;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    @media print {
      body { padding: 0.25in; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Match Schedule</h1>
  <div class="subtitle">
    ${qualMatches.length} matches | ${is1v1 ? "1v1" : "2v2"} format | ${cycleMinutes} min cycle | ${startTimeStr} - ${endTimeStr}
  </div>
  <table>
    <thead>
      <tr>
        <th class="match-num">Match</th>
        <th class="match-time">Time</th>
        <th class="red-col">Red Alliance</th>
        <th class="blue-col">Blue Alliance</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">
    Generated ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
  </div>
  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">Print Schedule</button>
  </div>
</body>
</html>
    `;

    // Open in new window
    const printWindow = window.open("", "_blank");
    printWindow.document.write(html);
    printWindow.document.close();
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
  },

  // ================
  // PLAYOFFS
  // ================

  playoffSettings: null,
  alliances: {},
  bracketState: null,
  rankedTeams: [],

  async initPlayoffs() {
    // Load playoff settings
    this.playoffSettings = await DB.getPlayoffSettings();
    this.alliances = await DB.getAlliances();
    this.bracketState = await DB.getBracket();

    // Calculate rankings for alliance selection
    await this.calculateRankings();

    // Bind playoff events
    this.bindPlayoffEvents();

    // Render initial state
    this.updatePlayoffUI();

    // Subscribe to updates
    this.unsubscribers.push(
      DB.subscribeToPlayoffSettings((settings) => {
        this.playoffSettings = settings || { allianceMode: "2-team", status: "setup" };
        this.updatePlayoffUI();
      })
    );

    this.unsubscribers.push(
      DB.subscribeToAlliances((alliances) => {
        this.alliances = alliances || {};
        this.updatePlayoffUI();
      })
    );

    this.unsubscribers.push(
      DB.subscribeToBracket((bracket) => {
        this.bracketState = bracket;
        this.updatePlayoffUI();
      })
    );
  },

  bindPlayoffEvents() {
    // Alliance mode toggle
    document.getElementById("mode-2team")?.addEventListener("click", () => {
      this.setAllianceMode("2-team");
    });

    document.getElementById("mode-1team")?.addEventListener("click", () => {
      const teamCount = Object.keys(this.teams).length;
      if (teamCount > 20) {
        this.showToast("1-team mode only available for 20 or fewer teams", "error");
        return;
      }
      this.setAllianceMode("1-team");
    });

    // Start alliance selection (2-team mode)
    document.getElementById("start-alliance-selection-btn")?.addEventListener("click", () => {
      this.startAllianceSelection();
    });

    // Generate bracket (1-team mode)
    document.getElementById("generate-bracket-btn")?.addEventListener("click", () => {
      this.generateBracketDirect();
    });

    // Confirm alliances and generate bracket
    document.getElementById("confirm-alliances-btn")?.addEventListener("click", () => {
      this.confirmAlliancesAndGenerateBracket();
    });

    // Set next match as current
    document.getElementById("bracket-next-match-btn")?.addEventListener("click", () => {
      this.setNextBracketMatch();
    });

    // Reset playoffs
    document.getElementById("reset-playoffs-btn")?.addEventListener("click", () => {
      this.confirmResetPlayoffs();
    });
  },

  async calculateRankings() {
    // Simple ranking based on win rate from played matches
    const teamStats = {};

    // Initialize all teams
    for (const [teamId, team] of Object.entries(this.teams)) {
      teamStats[teamId] = {
        teamId,
        teamNumber: team.number,
        teamName: team.name || "",
        matchesPlayed: 0,
        wins: 0,
        totalScore: 0
      };
    }

    // Process matches
    for (const [matchId, match] of Object.entries(this.matches)) {
      const scores = await DB.getMatchScores(matchId);
      if (!scores) continue;

      // Check if match has been played
      let hasScores = false;
      for (const pos of ["red1", "red2", "blue1", "blue2"]) {
        const actions = scores[pos]?.actions;
        if (actions && Object.values(actions).some(v => v > 0)) {
          hasScores = true;
          break;
        }
      }

      if (!hasScores) continue;

      // Calculate alliance scores
      const redScore = this.calculateAllianceScore(scores, "red");
      const blueScore = this.calculateAllianceScore(scores, "blue");

      // Update team stats
      for (const pos of ["red1", "red2"]) {
        const teamId = match[pos];
        if (teamStats[teamId]) {
          teamStats[teamId].matchesPlayed++;
          teamStats[teamId].totalScore += redScore;
          if (redScore > blueScore) teamStats[teamId].wins++;
        }
      }

      for (const pos of ["blue1", "blue2"]) {
        const teamId = match[pos];
        if (teamStats[teamId]) {
          teamStats[teamId].matchesPlayed++;
          teamStats[teamId].totalScore += blueScore;
          if (blueScore > redScore) teamStats[teamId].wins++;
        }
      }
    }

    // Sort by win rate, then total score
    this.rankedTeams = Object.values(teamStats)
      .sort((a, b) => {
        const aRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
        const bRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
        if (bRate !== aRate) return bRate - aRate;
        return b.totalScore - a.totalScore;
      });
  },

  calculateAllianceScore(scores, alliance) {
    const pos1 = alliance === "red" ? "red1" : "blue1";
    const pos2 = alliance === "red" ? "red2" : "blue2";

    const actions1 = scores[pos1]?.actions || {};
    const actions2 = scores[pos2]?.actions || {};

    return ScoringRules.calculateRobotScore(actions1) +
           ScoringRules.calculateRobotScore(actions2);
  },

  async setAllianceMode(mode) {
    if (this.playoffSettings?.status !== "setup") {
      this.showToast("Cannot change mode after playoffs started", "error");
      return;
    }

    this.playoffSettings = {
      ...this.playoffSettings,
      allianceMode: mode,
      status: "setup"
    };

    await DB.savePlayoffSettings(this.playoffSettings);
    this.updatePlayoffUI();
  },

  updatePlayoffUI() {
    const teamCount = Object.keys(this.teams).length;
    const settings = this.playoffSettings || { allianceMode: "2-team", status: "setup" };

    // Update team count display
    const teamCountEl = document.getElementById("playoff-team-count");
    if (teamCountEl) teamCountEl.textContent = teamCount;

    // Update alliance count display
    const allianceCount = Bracket.getAllianceCount(teamCount, settings.allianceMode);
    const allianceCountEl = document.getElementById("playoff-alliance-count");
    if (allianceCountEl) {
      allianceCountEl.textContent = allianceCount ? allianceCount : "N/A";
    }

    // Update mode toggle
    const mode2team = document.getElementById("mode-2team");
    const mode1team = document.getElementById("mode-1team");

    if (mode2team) {
      mode2team.classList.toggle("selected", settings.allianceMode === "2-team");
    }
    if (mode1team) {
      mode1team.classList.toggle("selected", settings.allianceMode === "1-team");
      mode1team.classList.toggle("disabled", teamCount > 20);
    }

    // Show/hide elements based on status
    const setupCard = document.getElementById("playoff-setup-card");
    const selectionCard = document.getElementById("alliance-selection-card");
    const bracketCard = document.getElementById("bracket-management-card");
    const championCard = document.getElementById("champion-card");
    const startSelectionBtn = document.getElementById("start-alliance-selection-btn");
    const generateBracketBtn = document.getElementById("generate-bracket-btn");

    // Reset visibility
    if (setupCard) setupCard.style.display = "block";
    if (selectionCard) selectionCard.style.display = "none";
    if (bracketCard) bracketCard.style.display = "none";
    if (championCard) championCard.style.display = "none";
    if (startSelectionBtn) startSelectionBtn.style.display = "none";
    if (generateBracketBtn) generateBracketBtn.style.display = "none";

    if (settings.status === "setup") {
      // Show appropriate button based on mode
      if (teamCount >= 4) {
        if (settings.allianceMode === "2-team") {
          if (startSelectionBtn) startSelectionBtn.style.display = "block";
        } else {
          if (generateBracketBtn) generateBracketBtn.style.display = "block";
        }
      }
    } else if (settings.status === "alliance_selection") {
      if (selectionCard) {
        selectionCard.style.display = "block";
        this.renderAllianceSelection();
      }
    } else if (settings.status === "in_progress" || settings.status === "bracket_ready") {
      if (bracketCard) {
        bracketCard.style.display = "block";
        this.renderBracketManagement();
      }
    }

    // Show champion if complete
    if (this.bracketState?.status === "complete" && this.bracketState?.champion) {
      if (championCard) {
        championCard.style.display = "block";
        this.renderChampionDisplay();
      }
    }
  },

  async startAllianceSelection() {
    await this.calculateRankings();

    const teamCount = Object.keys(this.teams).length;
    const allianceCount = Bracket.getAllianceCount(teamCount, "2-team");

    if (!allianceCount || teamCount < 4) {
      this.showToast("Not enough teams for playoffs", "error");
      return;
    }

    // Initialize alliances with captains from ranked teams
    const alliances = {};
    for (let i = 1; i <= allianceCount; i++) {
      const captain = this.rankedTeams[i - 1];
      alliances[i] = {
        seed: i,
        captain: captain?.teamId || null,
        pick: null,
        teams: captain ? [captain.teamId] : []
      };
    }

    await DB.saveAllAlliances(alliances);
    await DB.savePlayoffSettings({
      ...this.playoffSettings,
      status: "alliance_selection"
    });

    this.showToast("Alliance selection started", "success");
  },

  renderAllianceSelection() {
    const container = document.getElementById("alliance-selection-grid");
    const countEl = document.getElementById("alliances-formed-count");
    const confirmBtn = document.getElementById("confirm-alliances-btn");

    if (!container) return;

    const allianceCount = Object.keys(this.alliances).length;

    // Get ALL teams that have been assigned to any alliance (captains + picks)
    const takenTeamIds = new Set();
    for (const alliance of Object.values(this.alliances)) {
      // Add all teams in the alliance (captain + pick)
      if (alliance.teams) {
        alliance.teams.forEach(id => takenTeamIds.add(id));
      } else {
        // Fallback if teams array not populated
        if (alliance.captain) takenTeamIds.add(alliance.captain);
        if (alliance.pick) takenTeamIds.add(alliance.pick);
      }
    }

    // Count formed alliances
    let formedCount = 0;
    for (const alliance of Object.values(this.alliances)) {
      if (alliance.captain && alliance.pick) formedCount++;
    }

    if (countEl) {
      countEl.textContent = `${formedCount} of ${allianceCount} formed`;
    }

    if (confirmBtn) {
      confirmBtn.disabled = formedCount < allianceCount;
    }

    // Render alliance rows
    const rows = Object.entries(this.alliances)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([num, alliance]) => {
        const captain = this.teams[alliance.captain];
        const pick = this.teams[alliance.pick];
        const seedClass = num <= 3 ? `a${num}` : "";

        // Build pick dropdown
        let pickOptions = '<option value="">Select pick...</option>';

        // Add current pick if exists (always show as selected)
        if (alliance.pick && pick) {
          pickOptions += `<option value="${alliance.pick}" selected>${pick.number} - ${pick.name || "Team"}</option>`;
        }

        // Add available teams for this alliance to pick
        // Available = all ranked teams NOT in takenTeamIds, EXCEPT allow this alliance's own pick
        for (const team of this.rankedTeams) {
          // Skip if this team is the current alliance's captain
          if (team.teamId === alliance.captain) continue;

          // Skip if already selected by this alliance (we added it above)
          if (team.teamId === alliance.pick) continue;

          // Skip if this team is taken by another alliance
          if (takenTeamIds.has(team.teamId)) continue;

          const label = `${team.teamNumber} - ${team.teamName || "Team"}`;
          pickOptions += `<option value="${team.teamId}">${label}</option>`;
        }

        return `
          <div class="alliance-row">
            <div class="alliance-seed ${seedClass}">#${num}</div>
            <div class="captain-display">
              <div class="label">Captain</div>
              <div class="team-num">${captain?.number || "?"}</div>
            </div>
            <div>
              <select class="form-control alliance-pick-select" data-alliance="${num}" onchange="Admin.updateAlliancePick(${num}, this.value)">
                ${pickOptions}
              </select>
            </div>
          </div>
        `;
      }).join("");

    container.innerHTML = rows;
  },

  async updateAlliancePick(allianceNum, teamId) {
    const alliance = this.alliances[allianceNum];
    if (!alliance) return;

    // Check if the picked team is a captain of another alliance
    const pickedTeamWasCaptain = Object.entries(this.alliances).find(
      ([num, a]) => num !== String(allianceNum) && a.captain === teamId
    );

    alliance.pick = teamId || null;
    alliance.teams = [alliance.captain];
    if (teamId) alliance.teams.push(teamId);

    await DB.saveAlliance(allianceNum, alliance);

    // If picked team was a captain, slide up remaining teams
    if (pickedTeamWasCaptain && teamId) {
      await this.slideUpCaptains();
    }
  },

  async slideUpCaptains() {
    // Get all picked team IDs
    const pickedTeamIds = new Set();
    for (const alliance of Object.values(this.alliances)) {
      if (alliance.pick) pickedTeamIds.add(alliance.pick);
    }

    // Recalculate captains - assign next available ranked team to each alliance
    const allianceCount = Object.keys(this.alliances).length;
    let rankIndex = 0;

    for (let i = 1; i <= allianceCount; i++) {
      const alliance = this.alliances[i];

      // Find next available captain (not already picked by another alliance)
      while (rankIndex < this.rankedTeams.length && pickedTeamIds.has(this.rankedTeams[rankIndex].teamId)) {
        rankIndex++;
      }

      if (rankIndex < this.rankedTeams.length) {
        const newCaptain = this.rankedTeams[rankIndex].teamId;

        // Only update if captain changed and this alliance hasn't picked yet
        if (alliance.captain !== newCaptain && !alliance.pick) {
          alliance.captain = newCaptain;
          alliance.teams = [newCaptain];
          await DB.saveAlliance(i, alliance);
        }
        rankIndex++;
      }
    }
  },

  async confirmAlliancesAndGenerateBracket() {
    // Verify all alliances are complete
    for (const alliance of Object.values(this.alliances)) {
      if (!alliance.captain || !alliance.pick) {
        this.showToast("All alliances must have a captain and pick", "error");
        return;
      }
    }

    // Generate bracket
    const allianceCount = Object.keys(this.alliances).length;
    const bracketState = Bracket.generateBracket(allianceCount, this.alliances);

    // Create playoff matches
    await this.createPlayoffMatches(bracketState);

    // Save bracket state
    await DB.saveBracket(bracketState);

    // Update playoff settings
    await DB.savePlayoffSettings({
      ...this.playoffSettings,
      status: "in_progress"
    });

    this.showToast("Playoff bracket generated!", "success");
  },

  async generateBracketDirect() {
    // For 1-team alliance mode
    await this.calculateRankings();

    const teamCount = Object.keys(this.teams).length;
    const allianceCount = Bracket.getAllianceCount(teamCount, "1-team");

    if (!allianceCount) {
      this.showToast("Not enough teams for playoffs", "error");
      return;
    }

    // Create alliances from ranked teams (1 team each)
    const alliances = {};
    for (let i = 1; i <= allianceCount; i++) {
      const team = this.rankedTeams[i - 1];
      alliances[i] = {
        seed: i,
        teams: team ? [team.teamId] : []
      };
    }

    await DB.saveAllAlliances(alliances);

    // Generate bracket
    const bracketState = Bracket.generateBracket(allianceCount, alliances);

    // Create playoff matches
    await this.createPlayoffMatches(bracketState);

    // Save bracket state
    await DB.saveBracket(bracketState);

    // Update playoff settings
    await DB.savePlayoffSettings({
      ...this.playoffSettings,
      status: "in_progress"
    });

    this.showToast("Playoff bracket generated!", "success");
  },

  async createPlayoffMatches(bracketState) {
    // Create a match in the matches collection for each bracket match
    const is1Team = this.playoffSettings?.allianceMode === "1-team";

    for (const [matchId, match] of Object.entries(bracketState.matches)) {
      // Skip conditional matches that aren't needed yet
      if (match.conditional) continue;

      const playoffMatchId = `playoff_${matchId}`;

      // Get team IDs from alliances
      let red1 = null, red2 = null, blue1 = null, blue2 = null;

      if (match.red !== null) {
        const redAlliance = bracketState.alliances[match.red];
        if (redAlliance?.teams) {
          red1 = redAlliance.teams[0] || null;
          red2 = is1Team ? redAlliance.teams[0] : (redAlliance.teams[1] || null);
        }
      }

      if (match.blue !== null) {
        const blueAlliance = bracketState.alliances[match.blue];
        if (blueAlliance?.teams) {
          blue1 = blueAlliance.teams[0] || null;
          blue2 = is1Team ? blueAlliance.teams[0] : (blueAlliance.teams[1] || null);
        }
      }

      // Create match
      await DB.saveMatch(playoffMatchId, {
        number: `P-${matchId}`,
        red1,
        red2,
        blue1,
        blue2,
        type: "playoff",
        bracketMatchId: matchId,
        createdAt: Date.now()
      });

      // Update bracket with match reference
      bracketState.matches[matchId].scoreMatchId = playoffMatchId;
    }

    // Save updated bracket state with match references
    await DB.saveBracket(bracketState);
  },

  renderBracketManagement() {
    if (!this.bracketState) return;

    // Update status display
    const statusDot = document.getElementById("bracket-status-dot");
    const statusText = document.getElementById("bracket-status-text");

    if (statusDot && statusText) {
      if (this.bracketState.status === "complete") {
        statusDot.className = "status-dot complete";
        statusText.textContent = "Tournament Complete";
      } else {
        statusDot.className = "status-dot in-progress";
        statusText.textContent = "In Progress";
      }
    }

    // Render match list
    const container = document.getElementById("bracket-matches-list");
    if (!container) return;

    const matchEntries = Object.entries(this.bracketState.matches)
      .filter(([id, m]) => !m.conditional || Bracket.isConditionalMatchNeeded(this.bracketState, id))
      .sort((a, b) => {
        const numA = parseInt(a[0].substring(1));
        const numB = parseInt(b[0].substring(1));
        return numA - numB;
      });

    const rows = matchEntries.map(([matchId, match]) => {
      const isReady = Bracket.isMatchReady(this.bracketState, matchId);
      const isCurrent = this.matches[match.scoreMatchId] && match.scoreMatchId === this.currentMatchId;
      const isCompleted = match.played;

      const redAlliance = this.bracketState.alliances[match.red];
      const blueAlliance = this.bracketState.alliances[match.blue];

      const redDisplay = match.red !== null ? `Alliance ${match.red}` : "TBD";
      const blueDisplay = match.blue !== null ? `Alliance ${match.blue}` : "TBD";

      const redTeams = redAlliance?.teams?.map(id => this.teams[id]?.number).join(" & ") || "";
      const blueTeams = blueAlliance?.teams?.map(id => this.teams[id]?.number).join(" & ") || "";

      // Build action buttons
      let actionsHtml = "";
      if (isCompleted) {
        actionsHtml = `<span style="color: var(--accent-green);">Done</span>`;
      } else if (isReady) {
        actionsHtml = `
          <div class="bracket-match-actions">
            <button class="btn btn-secondary btn-sm" onclick="Admin.setPlayoffMatchCurrent('${matchId}')" title="Set as current match">
              ${isCurrent ? "Current" : "Set Current"}
            </button>
            <div class="winner-buttons">
              <button class="btn btn-sm" style="background: var(--red-alliance); color: white;"
                      onclick="Admin.recordWinner('${matchId}', 'red')" title="Red wins">
                Red Wins
              </button>
              <button class="btn btn-sm" style="background: var(--blue-alliance); color: white;"
                      onclick="Admin.recordWinner('${matchId}', 'blue')" title="Blue wins">
                Blue Wins
              </button>
            </div>
          </div>
        `;
      } else {
        actionsHtml = `<span style="color: var(--text-secondary);">Waiting</span>`;
      }

      return `
        <div class="bracket-match-item ${isCurrent ? "current" : ""} ${isCompleted ? "completed" : ""}">
          <div class="match-id">${matchId}</div>
          <div class="alliance-slot red ${match.red === null ? "tbd" : ""} ${match.winner === "red" ? "winner" : ""}">
            ${redDisplay}${redTeams ? `<br><small>${redTeams}</small>` : ""}
          </div>
          <div class="alliance-slot blue ${match.blue === null ? "tbd" : ""} ${match.winner === "blue" ? "winner" : ""}">
            ${blueDisplay}${blueTeams ? `<br><small>${blueTeams}</small>` : ""}
          </div>
          <div class="bracket-match-controls">
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = rows || '<p class="text-secondary">No matches in bracket</p>';
  },

  async setPlayoffMatchCurrent(bracketMatchId) {
    const match = this.bracketState?.matches[bracketMatchId];
    if (!match?.scoreMatchId) {
      // Need to create the match first
      await this.ensurePlayoffMatchExists(bracketMatchId);
    }

    const updatedMatch = this.bracketState?.matches[bracketMatchId];
    if (updatedMatch?.scoreMatchId) {
      await DB.setCurrentMatch(updatedMatch.scoreMatchId);
      this.showToast(`${bracketMatchId} set as current match`, "success");
    }
  },

  async ensurePlayoffMatchExists(bracketMatchId) {
    // Create the playoff match if it doesn't exist
    const match = this.bracketState?.matches[bracketMatchId];
    if (!match) return;

    const playoffMatchId = `playoff_${bracketMatchId}`;
    const is1Team = this.playoffSettings?.allianceMode === "1-team";

    let red1 = null, red2 = null, blue1 = null, blue2 = null;

    if (match.red !== null) {
      const redAlliance = this.bracketState.alliances[match.red];
      if (redAlliance?.teams) {
        red1 = redAlliance.teams[0] || null;
        red2 = is1Team ? redAlliance.teams[0] : (redAlliance.teams[1] || null);
      }
    }

    if (match.blue !== null) {
      const blueAlliance = this.bracketState.alliances[match.blue];
      if (blueAlliance?.teams) {
        blue1 = blueAlliance.teams[0] || null;
        blue2 = is1Team ? blueAlliance.teams[0] : (blueAlliance.teams[1] || null);
      }
    }

    await DB.saveMatch(playoffMatchId, {
      number: `P-${bracketMatchId}`,
      red1,
      red2,
      blue1,
      blue2,
      type: "playoff",
      bracketMatchId: bracketMatchId,
      createdAt: Date.now()
    });

    // Update bracket state
    this.bracketState.matches[bracketMatchId].scoreMatchId = playoffMatchId;
    await DB.saveBracket(this.bracketState);
  },

  async setNextBracketMatch() {
    if (!this.bracketState) return;

    const nextMatchId = Bracket.getNextMatch(this.bracketState);
    if (nextMatchId) {
      await this.setPlayoffMatchCurrent(nextMatchId);
    } else {
      this.showToast("No ready matches available", "warning");
    }
  },

  renderChampionDisplay() {
    const container = document.getElementById("champion-display");
    if (!container || !this.bracketState?.champion) return;

    const championAlliance = this.bracketState.alliances[this.bracketState.champion];
    const teams = championAlliance?.teams?.map(id => {
      const team = this.teams[id];
      return team ? `${team.number} - ${team.name || ""}` : id;
    }) || [];

    container.innerHTML = `
      <div style="font-size: 4rem; margin-bottom: var(--spacing-md);">🏆</div>
      <h2 style="font-size: 2rem; color: var(--accent-yellow); margin-bottom: var(--spacing-md);">
        Alliance ${this.bracketState.champion}
      </h2>
      <div style="font-size: 1.25rem;">
        ${teams.join("<br>")}
      </div>
    `;
  },

  confirmResetPlayoffs() {
    showModal(
      "Reset Playoffs?",
      "This will delete all playoff data including alliances, bracket, and playoff matches. Qualification matches will not be affected.",
      () => this.resetPlayoffs()
    );
  },

  async resetPlayoffs() {
    // Delete playoff matches
    for (const [matchId, match] of Object.entries(this.matches)) {
      if (match.type === "playoff") {
        await DB.deleteMatch(matchId);
        if (DB.db) {
          await DB.db.ref(`scores/${matchId}`).remove();
        }
      }
    }

    // Clear playoff data
    await DB.clearPlayoffData();

    // Reset local state
    this.playoffSettings = { allianceMode: "2-team", status: "setup" };
    this.alliances = {};
    this.bracketState = null;

    // Save fresh settings
    await DB.savePlayoffSettings(this.playoffSettings);

    this.updatePlayoffUI();
    this.showToast("Playoffs reset", "warning");
    closeModal();
  },

  // Record winner from admin UI (takes bracket match ID like "M1")
  async recordWinner(bracketMatchId, winner) {
    if (!this.bracketState) {
      this.showToast("No bracket loaded", "error");
      return;
    }

    const match = this.bracketState.matches[bracketMatchId];
    if (!match) {
      this.showToast("Match not found", "error");
      return;
    }

    if (match.played) {
      this.showToast("Match already completed", "warning");
      return;
    }

    if (match.red === null || match.blue === null) {
      this.showToast("Match not ready - alliances not determined", "error");
      return;
    }

    // Get winning alliance info for toast
    const winningAlliance = winner === "red" ? match.red : match.blue;

    // Record result and advance teams
    this.bracketState = Bracket.recordResult(this.bracketState, bracketMatchId, winner);

    // Create any new matches that are now ready
    await this.createNewBracketMatches();

    // Save updated bracket
    await DB.saveBracket(this.bracketState);

    if (this.bracketState.status === "complete") {
      this.showToast(`Tournament complete! Alliance ${this.bracketState.champion} wins!`, "success");
    } else {
      this.showToast(`${bracketMatchId}: Alliance ${winningAlliance} wins!`, "success");
    }

    // Re-render bracket management
    this.renderBracketManagement();
  },

  // Record a bracket match result (called after match is finalized)
  async recordBracketResult(playoffMatchId, winner) {
    if (!this.bracketState) return;

    // Find the bracket match
    let bracketMatchId = null;
    for (const [id, match] of Object.entries(this.bracketState.matches)) {
      if (match.scoreMatchId === playoffMatchId) {
        bracketMatchId = id;
        break;
      }
    }

    if (!bracketMatchId) return;

    // Use the new recordWinner function
    await this.recordWinner(bracketMatchId, winner);
  },

  async createNewBracketMatches() {
    // Create matches for any bracket matches that are now ready
    const is1Team = this.playoffSettings?.allianceMode === "1-team";

    for (const [matchId, match] of Object.entries(this.bracketState.matches)) {
      if (match.scoreMatchId) continue; // Already exists
      if (match.conditional && !Bracket.isConditionalMatchNeeded(this.bracketState, matchId)) continue;
      if (match.red === null || match.blue === null) continue; // Not ready

      const playoffMatchId = `playoff_${matchId}`;

      const redAlliance = this.bracketState.alliances[match.red];
      const blueAlliance = this.bracketState.alliances[match.blue];

      let red1 = null, red2 = null, blue1 = null, blue2 = null;

      if (redAlliance?.teams) {
        red1 = redAlliance.teams[0] || null;
        red2 = is1Team ? redAlliance.teams[0] : (redAlliance.teams[1] || null);
      }

      if (blueAlliance?.teams) {
        blue1 = blueAlliance.teams[0] || null;
        blue2 = is1Team ? blueAlliance.teams[0] : (blueAlliance.teams[1] || null);
      }

      await DB.saveMatch(playoffMatchId, {
        number: `P-${matchId}`,
        red1,
        red2,
        blue1,
        blue2,
        type: "playoff",
        bracketMatchId: matchId,
        createdAt: Date.now()
      });

      this.bracketState.matches[matchId].scoreMatchId = playoffMatchId;
    }
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
