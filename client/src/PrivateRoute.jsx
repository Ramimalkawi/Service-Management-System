// PrivateRoute.jsx
import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

const PrivateRoute = ({ children }) => {
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (!loading && !user) {
      alert("Please login first.");
    }
  }, [loading, user]);

  if (loading) return <div>Loading...</div>;

  return user ? children : <Navigate to="/" />;
};

export default PrivateRoute;
