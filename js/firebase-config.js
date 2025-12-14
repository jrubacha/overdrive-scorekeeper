// Firebase Configuration
// ======================
// INSTRUCTIONS: Replace the placeholder values below with your Firebase project credentials.
//
// To get these values:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or select existing)
// 3. Click the gear icon > Project settings
// 4. Scroll down to "Your apps" and click the web icon (</>)
// 5. Register your app and copy the config object values below

const firebaseConfig = {
  apiKey: "AIzaSyC8KZy0W2ZXYYtdY9TdW2wzKD6A4IQt62w",
  authDomain: "overdrivescorekeeper.firebaseapp.com",
  databaseURL: "https://overdrivescorekeeper-default-rtdb.firebaseio.com",
  projectId: "overdrivescorekeeper",
  storageBucket: "overdrivescorekeeper.firebasestorage.app",
  messagingSenderId: "216409795272",
  appId: "1:216409795272:web:c897f6073ca90bfcf413fd"
};

// Initialize Firebase
let db = null;
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    try {
      // Check if config has been set up
      if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
        console.warn("Firebase not configured. Running in offline/demo mode.");
        firebaseInitialized = true;
        resolve(null);
        return;
      }

      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseInitialized = true;

      // Enable offline persistence
      db.goOnline();

      console.log("Firebase initialized successfully");
      resolve(db);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      reject(error);
    }
  });
}

// Check if Firebase is configured
function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
}

// Export for use in other modules
window.FirebaseConfig = {
  init: initializeFirebase,
  getDb: () => db,
  isConfigured: isFirebaseConfigured,
  config: firebaseConfig
};
