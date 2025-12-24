// Bracket Display Module
// ======================
// Renders the visual playoff bracket for audience display

const BracketDisplay = {
  bracketState: null,
  alliances: {},
  teams: {},
  currentMatchId: null,
  unsubscribers: [],

  // Define round layouts for each bracket size
  // Upper and Lower brackets with matches per round
  bracketLayouts: {
    4: {
      rounds: ["Round 1", "Round 2", "Round 3", "Finals"],
      upper: [
        ["M1", "M2"],  // Round 1
        ["M4"],        // Round 2
        []             // Round 3 (empty)
      ],
      lower: [
        [],            // Round 1 (empty)
        ["M3"],        // Round 2
        ["M5"]         // Round 3
      ],
      finals: ["M6", "M7"]
    },
    6: {
      rounds: ["Round 1", "Round 2", "Round 3", "Round 4", "Finals"],
      upper: [
        ["M1", "M2"],  // Round 1
        ["M3", "M4"],  // Round 2
        ["M7"],        // Round 3
        []             // Round 4 (empty)
      ],
      lower: [
        [],            // Round 1 (empty)
        ["M5", "M6"],  // Round 2
        ["M8"],        // Round 3
        ["M9"]         // Round 4
      ],
      finals: ["M10", "M11"]
    },
    8: {
      rounds: ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Finals"],
      upper: [
        ["M1", "M2", "M3", "M4"],  // Round 1
        ["M7", "M8"],              // Round 2
        [],                        // Round 3 (empty)
        ["M11"],                   // Round 4
        []                         // Round 5 (empty)
      ],
      lower: [
        [],                        // Round 1 (empty)
        ["M5", "M6"],              // Round 2
        ["M9", "M10"],             // Round 3
        ["M12"],                   // Round 4
        ["M13"]                    // Round 5
      ],
      finals: ["M14", "M15"]
    }
  },

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
    if (allianceCount === 2) {
      container.innerHTML = this.render2AllianceBracket();
    } else if (this.bracketLayouts[allianceCount]) {
      container.innerHTML = this.renderBracket(allianceCount);
    } else {
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

  // Get the slot display text for an alliance slot
  getSlotDisplay(allianceNum, slotFrom, slot) {
    // If we have an actual alliance number, show it
    if (allianceNum != null) {
      const alliance = this.bracketState?.alliances[allianceNum] || this.alliances[allianceNum];
      const teamNumbers = alliance?.teams?.map(id => this.teams[id]?.number || "?").join(" & ") || "";
      return {
        text: `Alliance ${allianceNum}`,
        subtext: teamNumbers,
        type: "alliance"
      };
    }

    // If we have source info, show "W M#" or "L M#"
    if (slotFrom) {
      const result = slotFrom.result === "winner" ? "W" : "L";
      return {
        text: `${result} ${slotFrom.match}`,
        subtext: slotFrom.result === "winner" ? "Winner" : "Loser",
        type: slotFrom.result
      };
    }

    return { text: "TBD", subtext: "", type: "tbd" };
  },

  // Render a single match box with proper slot displays
  renderMatchBox(matchId) {
    const match = this.bracketState?.matches[matchId];
    if (!match) return "";

    const isCurrent = match.scoreMatchId === this.currentMatchId;
    const isConditional = match.conditional;

    // For conditional matches, check if they're needed
    if (isConditional) {
      const allianceCount = this.bracketState.allianceCount;
      if (allianceCount === 2) {
        // Best of 3 logic
        let wins = { red: 0, blue: 0 };
        for (const m of Object.values(this.bracketState.matches)) {
          if (m.played) {
            if (m.winner === "red") wins.red++;
            else if (m.winner === "blue") wins.blue++;
          }
        }
        if (wins.red >= 2 || wins.blue >= 2) {
          return ""; // Match not needed
        }
        if (matchId === "M2" && wins.red + wins.blue < 1) {
          return ""; // M2 not ready yet
        }
        if (matchId === "M3" && wins.red + wins.blue < 2) {
          return ""; // M3 not ready yet
        }
      } else {
        // Finals 2 needed only if lower bracket won Finals 1
        const finals1Id = allianceCount === 4 ? "M6" : (allianceCount === 6 ? "M10" : "M14");
        const finals1 = this.bracketState.matches[finals1Id];
        if (!finals1?.played || finals1.winner !== "blue") {
          if (!match.played) return ""; // Match not needed
        }
      }
    }

    const redDisplay = this.getSlotDisplay(match.red, match.redFrom, "red");
    const blueDisplay = this.getSlotDisplay(match.blue, match.blueFrom, "blue");

    const boxClasses = ["match-box"];
    if (isCurrent) boxClasses.push("current");
    if (match.played) boxClasses.push("completed");
    if (isConditional) boxClasses.push("conditional");

    // Determine slot classes
    const getSlotClass = (display, winner, slot) => {
      const classes = ["alliance-slot", slot];
      if (display.type === "tbd") {
        classes.push("tbd");
      } else if (display.type === "winner") {
        classes.push("from-winner");
      } else if (display.type === "loser") {
        classes.push("from-loser");
      }
      if (match.played && match.winner === slot) {
        classes.push("winner");
      }
      return classes.join(" ");
    };

    return `
      <div class="${boxClasses.join(" ")}" data-match="${matchId}">
        <div class="match-header">${matchId}</div>
        <div class="${getSlotClass(redDisplay, match.winner, "red")}">
          <span class="alliance-name">${redDisplay.text}</span>
          ${match.played && match.winner === "red" ? '<span class="winner-icon">&#9654;</span>' : ""}
        </div>
        <div class="${getSlotClass(blueDisplay, match.winner, "blue")}">
          <span class="alliance-name">${blueDisplay.text}</span>
          ${match.played && match.winner === "blue" ? '<span class="winner-icon">&#9654;</span>' : ""}
        </div>
      </div>
    `;
  },

  // Generate connector lines based on winnerTo paths only (no loser paths)
  generateConnectors(allianceCount) {
    const template = Bracket.templates[allianceCount];
    if (!template) return [];

    const connectors = [];

    for (const [matchId, matchDef] of Object.entries(template.matches)) {
      // Only show winner paths, not loser paths
      if (matchDef.winnerTo) {
        connectors.push({
          from: matchId,
          to: matchDef.winnerTo.match,
          slot: matchDef.winnerTo.slot
        });
      }
    }

    return connectors;
  },

  // Render a round column with matches
  renderRoundColumn(matches, roundIndex) {
    let html = `<div class="round-column" data-round="${roundIndex + 1}">`;

    for (const matchId of matches) {
      html += `<div class="match-wrapper">${this.renderMatchBox(matchId)}</div>`;
    }

    // Add empty placeholder if no matches in this round
    if (matches.length === 0) {
      html += '<div class="match-wrapper empty"></div>';
    }

    html += '</div>';
    return html;
  },

  // Render the bracket using upper/lower bracket layout
  renderBracket(allianceCount) {
    const layout = this.bracketLayouts[allianceCount];
    if (!layout) return "";

    const connectors = this.generateConnectors(allianceCount);
    const numRounds = layout.rounds.length - 1; // Exclude "Finals" from count

    let html = `<div class="bracket-grid bracket-${allianceCount}" data-rounds="${layout.rounds.length}">`;

    // Render round labels row
    html += '<div class="round-labels-row">';
    for (const roundLabel of layout.rounds) {
      html += `<div class="round-label">${roundLabel}</div>`;
    }
    html += '</div>';

    // Upper Bracket Section
    html += '<div class="bracket-section upper-bracket">';
    html += '<div class="section-label">Upper Bracket</div>';
    html += '<div class="section-rounds">';

    for (let i = 0; i < layout.upper.length; i++) {
      html += this.renderRoundColumn(layout.upper[i], i);
    }

    // Finals column (shared between upper and lower visually)
    html += '<div class="round-column finals-column">';
    for (const matchId of layout.finals) {
      html += `<div class="match-wrapper">${this.renderMatchBox(matchId)}</div>`;
    }
    html += '</div>';

    html += '</div></div>';

    // Lower Bracket Section
    html += '<div class="bracket-section lower-bracket">';
    html += '<div class="section-label">Lower Bracket</div>';
    html += '<div class="section-rounds">';

    for (let i = 0; i < layout.lower.length; i++) {
      html += this.renderRoundColumn(layout.lower[i], i);
    }

    // Empty finals placeholder to align columns
    html += '<div class="round-column finals-column empty"></div>';

    html += '</div></div>';

    // Add SVG for connector lines
    html += `<svg class="bracket-connectors" id="bracket-svg-${allianceCount}"></svg>`;

    html += '</div>';

    // Schedule connector drawing after DOM update
    setTimeout(() => this.drawConnectors(allianceCount, connectors), 0);

    return html;
  },

  // Draw SVG connector lines
  drawConnectors(allianceCount, connectors) {
    const svg = document.getElementById(`bracket-svg-${allianceCount}`);
    if (!svg) return;

    const container = svg.closest('.bracket-grid');
    if (!container) return;

    // Clear existing lines
    svg.innerHTML = '';

    // Set SVG size to match container
    const rect = container.getBoundingClientRect();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);

    for (const conn of connectors) {
      const fromBox = container.querySelector(`[data-match="${conn.from}"]`);
      const toBox = container.querySelector(`[data-match="${conn.to}"]`);

      if (!fromBox || !toBox) continue;

      // Get positions relative to container
      const containerRect = container.getBoundingClientRect();
      const fromRect = fromBox.getBoundingClientRect();
      const toRect = toBox.getBoundingClientRect();

      // Calculate connection points
      // From: right edge, center of match box
      const fromX = fromRect.right - containerRect.left;
      const fromY = fromRect.top - containerRect.top + fromRect.height / 2;

      // To: left edge, center of the specific slot (red = top third, blue = bottom third)
      const toX = toRect.left - containerRect.left;
      const slotOffset = conn.slot === "red" ? 0.33 : 0.67;
      const toY = toRect.top - containerRect.top + toRect.height * slotOffset;

      // Create path with right angles
      const midX = fromX + (toX - fromX) / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
      path.setAttribute('d', d);
      path.setAttribute('class', `connector-line connector-${conn.slot}`);
      path.setAttribute('fill', 'none');

      svg.appendChild(path);

      // Add arrow at the end
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const arrowSize = 6;
      const arrowPoints = `${toX},${toY} ${toX - arrowSize},${toY - arrowSize / 2} ${toX - arrowSize},${toY + arrowSize / 2}`;
      arrow.setAttribute('points', arrowPoints);
      arrow.setAttribute('class', `connector-arrow connector-${conn.slot}`);

      svg.appendChild(arrow);
    }
  },

  // 2-Alliance Bracket (Best of 3)
  render2AllianceBracket() {
    return `
      <div class="bracket-grid bracket-2">
        <div class="round-labels-row">
          <div class="round-label">Finals (Best of 3)</div>
        </div>
        <div class="rounds-container finals-only">
          <div class="round-column finals-round">
            <div class="match-wrapper">${this.renderMatchBox("M1")}</div>
            <div class="match-wrapper">${this.renderMatchBox("M2")}</div>
            <div class="match-wrapper">${this.renderMatchBox("M3")}</div>
          </div>
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

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
  }
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => BracketDisplay.init());

// Re-draw connectors on window resize
window.addEventListener("resize", () => {
  if (BracketDisplay.bracketState) {
    const allianceCount = BracketDisplay.bracketState.allianceCount;
    if (allianceCount && allianceCount > 2) {
      const connectors = BracketDisplay.generateConnectors(allianceCount);
      BracketDisplay.drawConnectors(allianceCount, connectors);
    }
  }
});

// Cleanup on unload
window.addEventListener("beforeunload", () => BracketDisplay.destroy());
