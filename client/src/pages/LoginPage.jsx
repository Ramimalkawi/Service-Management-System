// LoginPage.jsx
import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase"; // adjust path
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { useUser } from "../context/userContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { setTechnician } = useUser();

  // If user is already logged in, redirect to tickets
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/tickets", { replace: true });
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  // Show nothing while checking auth to avoid login form flash
  if (checkingAuth) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading...</div>;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Ensure auth persists across browser sessions
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      const q = query(
        collection(db, "technicions"),
        where("email", "==", user.email),
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        setTechnician(querySnapshot.docs[0].data());
      } else {
        console.log("No technician record found for this email.");
      }

      navigate("/tickets");
    } catch (err) {
      console.log(err.message);
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Login</h2>
        {error && <p className="error-msg">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
