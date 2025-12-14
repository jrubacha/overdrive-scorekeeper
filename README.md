# Overdrive Scorekeeper

A Progressive Web App (PWA) scoring system for the Overdrive robot competition. Features real-time score syncing via Firebase, offline support, and a clean tablet-friendly interface.

## Features

- **Scorer Interface**: Tablet-optimized scoring app for 4 scorers (Blue1, Blue2, Red1, Red2)
- **Live Scoreboard**: Real-time score display for projection
- **Admin Panel**: Team management, match scheduling, and data export
- **Offline Support**: Works without internet, syncs when connection resumes
- **PWA Installable**: Can be installed as an app on Android tablets

## Quick Start

### 1. Download/Clone the Project

```bash
git clone <repository-url>
cd overdrive-scorekeeper
```

### 2. Set Up Firebase (Required for real-time sync)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or select existing)
3. Name your project (e.g., "overdrive-scorekeeper")
4. Disable Google Analytics (not needed) and create

#### Enable Realtime Database:
1. In Firebase Console, click "Build" → "Realtime Database"
2. Click "Create Database"
3. Select a location close to you
4. Start in **test mode** (we'll secure it later)

#### Get Your Configuration:
1. Click the gear icon ⚙️ → "Project settings"
2. Scroll to "Your apps" and click the web icon `</>`
3. Register your app (name it anything, skip hosting)
4. Copy the `firebaseConfig` values

#### Update the App:
Edit `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 3. Host the App

The app needs to be served over HTTPS for PWA features to work. Options:

#### Option A: Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting  # Select your project, use "." as public directory
firebase deploy
```

#### Option B: GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages
3. Select source branch

#### Option C: Local Development
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```
Then open `http://localhost:8000`

### 4. Generate PWA Icons

The app needs icons for PWA installation. You can generate them from the included `icons/icon.svg`:

**Using an online tool:**
1. Go to [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Upload `icons/icon.svg`
3. Download and extract to the `icons/` folder

**Or create manually:** Generate PNG files at these sizes: 72, 96, 128, 144, 152, 192, 384, 512 pixels.

## Usage

### Setting Up Teams and Matches

1. Open the **Admin** page
2. Go to **Teams** tab and add all participating teams
3. Go to **Matches** tab and create your match schedule
4. Go to **Current Match** tab to select the active match

### Scoring a Match

1. Open the **Scorer** page on each tablet
2. Select your position (Blue1, Blue2, Red1, or Red2)
3. Select the current match
4. Verify the team assignment
5. Press "Start Scoring"
6. Use the tabs to switch between Autonomous, Teleop, and Penalties
7. Press "Finalize" when the match ends

### Displaying Scores

1. Open the **Scoreboard** page on the display computer
2. Select the match (or let it auto-sync with the current match)
3. Press F or click "Fullscreen" for presentation mode

## Scoring Rules

### Autonomous Period (30 seconds)

| Action | Points |
|--------|--------|
| Robot Crosses Lane Marker | 4 |
| Robot Crosses Opponent Finish Line | 4 |
| Robot Crosses Alliance Finish Line | 4 |
| Trackball Removed from Overpass | 8 |
| Trackball Crosses Alliance Finish (under) | 2 |
| Trackball Hurdles Overpass | 8 |

### Teleop Period (2 minutes)

| Action | Points |
|--------|--------|
| Robot Crosses Alliance Finish Line | 2 |
| Trackball Crosses Alliance Finish (under) | 2 |
| Trackball Hurdles Overpass | 8 |
| Trackball on Overpass (end of match) | 12 |

### Penalties

| Penalty | Effect |
|---------|--------|
| Foul | 3 points to opponent |
| Tech Foul | 10 points to opponent |

## Firebase Security Rules

For production use, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "teams": {
      ".indexOn": ["number"]
    },
    "matches": {
      ".indexOn": ["number"]
    }
  }
}
```

For more security (requires authentication setup):
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## Project Structure

```
overdrive-scorekeeper/
├── index.html          # Landing page
├── scorer.html         # Scoring interface
├── scoreboard.html     # Live scoreboard display
├── admin.html          # Admin/setup interface
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline support
├── css/
│   └── styles.css      # Shared styles
├── js/
│   ├── firebase-config.js  # Firebase configuration (edit this!)
│   ├── scoring-rules.js    # Game scoring rules (modify for other games)
│   ├── db.js               # Database operations
│   ├── scorer.js           # Scorer app logic
│   ├── scoreboard.js       # Scoreboard logic
│   └── admin.js            # Admin interface logic
└── icons/              # PWA icons
```

## Adapting for Different Games

The scoring rules are modular. To adapt for a different game:

1. Edit `js/scoring-rules.js`
2. Modify the `autonomous`, `teleop`, and `penalties` objects
3. Update point values, action names, and types (counter vs checkbox)
4. The UI will automatically regenerate based on the rules

## Offline Support

The app works offline after first load:
- All pages are cached by the service worker
- Score changes are queued and synced when online
- Local storage provides backup persistence

## Troubleshooting

**Scores not syncing:**
- Check Firebase configuration in `js/firebase-config.js`
- Verify database URL matches your Firebase project
- Check browser console for errors

**PWA not installing:**
- Must be served over HTTPS (or localhost)
- Icons must be present in `icons/` folder
- Check `manifest.json` is being loaded

**Scoreboard not updating:**
- Ensure all devices are using the same Firebase project
- Check the current match is set in Admin
- Verify scorers are sending to the correct match

## Development

No build process required! Edit files directly and refresh.

For testing:
1. Run a local server (`python -m http.server 8000`)
2. Open multiple browser tabs for different scorer positions
3. Use Admin to set up test teams/matches

## License

MIT License - Feel free to use and modify for your robotics competitions!
