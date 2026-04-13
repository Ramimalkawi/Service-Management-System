// PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    // While waiting for Firebase to restore session, check localStorage
    // to avoid flashing the login page
    const cachedUser = localStorage.getItem("technician");
    if (cachedUser) {
      return children;
    }
    return <div>Loading...</div>;
  }

  if (!user) {
    alert("Please login first.");
    return <Navigate to="/" />;
  }

  return children;
};

export default PrivateRoute;
