// AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useUser } from "../context/userContext";

const AdminRoute = ({ children }) => {
  const { technician, loading } = useUser();

  if (loading) return <div>Loading...</div>;

  if (!technician) {
    alert("Please log in first.");
    return <Navigate to="/" />;
  }

  if (technician.permission !== "Admin" && technician.name !== "System Admin") {
    alert("Access denied. Admins only.");
    return <Navigate to="/tickets" />;
  }

  return children;
};

export default AdminRoute;
