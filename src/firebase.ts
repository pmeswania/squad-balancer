import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Import configuration from the root configuration JSON file
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore using the configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
