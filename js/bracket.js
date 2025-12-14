// Double Elimination Bracket System
// ==================================

const Bracket = {
  // Bracket templates define match structure, seeding, and advancement paths
  // Each template has matches keyed by match ID (M1, M2, etc.)
  //
  // Match structure:
  // - red/blue: alliance seed number that starts in that slot (or null if TBD)
  // - round: which round this match is in
  // - bracket: "upper", "lower", or "finals"
  // - redFrom/blueFrom: where the alliance comes from if not seeded
  //   - { match: "M1", result: "winner" } or { match: "M1", result: "loser" }
  // - winnerTo/loserTo: where winner/loser advances to
  //   - { match: "M4", slot: "red" } or null if eliminated/champion

  templates: {
    // 2-Alliance Bracket (Best of 3 Finals)
    2: {
      totalMatches: 3,
      rounds: ["Finals"],
      matches: {
        M1: {
          red: 1, blue: 2,
          round: "Finals", bracket: "finals",
          winnerTo: null, // Winner needs 2 wins
          loserTo: null,  // Loser needs to win 2 to force M3
          description: "Finals 1"
        },
        M2: {
          red: 1, blue: 2,
          round: "Finals", bracket: "finals",
          redFrom: null, blueFrom: null, // Same teams
          winnerTo: null,
          loserTo: null,
          description: "Finals 2"
        },
        M3: {
          red: 1, blue: 2,
          round: "Finals", bracket: "finals",
          redFrom: null, blueFrom: null,
          winnerTo: null,
          loserTo: null,
          description: "Finals 3 (if needed)",
          conditional: true
        }
      },
      // Special handler for best-of-3
      isBestOf3: true
    },

    // 4-Alliance Bracket
    4: {
      totalMatches: 7,
      rounds: ["Round 1", "Round 2", "Round 3", "Finals"],
      matches: {
        // Upper Bracket Round 1
        M1: {
          red: 1, blue: 4,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M4", slot: "red" },
          loserTo: { match: "M3", slot: "red" },
          description: "Upper R1"
        },
        M2: {
          red: 2, blue: 3,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M4", slot: "blue" },
          loserTo: { match: "M3", slot: "blue" },
          description: "Upper R1"
        },
        // Lower Bracket Round 2
        M3: {
          red: null, blue: null,
          round: "Round 2", bracket: "lower",
          redFrom: { match: "M1", result: "loser" },
          blueFrom: { match: "M2", result: "loser" },
          winnerTo: { match: "M5", slot: "blue" },
          loserTo: null, // Eliminated (4th place)
          description: "Lower R2",
          eliminationPlace: 4
        },
        // Upper Bracket Round 2
        M4: {
          red: null, blue: null,
          round: "Round 2", bracket: "upper",
          redFrom: { match: "M1", result: "winner" },
          blueFrom: { match: "M2", result: "winner" },
          winnerTo: { match: "M6", slot: "red" },
          loserTo: { match: "M5", slot: "red" },
          description: "Upper Final"
        },
        // Lower Bracket Round 3
        M5: {
          red: null, blue: null,
          round: "Round 3", bracket: "lower",
          redFrom: { match: "M4", result: "loser" },
          blueFrom: { match: "M3", result: "winner" },
          winnerTo: { match: "M6", slot: "blue" },
          loserTo: null, // Eliminated (3rd place)
          description: "Lower Final",
          eliminationPlace: 3
        },
        // Finals
        M6: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M4", result: "winner" },
          blueFrom: { match: "M5", result: "winner" },
          winnerTo: null, // Check if M7 needed
          loserTo: null,
          description: "Finals 1"
        },
        M7: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M6", result: "red" }, // Same teams
          blueFrom: { match: "M6", result: "blue" },
          winnerTo: null,
          loserTo: null,
          description: "Finals 2 (if needed)",
          conditional: true
        }
      }
    },

    // 6-Alliance Bracket
    6: {
      totalMatches: 11,
      rounds: ["Round 1", "Round 2", "Round 3", "Round 4", "Finals"],
      matches: {
        // Upper Bracket Round 1 (only 4 & 5, and 3 & 6 play; 1 & 2 have byes)
        M1: {
          red: 4, blue: 5,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M3", slot: "blue" },
          loserTo: { match: "M6", slot: "blue" },
          description: "Upper R1"
        },
        M2: {
          red: 3, blue: 6,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M4", slot: "blue" },
          loserTo: { match: "M5", slot: "blue" },
          description: "Upper R1"
        },
        // Upper Bracket Round 2
        M3: {
          red: 1, blue: null,
          round: "Round 2", bracket: "upper",
          blueFrom: { match: "M1", result: "winner" },
          winnerTo: { match: "M7", slot: "red" },
          loserTo: { match: "M5", slot: "red" },
          description: "Upper R2"
        },
        M4: {
          red: 2, blue: null,
          round: "Round 2", bracket: "upper",
          blueFrom: { match: "M2", result: "winner" },
          winnerTo: { match: "M7", slot: "blue" },
          loserTo: { match: "M6", slot: "red" },
          description: "Upper R2"
        },
        // Lower Bracket Round 2
        M5: {
          red: null, blue: null,
          round: "Round 2", bracket: "lower",
          redFrom: { match: "M3", result: "loser" },
          blueFrom: { match: "M2", result: "loser" },
          winnerTo: { match: "M8", slot: "blue" },
          loserTo: null, // Tied 5th
          description: "Lower R2",
          eliminationPlace: 5
        },
        M6: {
          red: null, blue: null,
          round: "Round 2", bracket: "lower",
          redFrom: { match: "M4", result: "loser" },
          blueFrom: { match: "M1", result: "loser" },
          winnerTo: { match: "M8", slot: "red" },
          loserTo: null, // Tied 5th
          description: "Lower R2",
          eliminationPlace: 5
        },
        // Upper Bracket Round 3
        M7: {
          red: null, blue: null,
          round: "Round 3", bracket: "upper",
          redFrom: { match: "M3", result: "winner" },
          blueFrom: { match: "M4", result: "winner" },
          winnerTo: { match: "M10", slot: "red" },
          loserTo: { match: "M9", slot: "red" },
          description: "Upper Final"
        },
        // Lower Bracket Round 3
        M8: {
          red: null, blue: null,
          round: "Round 3", bracket: "lower",
          redFrom: { match: "M6", result: "winner" },
          blueFrom: { match: "M5", result: "winner" },
          winnerTo: { match: "M9", slot: "blue" },
          loserTo: null, // 4th place
          description: "Lower R3",
          eliminationPlace: 4
        },
        // Lower Bracket Round 4
        M9: {
          red: null, blue: null,
          round: "Round 4", bracket: "lower",
          redFrom: { match: "M7", result: "loser" },
          blueFrom: { match: "M8", result: "winner" },
          winnerTo: { match: "M10", slot: "blue" },
          loserTo: null, // 3rd place
          description: "Lower Final",
          eliminationPlace: 3
        },
        // Finals
        M10: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M7", result: "winner" },
          blueFrom: { match: "M9", result: "winner" },
          winnerTo: null,
          loserTo: null,
          description: "Finals 1"
        },
        M11: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M10", result: "red" },
          blueFrom: { match: "M10", result: "blue" },
          winnerTo: null,
          loserTo: null,
          description: "Finals 2 (if needed)",
          conditional: true
        }
      }
    },

    // 8-Alliance Bracket
    8: {
      totalMatches: 15,
      rounds: ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Finals"],
      matches: {
        // Upper Bracket Round 1
        M1: {
          red: 1, blue: 8,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M7", slot: "red" },
          loserTo: { match: "M5", slot: "red" },
          description: "Upper R1"
        },
        M2: {
          red: 4, blue: 5,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M7", slot: "blue" },
          loserTo: { match: "M5", slot: "blue" },
          description: "Upper R1"
        },
        M3: {
          red: 2, blue: 7,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M8", slot: "red" },
          loserTo: { match: "M6", slot: "red" },
          description: "Upper R1"
        },
        M4: {
          red: 3, blue: 6,
          round: "Round 1", bracket: "upper",
          winnerTo: { match: "M8", slot: "blue" },
          loserTo: { match: "M6", slot: "blue" },
          description: "Upper R1"
        },
        // Lower Bracket Round 2
        M5: {
          red: null, blue: null,
          round: "Round 2", bracket: "lower",
          redFrom: { match: "M1", result: "loser" },
          blueFrom: { match: "M2", result: "loser" },
          winnerTo: { match: "M10", slot: "blue" },
          loserTo: null, // Tied 7th
          description: "Lower R2",
          eliminationPlace: 7
        },
        M6: {
          red: null, blue: null,
          round: "Round 2", bracket: "lower",
          redFrom: { match: "M3", result: "loser" },
          blueFrom: { match: "M4", result: "loser" },
          winnerTo: { match: "M9", slot: "blue" },
          loserTo: null, // Tied 7th
          description: "Lower R2",
          eliminationPlace: 7
        },
        // Upper Bracket Round 2
        M7: {
          red: null, blue: null,
          round: "Round 2", bracket: "upper",
          redFrom: { match: "M1", result: "winner" },
          blueFrom: { match: "M2", result: "winner" },
          winnerTo: { match: "M11", slot: "red" },
          loserTo: { match: "M9", slot: "red" },
          description: "Upper R2"
        },
        M8: {
          red: null, blue: null,
          round: "Round 2", bracket: "upper",
          redFrom: { match: "M3", result: "winner" },
          blueFrom: { match: "M4", result: "winner" },
          winnerTo: { match: "M11", slot: "blue" },
          loserTo: { match: "M10", slot: "red" },
          description: "Upper R2"
        },
        // Lower Bracket Round 3
        M9: {
          red: null, blue: null,
          round: "Round 3", bracket: "lower",
          redFrom: { match: "M7", result: "loser" },
          blueFrom: { match: "M6", result: "winner" },
          winnerTo: { match: "M12", slot: "blue" },
          loserTo: null, // Tied 5th
          description: "Lower R3",
          eliminationPlace: 5
        },
        M10: {
          red: null, blue: null,
          round: "Round 3", bracket: "lower",
          redFrom: { match: "M8", result: "loser" },
          blueFrom: { match: "M5", result: "winner" },
          winnerTo: { match: "M12", slot: "red" },
          loserTo: null, // Tied 5th
          description: "Lower R3",
          eliminationPlace: 5
        },
        // Upper Bracket Round 4
        M11: {
          red: null, blue: null,
          round: "Round 4", bracket: "upper",
          redFrom: { match: "M7", result: "winner" },
          blueFrom: { match: "M8", result: "winner" },
          winnerTo: { match: "M14", slot: "red" },
          loserTo: { match: "M13", slot: "red" },
          description: "Upper Final"
        },
        // Lower Bracket Round 4
        M12: {
          red: null, blue: null,
          round: "Round 4", bracket: "lower",
          redFrom: { match: "M10", result: "winner" },
          blueFrom: { match: "M9", result: "winner" },
          winnerTo: { match: "M13", slot: "blue" },
          loserTo: null, // 4th place
          description: "Lower R4",
          eliminationPlace: 4
        },
        // Lower Bracket Round 5
        M13: {
          red: null, blue: null,
          round: "Round 5", bracket: "lower",
          redFrom: { match: "M11", result: "loser" },
          blueFrom: { match: "M12", result: "winner" },
          winnerTo: { match: "M14", slot: "blue" },
          loserTo: null, // 3rd place
          description: "Lower Final",
          eliminationPlace: 3
        },
        // Finals
        M14: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M11", result: "winner" },
          blueFrom: { match: "M13", result: "winner" },
          winnerTo: null,
          loserTo: null,
          description: "Finals 1"
        },
        M15: {
          red: null, blue: null,
          round: "Finals", bracket: "finals",
          redFrom: { match: "M14", result: "red" },
          blueFrom: { match: "M14", result: "blue" },
          winnerTo: null,
          loserTo: null,
          description: "Finals 2 (if needed)",
          conditional: true
        }
      }
    }
  },

  // Determine number of alliances based on team count and alliance mode
  getAllianceCount(teamCount, allianceMode) {
    if (allianceMode === "1-team") {
      // 1-team alliances (only for 20 or fewer teams)
      if (teamCount <= 10) return 4;
      if (teamCount <= 20) return 8;
      return null; // Not allowed for 21+ teams
    } else {
      // 2-team alliances (standard)
      if (teamCount <= 10) return 2;
      if (teamCount <= 20) return 4;
      if (teamCount <= 40) return 6;
      if (teamCount <= 64) return 8;
      return 8; // Max out at 8
    }
  },

  // Check if 1-team alliance mode is allowed
  canUse1TeamMode(teamCount) {
    return teamCount <= 20;
  },

  // Generate initial bracket state from template
  generateBracket(allianceCount, alliances) {
    const template = this.templates[allianceCount];
    if (!template) {
      throw new Error(`No template for ${allianceCount} alliances`);
    }

    const bracketState = {
      allianceCount,
      alliances: { ...alliances },
      matches: {},
      status: "in_progress",
      champion: null
    };

    // Initialize matches from template
    for (const [matchId, matchTemplate] of Object.entries(template.matches)) {
      bracketState.matches[matchId] = {
        id: matchId,
        red: matchTemplate.red, // Alliance number or null
        blue: matchTemplate.blue,
        redFrom: matchTemplate.redFrom || null,
        blueFrom: matchTemplate.blueFrom || null,
        winnerTo: matchTemplate.winnerTo,
        loserTo: matchTemplate.loserTo,
        round: matchTemplate.round,
        bracket: matchTemplate.bracket,
        description: matchTemplate.description,
        conditional: matchTemplate.conditional || false,
        eliminationPlace: matchTemplate.eliminationPlace || null,
        winner: null, // "red" or "blue" when decided
        played: false,
        scoreMatchId: null // Link to actual match in matches collection
      };
    }

    return bracketState;
  },

  // Record match result and advance teams
  recordResult(bracketState, matchId, winner) {
    const match = bracketState.matches[matchId];
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    match.winner = winner;
    match.played = true;

    const winningAlliance = winner === "red" ? match.red : match.blue;
    const losingAlliance = winner === "red" ? match.blue : match.red;

    // Handle 2-alliance best-of-3 separately
    if (bracketState.allianceCount === 2) {
      return this.handleBestOf3Result(bracketState, matchId, winner);
    }

    // Advance winner
    if (match.winnerTo) {
      const nextMatch = bracketState.matches[match.winnerTo.match];
      if (nextMatch) {
        nextMatch[match.winnerTo.slot] = winningAlliance;
      }
    }

    // Advance loser (to lower bracket) or eliminate
    if (match.loserTo) {
      const nextMatch = bracketState.matches[match.loserTo.match];
      if (nextMatch) {
        nextMatch[match.loserTo.slot] = losingAlliance;
      }
    }

    // Check for finals scenarios
    if (match.bracket === "finals" && !match.conditional) {
      // This is Finals 1
      if (winner === "red") {
        // Upper bracket team (red) wins - they're the champion
        bracketState.champion = winningAlliance;
        bracketState.status = "complete";
      } else {
        // Lower bracket team (blue) wins - need Finals 2
        // The conditional Finals 2 match should already have the teams set via template
        const finals2Match = this.getFinals2Match(bracketState);
        if (finals2Match) {
          finals2Match.red = match.red;
          finals2Match.blue = match.blue;
        }
      }
    } else if (match.conditional && match.bracket === "finals") {
      // This is Finals 2 (or 3 for best-of-3)
      bracketState.champion = winningAlliance;
      bracketState.status = "complete";
    }

    return bracketState;
  },

  // Handle best-of-3 finals for 2-alliance bracket
  handleBestOf3Result(bracketState, matchId, winner) {
    const matches = bracketState.matches;

    // Count wins for each alliance
    let alliance1Wins = 0;
    let alliance2Wins = 0;

    for (const m of Object.values(matches)) {
      if (m.played) {
        if (m.winner === "red") alliance1Wins++;
        else if (m.winner === "blue") alliance2Wins++;
      }
    }

    // Check for champion (first to 2 wins)
    if (alliance1Wins >= 2) {
      bracketState.champion = 1;
      bracketState.status = "complete";
    } else if (alliance2Wins >= 2) {
      bracketState.champion = 2;
      bracketState.status = "complete";
    }

    return bracketState;
  },

  // Get the Finals 2 match (the conditional one)
  getFinals2Match(bracketState) {
    for (const match of Object.values(bracketState.matches)) {
      if (match.bracket === "finals" && match.conditional) {
        return match;
      }
    }
    return null;
  },

  // Check if a match is ready to be played (both alliances known)
  isMatchReady(bracketState, matchId) {
    const match = bracketState.matches[matchId];
    if (!match) return false;
    if (match.played) return false;
    if (match.conditional) {
      // Conditional matches need special logic
      return this.isConditionalMatchNeeded(bracketState, matchId);
    }
    return match.red !== null && match.blue !== null;
  },

  // Check if a conditional match (Finals 2/3) is needed
  isConditionalMatchNeeded(bracketState, matchId) {
    const match = bracketState.matches[matchId];
    if (!match || !match.conditional) return false;

    if (bracketState.allianceCount === 2) {
      // Best of 3: need match if no one has 2 wins yet
      let alliance1Wins = 0;
      let alliance2Wins = 0;
      for (const m of Object.values(bracketState.matches)) {
        if (m.played && !m.conditional) {
          if (m.winner === "red") alliance1Wins++;
          else if (m.winner === "blue") alliance2Wins++;
        }
      }
      const playedNonConditional = alliance1Wins + alliance2Wins;
      if (matchId === "M2") {
        return playedNonConditional >= 1 && alliance1Wins < 2 && alliance2Wins < 2;
      }
      if (matchId === "M3") {
        return playedNonConditional >= 2 && alliance1Wins < 2 && alliance2Wins < 2;
      }
    } else {
      // Standard double elim: Finals 2 needed if lower bracket team won Finals 1
      const finals1 = this.getFinals1Match(bracketState);
      if (finals1 && finals1.played && finals1.winner === "blue") {
        return true;
      }
    }
    return false;
  },

  // Get Finals 1 match
  getFinals1Match(bracketState) {
    for (const match of Object.values(bracketState.matches)) {
      if (match.bracket === "finals" && !match.conditional) {
        return match;
      }
    }
    return null;
  },

  // Get all matches that are ready to play
  getReadyMatches(bracketState) {
    const ready = [];
    for (const matchId of Object.keys(bracketState.matches)) {
      if (this.isMatchReady(bracketState, matchId)) {
        ready.push(matchId);
      }
    }
    // Sort by match number
    return ready.sort((a, b) => {
      const numA = parseInt(a.substring(1));
      const numB = parseInt(b.substring(1));
      return numA - numB;
    });
  },

  // Get next match to play (first ready match)
  getNextMatch(bracketState) {
    const ready = this.getReadyMatches(bracketState);
    return ready.length > 0 ? ready[0] : null;
  },

  // Get match display info with alliance names
  getMatchDisplayInfo(bracketState, matchId) {
    const match = bracketState.matches[matchId];
    if (!match) return null;

    const getAllianceDisplay = (allianceNum) => {
      if (allianceNum === null) return { number: null, display: "TBD" };
      const alliance = bracketState.alliances[allianceNum];
      if (!alliance) return { number: allianceNum, display: `Alliance ${allianceNum}` };
      return {
        number: allianceNum,
        display: `Alliance ${allianceNum}`,
        teams: alliance.teams
      };
    };

    return {
      id: matchId,
      red: getAllianceDisplay(match.red),
      blue: getAllianceDisplay(match.blue),
      round: match.round,
      bracket: match.bracket,
      description: match.description,
      winner: match.winner,
      played: match.played,
      ready: this.isMatchReady(bracketState, matchId),
      conditional: match.conditional,
      needed: !match.conditional || this.isConditionalMatchNeeded(bracketState, matchId)
    };
  },

  // Get final standings
  getStandings(bracketState) {
    if (bracketState.status !== "complete") {
      return null;
    }

    const standings = [];

    // Champion
    standings.push({
      place: 1,
      alliance: bracketState.champion,
      teams: bracketState.alliances[bracketState.champion]?.teams || []
    });

    // Finalist (loser of finals)
    const finals1 = this.getFinals1Match(bracketState);
    if (finals1) {
      const finalist = finals1.winner === "red" ? finals1.blue : finals1.red;
      // Check if finals 2 was played
      const finals2 = this.getFinals2Match(bracketState);
      if (finals2 && finals2.played) {
        const actualFinalist = finals2.winner === "red" ? finals2.blue : finals2.red;
        standings.push({
          place: 2,
          alliance: actualFinalist,
          teams: bracketState.alliances[actualFinalist]?.teams || []
        });
      } else {
        standings.push({
          place: 2,
          alliance: finalist,
          teams: bracketState.alliances[finalist]?.teams || []
        });
      }
    }

    // Find eliminated teams by place
    for (const match of Object.values(bracketState.matches)) {
      if (match.played && match.eliminationPlace) {
        const eliminated = match.winner === "red" ? match.blue : match.red;
        standings.push({
          place: match.eliminationPlace,
          alliance: eliminated,
          teams: bracketState.alliances[eliminated]?.teams || []
        });
      }
    }

    // Sort by place
    standings.sort((a, b) => a.place - b.place);

    return standings;
  }
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = Bracket;
}
