import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [technician, setTechnician] = useState(() => {
    const storedUser = localStorage.getItem("technician");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user);
      if (user) {
        console.log("User UID:", user.uid);
        console.log("User email:", user.email);
        try {
          // Query by email instead of using UID as document ID
          const q = query(
            collection(db, "technicions"),
            where("email", "==", user.email)
          );
          console.log("Fetching technician data for email:", user.email);
          const querySnapshot = await getDocs(q);
          console.log(
            "Query result:",
            querySnapshot.empty
              ? "No documents"
              : `${querySnapshot.size} documents found`
          );

          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data();
            const techData = {
              uid: user.uid,
              id: querySnapshot.docs[0].id,
              ...docData,
            };
            console.log("Technician data:", techData);
            setTechnician(techData);
            localStorage.setItem("technician", JSON.stringify(techData));
          } else {
            console.log("No technician document found for email:", user.email);
            setTechnician(null);
            localStorage.removeItem("technician");
          }
        } catch (err) {
          console.error("Error fetching technician:", err);
          setTechnician(null);
          localStorage.removeItem("technician");
        }
      } else {
        console.log("User not authenticated");
        setTechnician(null);
        localStorage.removeItem("technician");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ technician, setTechnician }}>
      {!loading && children}
    </UserContext.Provider>
  );
};
