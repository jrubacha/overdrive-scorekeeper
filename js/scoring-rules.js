// Scoring Rules Module
// ====================
// This module defines all scoring actions and their point values.
// To adapt for a different game, modify this file.

const ScoringRules = {
  // Game metadata
  gameName: "Overdrive",
  matchDuration: {
    autonomous: 30,  // seconds
    teleop: 120      // seconds
  },

  // Autonomous period scoring actions
  autonomous: {
    // Robot actions
    robotCrossesLane: {
      id: "auto_robot_lane",
      name: "Crosses Lane Marker",
      category: "Robot",
      points: 4,
      type: "counter",  // counter = +/- buttons, checkbox = binary
      maxCount: null    // null = unlimited
    },
    robotCrossesOpponentFinish: {
      id: "auto_robot_opp_finish",
      name: "Crosses Opponent Finish Line",
      category: "Robot",
      points: 4,
      type: "counter",
      maxCount: null
    },
    robotCrossesAllianceFinish: {
      id: "auto_robot_ally_finish",
      name: "Crosses Alliance Finish Line",
      category: "Robot",
      points: 4,
      type: "counter",
      maxCount: null
    },
    // Trackball actions
    trackballRemoved1: {
      id: "auto_ball_removed_1",
      name: "Trackball 1 Removed from Overpass",
      category: "Trackball",
      points: 8,
      type: "checkbox",
      maxCount: 1
    },
    trackballRemoved2: {
      id: "auto_ball_removed_2",
      name: "Trackball 2 Removed from Overpass",
      category: "Trackball",
      points: 8,
      type: "checkbox",
      maxCount: 1
    },
    trackballCrossesFinish: {
      id: "auto_ball_finish",
      name: "Crosses Alliance Finish (under)",
      category: "Trackball",
      points: 2,
      type: "counter",
      maxCount: null
    },
    trackballHurdles: {
      id: "auto_ball_hurdle",
      name: "Hurdles Overpass",
      category: "Trackball",
      points: 8,
      type: "counter",
      maxCount: null
    }
  },

  // Teleop period scoring actions
  teleop: {
    // Robot actions
    robotCrossesFinish: {
      id: "tele_robot_finish",
      name: "Crosses Alliance Finish Line",
      category: "Robot",
      points: 2,
      type: "counter",
      maxCount: null
    },
    // Trackball actions
    trackballCrossesFinish: {
      id: "tele_ball_finish",
      name: "Crosses Alliance Finish (under)",
      category: "Trackball",
      points: 2,
      type: "counter",
      maxCount: null
    },
    trackballHurdles: {
      id: "tele_ball_hurdle",
      name: "Hurdles Overpass",
      category: "Trackball",
      points: 8,
      type: "counter",
      maxCount: null
    },
    trackballOnOverpass: {
      id: "tele_ball_on_overpass",
      name: "Trackball on Overpass (end)",
      category: "Trackball",
      points: 12,
      type: "checkbox",
      maxCount: 1
    }
  },

  // Penalties (points awarded to OPPONENT)
  penalties: {
    foul: {
      id: "penalty_foul",
      name: "Foul",
      points: 3,
      type: "counter",
      description: "3 points to opponent"
    },
    techFoul: {
      id: "penalty_tech",
      name: "Tech Foul",
      points: 10,
      type: "counter",
      description: "10 points to opponent"
    }
  },

  // Calculate score for a single robot's actions
  calculateRobotScore(actions) {
    let score = 0;

    // Autonomous scoring
    for (const [key, rule] of Object.entries(this.autonomous)) {
      const count = actions[rule.id] || 0;
      score += count * rule.points;
    }

    // Teleop scoring
    for (const [key, rule] of Object.entries(this.teleop)) {
      const count = actions[rule.id] || 0;
      score += count * rule.points;
    }

    return score;
  },

  // Calculate penalties given BY this robot (points go to opponent)
  calculatePenalties(actions) {
    let penaltyPoints = 0;

    for (const [key, rule] of Object.entries(this.penalties)) {
      const count = actions[rule.id] || 0;
      penaltyPoints += count * rule.points;
    }

    return penaltyPoints;
  },

  // Calculate alliance total score
  calculateAllianceScore(robot1Actions, robot2Actions, opponentPenalties1, opponentPenalties2) {
    const baseScore = this.calculateRobotScore(robot1Actions) + this.calculateRobotScore(robot2Actions);
    const penaltyBonus = this.calculatePenalties(opponentPenalties1) + this.calculatePenalties(opponentPenalties2);
    return baseScore + penaltyBonus;
  },

  // Get all scoring actions as a flat array (useful for UI generation)
  getAllActions() {
    const actions = [];

    // Autonomous
    for (const [key, rule] of Object.entries(this.autonomous)) {
      actions.push({ ...rule, period: "autonomous" });
    }

    // Teleop
    for (const [key, rule] of Object.entries(this.teleop)) {
      actions.push({ ...rule, period: "teleop" });
    }

    // Penalties
    for (const [key, rule] of Object.entries(this.penalties)) {
      actions.push({ ...rule, period: "penalties", category: "Penalty" });
    }

    return actions;
  },

  // Get empty actions object (for initialization)
  getEmptyActions() {
    const actions = {};

    for (const rule of this.getAllActions()) {
      actions[rule.id] = 0;
    }

    return actions;
  }
};

// Export for use in other modules
window.ScoringRules = ScoringRules;
