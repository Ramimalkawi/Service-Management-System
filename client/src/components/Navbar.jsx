import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import "./Navbar.css";
import { useUser } from "../context/userContext";

const Navbar = () => {
  const [user] = useAuthState(auth);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const navigate = useNavigate();
  const { technician } = useUser();

  // Temporary debug logging
  console.log("Current technician data:", technician);
  console.log("Technician name:", technician?.name);
  console.log("Technician permission:", technician?.permission);
  console.log(
    "Is System Admin?",
    technician?.name === "System Admin" ||
      technician?.permission === "SystemAdmin"
  );

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-title">🍏 Apple Service System</div>

      <div className="navbar-links">
        <NavLink to="/tickets" activeClassName="active">
          Tickets
        </NavLink>
        <NavLink to="/customers" activeClassName="active">
          Customers
        </NavLink>
        <NavLink to="/devices" activeClassName="active">
          Devices
        </NavLink>
        {/* 👇 Conditionally render Admin Dashboard link */}
        {technician?.permission === "Admin" && (
          <NavLink to="/admin" activeClassName="active">
            Admin Dashboard
          </NavLink>
        )}
        {/* 👇 Conditionally render User Management link for System Admin only */}
        {(technician?.name === "System Admin" ||
          technician?.permission === "SystemAdmin") && (
          <NavLink to="/user-management" activeClassName="active">
            👥 User Management
          </NavLink>
        )}
        <NavLink to="/archived" activeClassName="active">
          Archived
        </NavLink>
      </div>
      {user && (
        <div className="navbar-avatar" ref={dropdownRef}>
          <img
            src={`https://ui-avatars.com/api/?name=${
              user.displayName || user.email
            }`}
            alt="Avatar"
            className="avatar"
            onClick={() => setDropdownOpen((prev) => !prev)}
          />
          {dropdownOpen && (
            <div className="dropdown-menu">
              <p>
                {technician?.name ||
                  technician?.displayName ||
                  user?.displayName ||
                  user?.email ||
                  "Loading..."}
              </p>
              <button onClick={handleSignOut}>Sign Out</button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
