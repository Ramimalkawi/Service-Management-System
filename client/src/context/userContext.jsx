import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [technician, setTechnician] = useState(() => {
    const storedUser = localStorage.getItem("technician");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          const q = query(
            collection(db, "technicions"),
            where("email", "==", user.email)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data();
            const techData = {
              uid: user.uid,
              id: querySnapshot.docs[0].id,
              ...docData,
            };
            setTechnician(techData);
            localStorage.setItem("technician", JSON.stringify(techData));
          } else {
            setTechnician(null);
            localStorage.removeItem("technician");
          }
        } catch (err) {
          console.error("Error fetching technician:", err);
          // If auth token is invalid/expired, sign out cleanly
          if (err.code === "permission-denied" || err.code === "unauthenticated") {
            await signOut(auth);
          }
          setTechnician(null);
          localStorage.removeItem("technician");
        }
      } else {
        // User is null — either signed out or token refresh failed (403)
        // Sign out explicitly to clear any stale Firebase SDK state
        try {
          await signOut(auth);
        } catch (_) {
          // already signed out
        }
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
