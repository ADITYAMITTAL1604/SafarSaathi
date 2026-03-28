// config/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBBOOIuVZRNR7yumU134Lko6gjrTjJ_W0I",
  authDomain: "safarsaathi-7a901.firebaseapp.com",
  projectId: "safarsaathi-7a901",
  storageBucket: "safarsaathi-7a901.firebasestorage.app",
  messagingSenderId: "400505399239",
  appId: "1:400505399239:web:2d4e0e81a657f5f5de1be2",
};

// Prevent re-initialization during Expo hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;