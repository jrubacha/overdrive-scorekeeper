// Rankings Calculation and Display
// =================================

const Rankings = {
  teams: {},
  matches: {},
  scores: {},
  rankings: [],
  unsubscribers: [],

  // Auto-scroll state
  autoScrollEnabled: true,
  scrollPosition: 0,
  scrollSpeed: 0.3,  // pixels per frame (slower = more leisurely)
  pauseAtTop: 3000,  // ms to pause at top before scrolling
  scrollPaused: false,
  animationFrame: null,
  originalContentHeight: 0,  // height of original content (before duplication)

  // Point categories for tiebreakers
  trackballActionIds: [
    "auto_ball_removed_1",
    "auto_ball_removed_2",
    "auto_ball_finish",
    "auto_ball_hurdle",
    "tele_ball_finish",
    "tele_ball_hurdle",
    "tele_ball_on_overpass"
  ],

  lapActionIds: [
    "auto_robot_lane",
    "auto_robot_opp_finish",
    "auto_robot_ally_finish",
    "tele_robot_finish"
  ],

  autoActionIds: [
    "auto_robot_lane",
    "auto_robot_opp_finish",
    "auto_robot_ally_finish",
    "auto_ball_removed_1",
    "auto_ball_removed_2",
    "auto_ball_finish",
    "auto_ball_hurdle"
  ],

  // Initialize
  async init() {
    await DB.init();
    this.updateConnectionStatus();

    // Load initial data
    await this.loadAllData();

    // Subscribe to updates
    this.subscribeToUpdates();

    // Listen for connection changes
    window.addEventListener("db:connectionChange", () => this.updateConnectionStatus());

    // Set up auto-scroll toggle
    const scrollToggle = document.getElementById("auto-scroll-toggle");
    if (scrollToggle) {
      scrollToggle.addEventListener("change", (e) => {
        this.autoScrollEnabled = e.target.checked;
        if (this.autoScrollEnabled) {
          this.startAutoScroll();
        } else {
          this.stopAutoScroll();
        }
      });
    }

    // Start auto-scroll
    this.startAutoScroll();
  },

  // Auto-scroll functions
  startAutoScroll() {
    if (this.animationFrame) return;
    this.scrollPosition = 0;
    this.scrollPaused = true;  // Start with a pause at top

    // Initial pause before starting scroll
    setTimeout(() => {
      this.scrollPaused = false;
      this.autoScrollLoop();
    }, this.pauseAtTop);
  },

  stopAutoScroll() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  },

  autoScrollLoop() {
    if (!this.autoScrollEnabled) return;

    const container = document.getElementById("table-scroll");
    if (!container) return;

    // Only scroll if we have original content height set and not paused
    if (this.originalContentHeight > 0 && !this.scrollPaused) {
      this.scrollPosition += this.scrollSpeed;

      // When we've scrolled past the original content (plus gap),
      // seamlessly reset to top
      if (this.scrollPosition >= this.originalContentHeight) {
        this.scrollPosition = 0;
        container.scrollTop = 0;
        // Pause at the top
        this.scrollPaused = true;
        setTimeout(() => {
          this.scrollPaused = false;
        }, this.pauseAtTop);
      } else {
        container.scrollTop = this.scrollPosition;
      }
    }

    this.animationFrame = requestAnimationFrame(() => this.autoScrollLoop());
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

  async loadAllData() {
    this.teams = (await DB.getTeams()) || {};
    this.matches = (await DB.getMatches()) || {};

    // Load all match scores
    this.scores = {};
    for (const matchId of Object.keys(this.matches)) {
      this.scores[matchId] = await DB.getMatchScores(matchId);
    }

    this.calculateRankings();
    this.renderRankings();
  },

  subscribeToUpdates() {
    // Subscribe to teams
    this.unsubscribers.push(
      DB.subscribeToTeams((teams) => {
        this.teams = teams || {};
        this.calculateRankings();
        this.renderRankings();
      })
    );

    // Subscribe to matches
    this.unsubscribers.push(
      DB.subscribeToMatches(async (matches) => {
        this.matches = matches || {};
        // Reload scores for any new matches
        for (const matchId of Object.keys(this.matches)) {
          if (!this.scores[matchId]) {
            this.scores[matchId] = await DB.getMatchScores(matchId);
          }
        }
        this.calculateRankings();
        this.renderRankings();
      })
    );

    // Subscribe to score changes for each match
    for (const matchId of Object.keys(this.matches)) {
      this.subscribeToMatchScores(matchId);
    }
  },

  subscribeToMatchScores(matchId) {
    this.unsubscribers.push(
      DB.subscribeToMatchScores(matchId, (scores) => {
        this.scores[matchId] = scores;
        this.calculateRankings();
        this.renderRankings();
      })
    );
  },

  // Calculate points for specific action categories
  calculateCategoryPoints(actions, actionIds) {
    let points = 0;
    for (const actionId of actionIds) {
      const count = actions[actionId] || 0;
      const rule = this.findRuleById(actionId);
      if (rule) {
        points += count * rule.points;
      }
    }
    return points;
  },

  findRuleById(actionId) {
    // Search autonomous rules
    for (const rule of Object.values(ScoringRules.autonomous)) {
      if (rule.id === actionId) return rule;
    }
    // Search teleop rules
    for (const rule of Object.values(ScoringRules.teleop)) {
      if (rule.id === actionId) return rule;
    }
    return null;
  },

  // Calculate alliance score for a match
  calculateAllianceMatchScore(matchId, alliance) {
    const scores = this.scores[matchId];
    if (!scores) return { total: 0, auto: 0, trackball: 0, lap: 0 };

    const pos1 = alliance === "red" ? "red1" : "blue1";
    const pos2 = alliance === "red" ? "red2" : "blue2";
    const oppPos1 = alliance === "red" ? "blue1" : "red1";
    const oppPos2 = alliance === "red" ? "blue2" : "red2";

    const actions1 = scores[pos1]?.actions || {};
    const actions2 = scores[pos2]?.actions || {};
    const oppActions1 = scores[oppPos1]?.actions || {};
    const oppActions2 = scores[oppPos2]?.actions || {};

    // Calculate base scores
    const robot1Score = ScoringRules.calculateRobotScore(actions1);
    const robot2Score = ScoringRules.calculateRobotScore(actions2);

    // Penalties from opponents add to our score
    const oppPenalties = ScoringRules.calculatePenalties(oppActions1) +
                         ScoringRules.calculatePenalties(oppActions2);

    const total = robot1Score + robot2Score + oppPenalties;

    // Calculate category breakdowns (own team only, no penalties)
    const auto = this.calculateCategoryPoints(actions1, this.autoActionIds) +
                 this.calculateCategoryPoints(actions2, this.autoActionIds);

    const trackball = this.calculateCategoryPoints(actions1, this.trackballActionIds) +
                      this.calculateCategoryPoints(actions2, this.trackballActionIds);

    const lap = this.calculateCategoryPoints(actions1, this.lapActionIds) +
                this.calculateCategoryPoints(actions2, this.lapActionIds);

    return { total, auto, trackball, lap };
  },

  // Get individual team's contribution to match
  getTeamMatchStats(matchId, teamId) {
    const match = this.matches[matchId];
    if (!match) return null;

    const scores = this.scores[matchId];
    if (!scores) return null;

    // Find which position this team was in
    let position = null;
    let alliance = null;

    for (const pos of ["red1", "red2", "blue1", "blue2"]) {
      if (match[pos] === teamId) {
        position = pos;
        alliance = pos.startsWith("red") ? "red" : "blue";
        break;
      }
    }

    if (!position) return null;

    const actions = scores[position]?.actions || {};

    // Calculate this team's individual stats
    const teamScore = ScoringRules.calculateRobotScore(actions);
    const auto = this.calculateCategoryPoints(actions, this.autoActionIds);
    const trackball = this.calculateCategoryPoints(actions, this.trackballActionIds);
    const lap = this.calculateCategoryPoints(actions, this.lapActionIds);

    // Get alliance totals for win/loss calculation
    const allianceStats = this.calculateAllianceMatchScore(matchId, alliance);
    const oppAlliance = alliance === "red" ? "blue" : "red";
    const oppStats = this.calculateAllianceMatchScore(matchId, oppAlliance);

    // Determine result
    let result = "loss";
    if (allianceStats.total > oppStats.total) {
      result = "win";
    } else if (allianceStats.total === oppStats.total) {
      result = "tie";
    }

    return {
      teamScore,
      auto,
      trackball,
      lap,
      allianceTotal: allianceStats.total,
      oppTotal: oppStats.total,
      result
    };
  },

  // Check if a match has been played (has scores)
  isMatchPlayed(matchId) {
    const scores = this.scores[matchId];
    if (!scores) return false;

    // Check if at least one position has actions
    for (const pos of ["red1", "red2", "blue1", "blue2"]) {
      const actions = scores[pos]?.actions;
      if (actions) {
        // Check if any action has a non-zero value
        for (const count of Object.values(actions)) {
          if (count > 0) return true;
        }
      }
    }
    return false;
  },

  // Main ranking calculation
  calculateRankings() {
    const teamStats = {};

    // Initialize stats for all teams
    for (const [teamId, team] of Object.entries(this.teams)) {
      teamStats[teamId] = {
        teamId,
        teamNumber: team.number,
        teamName: team.name || "",
        matchesPlayed: 0,
        rankingPoints: 0,
        totalScore: 0,
        autoPoints: 0,
        trackballPoints: 0,
        lapPoints: 0
      };
    }

    // Process each played match
    for (const [matchId, match] of Object.entries(this.matches)) {
      if (!this.isMatchPlayed(matchId)) continue;

      // Get all teams in this match
      const teamsInMatch = [match.red1, match.red2, match.blue1, match.blue2];

      for (const teamId of teamsInMatch) {
        if (!teamId || !teamStats[teamId]) continue;

        const stats = this.getTeamMatchStats(matchId, teamId);
        if (!stats) continue;

        teamStats[teamId].matchesPlayed++;
        teamStats[teamId].totalScore += stats.teamScore;
        teamStats[teamId].autoPoints += stats.auto;
        teamStats[teamId].trackballPoints += stats.trackball;
        teamStats[teamId].lapPoints += stats.lap;

        // Award ranking points
        if (stats.result === "win") {
          teamStats[teamId].rankingPoints += 2;
        } else if (stats.result === "tie") {
          teamStats[teamId].rankingPoints += 1;
        }
      }
    }

    // Calculate ranking scores and sort
    this.rankings = Object.values(teamStats)
      .filter(t => t.matchesPlayed > 0) // Only show teams that have played
      .map(t => ({
        ...t,
        rankingScore: t.matchesPlayed > 0 ? t.rankingPoints / t.matchesPlayed : 0
      }))
      .sort((a, b) => {
        // Primary: Ranking Score (higher is better)
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore;
        }
        // Tiebreaker 1: Total Score (auto + teleop)
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        // Tiebreaker 2: Auto Points
        if (b.autoPoints !== a.autoPoints) {
          return b.autoPoints - a.autoPoints;
        }
        // Tiebreaker 3: Trackball Points
        if (b.trackballPoints !== a.trackballPoints) {
          return b.trackballPoints - a.trackballPoints;
        }
        // Tiebreaker 4: Lap Points
        if (b.lapPoints !== a.lapPoints) {
          return b.lapPoints - a.lapPoints;
        }
        // Tiebreaker 5: Random (use team number as pseudo-random)
        return a.teamNumber.localeCompare(b.teamNumber);
      });

    // Assign ranks
    this.rankings.forEach((team, index) => {
      team.rank = index + 1;
    });
  },

  renderRankings() {
    const tbody = document.getElementById("rankings-body");
    const countEl = document.getElementById("team-count");

    if (!tbody) return;

    if (this.rankings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            No matches have been played yet
          </td>
        </tr>
      `;
      if (countEl) countEl.textContent = "0 teams ranked";
      this.originalContentHeight = 0;
      return;
    }

    if (countEl) {
      countEl.textContent = `${this.rankings.length} team${this.rankings.length !== 1 ? "s" : ""} ranked`;
    }

    // Create the original rankings rows
    const originalRows = this.rankings.map(team => `
      <tr>
        <td class="rank-cell">${team.rank}</td>
        <td class="team-number-cell">${team.teamNumber}</td>
        <td class="team-name-cell">${team.teamName}</td>
        <td class="score-cell">${team.rankingScore.toFixed(2)}</td>
        <td class="score-cell">${team.totalScore}</td>
        <td class="score-cell">${team.autoPoints}</td>
        <td class="score-cell">${team.trackballPoints}</td>
        <td class="score-cell">${team.lapPoints}</td>
      </tr>
    `).join("");

    // Gap rows between original and duplicated content
    const gapRows = `
      <tr class="gap-row"><td colspan="8" style="height: 60px; border: none;"></td></tr>
      <tr class="gap-row"><td colspan="8" style="height: 60px; border: none;"></td></tr>
    `;

    // Duplicate rows for seamless scrolling (so #1 appears below last place)
    const duplicateRows = this.rankings.map(team => `
      <tr class="duplicate-row">
        <td class="rank-cell">${team.rank}</td>
        <td class="team-number-cell">${team.teamNumber}</td>
        <td class="team-name-cell">${team.teamName}</td>
        <td class="score-cell">${team.rankingScore.toFixed(2)}</td>
        <td class="score-cell">${team.totalScore}</td>
        <td class="score-cell">${team.autoPoints}</td>
        <td class="score-cell">${team.trackballPoints}</td>
        <td class="score-cell">${team.lapPoints}</td>
      </tr>
    `).join("");

    tbody.innerHTML = originalRows + gapRows + duplicateRows;

    // Calculate original content height (original rows + gap) for scroll reset point
    // We need to wait a tick for the DOM to update
    requestAnimationFrame(() => {
      const rows = tbody.querySelectorAll("tr:not(.duplicate-row):not(.gap-row)");
      const gapRowElements = tbody.querySelectorAll(".gap-row");
      let height = 0;
      rows.forEach(row => height += row.offsetHeight);
      gapRowElements.forEach(row => height += row.offsetHeight);
      this.originalContentHeight = height;
    });
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen();
    }
  },

  destroy() {
    this.stopAutoScroll();
    this.unsubscribers.forEach(unsub => unsub());
  }
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => Rankings.init());

// Cleanup on unload
window.addEventListener("beforeunload", () => Rankings.destroy());

// Keyboard shortcut for fullscreen
document.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    Rankings.toggleFullscreen();
  }
});
