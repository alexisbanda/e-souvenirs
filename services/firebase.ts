import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDwssTgOYbfgjiFvvkvNubstBwXD541y2o",
    authDomain: "e-souvenirs-b2270.firebaseapp.com",
    projectId: "e-souvenirs-b2270",
    storageBucket: "e-souvenirs-b2270.firebasestorage.app",
    messagingSenderId: "238881643233",
    appId: "1:238881643233:web:06319f8184bf6b5bd475a0",
    measurementId: "G-J0LCSD1PRN"
  };

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Export the Firestore database instance
export const db = getFirestore(app);