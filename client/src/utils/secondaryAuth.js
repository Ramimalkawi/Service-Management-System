// src/utils/secondaryAuth.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// Same Firebase config but for secondary authentication
const firebaseConfig = {
  apiKey: "AIzaSyCWSayCLeyr_6aBSNjb4nCY--Lw-DB_4S4",
  authDomain: "solutionssystemmain.firebaseapp.com",
  projectId: "solutionssystemmain",
  storageBucket: "solutionssystemmain.appspot.com",
  messagingSenderId: "961697855820",
  appId: "1:961697855820:web:a83ed62b1fdacee11f77e9",
};

// Create a secondary Firebase app instance
const secondaryApp = initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);

// Function to create user without affecting main session
export const createUserWithoutSessionConflict = async (email, password) => {
  try {
    // Create user with secondary auth instance
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );

    // Immediately sign out from secondary auth
    await signOut(secondaryAuth);

    return {
      success: true,
      uid: userCredential.user.uid,
      user: userCredential.user,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
