// Database Operations Module
// ==========================
// Handles all Firebase operations with offline support

const DB = {
  db: null,
  isOnline: navigator.onLine,
  pendingWrites: [],
  listeners: new Map(),

  // Initialize database connection
  async init() {
    await FirebaseConfig.init();
    this.db = FirebaseConfig.getDb();

    // Monitor online/offline status
    window.addEventListener("online", () => this.handleOnline());
    window.addEventListener("offline", () => this.handleOffline());

    // Load any pending writes from localStorage
    this.loadPendingWrites();

    // If we're online and have pending writes, sync them
    if (this.isOnline && this.pendingWrites.length > 0) {
      this.syncPendingWrites();
    }

    return this.db;
  },

  handleOnline() {
    console.log("Connection restored");
    this.isOnline = true;
    this.syncPendingWrites();
    this.dispatchEvent("connectionChange", { online: true });
  },

  handleOffline() {
    console.log("Connection lost - working offline");
    this.isOnline = false;
    this.dispatchEvent("connectionChange", { online: false });
  },

  // Event system for UI updates
  dispatchEvent(type, data) {
    const event = new CustomEvent(`db:${type}`, { detail: data });
    window.dispatchEvent(event);
  },

  // Pending writes management (for offline support)
  loadPendingWrites() {
    try {
      const stored = localStorage.getItem("overdrive_pending_writes");
      this.pendingWrites = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.pendingWrites = [];
    }
  },

  savePendingWrites() {
    localStorage.setItem("overdrive_pending_writes", JSON.stringify(this.pendingWrites));
  },

  addPendingWrite(path, data) {
    this.pendingWrites.push({
      path,
      data,
      timestamp: Date.now()
    });
    this.savePendingWrites();
  },

  async syncPendingWrites() {
    if (!this.db || this.pendingWrites.length === 0) return;

    console.log(`Syncing ${this.pendingWrites.length} pending writes...`);

    const writes = [...this.pendingWrites];
    this.pendingWrites = [];
    this.savePendingWrites();

    for (const write of writes) {
      try {
        await this.db.ref(write.path).set(write.data);
        console.log(`Synced: ${write.path}`);
      } catch (error) {
        console.error(`Failed to sync ${write.path}:`, error);
        // Re-add failed writes
        this.pendingWrites.push(write);
      }
    }

    this.savePendingWrites();
    this.dispatchEvent("syncComplete", { remaining: this.pendingWrites.length });
  },

  // Generic write with offline support
  async write(path, data) {
    // Always update local cache
    this.updateLocalCache(path, data);

    if (!this.db) {
      // Firebase not configured - save locally only
      this.addPendingWrite(path, data);
      return;
    }

    if (!this.isOnline) {
      this.addPendingWrite(path, data);
      return;
    }

    try {
      await this.db.ref(path).set(data);
    } catch (error) {
      console.error("Write failed, queuing for later:", error);
      this.addPendingWrite(path, data);
    }
  },

  // Update a specific field
  async update(path, updates) {
    if (!this.db) {
      console.warn("Firebase not configured");
      return;
    }

    if (!this.isOnline) {
      // For updates, we need to merge with existing pending writes
      // For simplicity, convert to a full write
      const current = this.getFromLocalCache(path) || {};
      const merged = { ...current, ...updates };
      this.addPendingWrite(path, merged);
      return;
    }

    try {
      await this.db.ref(path).update(updates);
    } catch (error) {
      console.error("Update failed:", error);
    }
  },

  // Read data once
  async read(path) {
    if (!this.db) {
      return this.getFromLocalCache(path);
    }

    try {
      const snapshot = await this.db.ref(path).once("value");
      const data = snapshot.val();
      this.updateLocalCache(path, data);
      return data;
    } catch (error) {
      console.error("Read failed, using cache:", error);
      return this.getFromLocalCache(path);
    }
  },

  // Subscribe to real-time updates
  subscribe(path, callback) {
    const wrappedCallback = (snapshot) => {
      const data = snapshot.val();
      this.updateLocalCache(path, data);
      callback(data);
    };

    if (this.db) {
      this.db.ref(path).on("value", wrappedCallback);
      this.listeners.set(path, wrappedCallback);
    } else {
      // No Firebase - return cached data once
      const cached = this.getFromLocalCache(path);
      if (cached) callback(cached);
    }

    // Return unsubscribe function
    return () => {
      if (this.db && this.listeners.has(path)) {
        this.db.ref(path).off("value", this.listeners.get(path));
        this.listeners.delete(path);
      }
    };
  },

  // Local cache operations
  updateLocalCache(path, data) {
    try {
      const cache = JSON.parse(localStorage.getItem("overdrive_cache") || "{}");
      cache[path] = { data, timestamp: Date.now() };
      localStorage.setItem("overdrive_cache", JSON.stringify(cache));
    } catch (e) {
      console.warn("Cache update failed:", e);
    }
  },

  getFromLocalCache(path) {
    try {
      const cache = JSON.parse(localStorage.getItem("overdrive_cache") || "{}");
      return cache[path]?.data || null;
    } catch (e) {
      return null;
    }
  },

  // Clear all local data
  clearLocalData() {
    localStorage.removeItem("overdrive_cache");
    localStorage.removeItem("overdrive_pending_writes");
    this.pendingWrites = [];
  },

  // ============================================
  // Application-specific database operations
  // ============================================

  // Teams
  async getTeams() {
    return (await this.read("teams")) || {};
  },

  async saveTeam(teamId, teamData) {
    await this.write(`teams/${teamId}`, teamData);
  },

  async deleteTeam(teamId) {
    if (this.db) {
      await this.db.ref(`teams/${teamId}`).remove();
    }
    // Update local cache
    const teams = await this.getTeams();
    delete teams[teamId];
    this.updateLocalCache("teams", teams);
  },

  subscribeToTeams(callback) {
    return this.subscribe("teams", callback);
  },

  // Matches
  async getMatches() {
    return (await this.read("matches")) || {};
  },

  async saveMatch(matchId, matchData) {
    await this.write(`matches/${matchId}`, matchData);
  },

  async deleteMatch(matchId) {
    if (this.db) {
      await this.db.ref(`matches/${matchId}`).remove();
    }
  },

  subscribeToMatches(callback) {
    return this.subscribe("matches", callback);
  },

  // Current match (the active match being played)
  async getCurrentMatch() {
    return await this.read("currentMatch");
  },

  async setCurrentMatch(matchId) {
    await this.write("currentMatch", matchId);
  },

  subscribeToCurrentMatch(callback) {
    return this.subscribe("currentMatch", callback);
  },

  // Scoring data
  async getMatchScores(matchId) {
    return (await this.read(`scores/${matchId}`)) || {};
  },

  async saveRobotScore(matchId, position, actions) {
    await this.write(`scores/${matchId}/${position}`, {
      actions,
      lastUpdated: Date.now()
    });
  },

  subscribeToMatchScores(matchId, callback) {
    return this.subscribe(`scores/${matchId}`, callback);
  },

  // Match state (autonomous/teleop/finished)
  async getMatchState(matchId) {
    return await this.read(`matchState/${matchId}`);
  },

  async setMatchState(matchId, state) {
    await this.write(`matchState/${matchId}`, {
      ...state,
      timestamp: Date.now()
    });
  },

  subscribeToMatchState(matchId, callback) {
    return this.subscribe(`matchState/${matchId}`, callback);
  },

  // ============================================
  // Playoff Bracket Operations
  // ============================================

  // Playoff settings (alliance mode, etc.)
  async getPlayoffSettings() {
    return (await this.read("playoffSettings")) || {
      allianceMode: "2-team",
      status: "setup" // setup, alliance_selection, bracket_ready, in_progress, complete
    };
  },

  async savePlayoffSettings(settings) {
    await this.write("playoffSettings", settings);
  },

  subscribeToPlayoffSettings(callback) {
    return this.subscribe("playoffSettings", callback);
  },

  // Alliances (for 2-team mode, stores captain + pick)
  async getAlliances() {
    return (await this.read("alliances")) || {};
  },

  async saveAlliance(allianceNumber, allianceData) {
    await this.write(`alliances/${allianceNumber}`, allianceData);
  },

  async saveAllAlliances(alliances) {
    await this.write("alliances", alliances);
  },

  async clearAlliances() {
    if (this.db) {
      await this.db.ref("alliances").remove();
    }
    this.updateLocalCache("alliances", {});
  },

  subscribeToAlliances(callback) {
    return this.subscribe("alliances", callback);
  },

  // Bracket state (matches, results, advancement)
  async getBracket() {
    return await this.read("bracket");
  },

  async saveBracket(bracketState) {
    await this.write("bracket", bracketState);
  },

  async updateBracketMatch(matchId, matchData) {
    await this.update(`bracket/matches/${matchId}`, matchData);
  },

  async setBracketStatus(status) {
    await this.update("bracket", { status });
  },

  async setBracketChampion(allianceNumber) {
    await this.update("bracket", { champion: allianceNumber, status: "complete" });
  },

  subscribeToBracket(callback) {
    return this.subscribe("bracket", callback);
  },

  // Clear all playoff data (for reset)
  async clearPlayoffData() {
    if (this.db) {
      await this.db.ref("playoffSettings").remove();
      await this.db.ref("alliances").remove();
      await this.db.ref("bracket").remove();
    }
    this.updateLocalCache("playoffSettings", null);
    this.updateLocalCache("alliances", null);
    this.updateLocalCache("bracket", null);
  }
};

// Export for use in other modules
window.DB = DB;
