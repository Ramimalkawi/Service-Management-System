// SystemAdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useUser } from "../context/userContext";

const SystemAdminRoute = ({ children }) => {
  const { technician, loading } = useUser();

  if (loading) return <div>Loading...</div>;

  if (!technician) {
    alert("Please log in first.");
    return <Navigate to="/" />;
  }

  if (
    technician.name !== "System Admin" &&
    technician.permission !== "SystemAdmin" &&
    technician.permission !== "Admin"
  ) {
    alert("Access denied. Admin privileges required.");
    return <Navigate to="/tickets" />;
  }

  return children;
};

export default SystemAdminRoute;
