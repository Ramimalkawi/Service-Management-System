import React, { useState, useRef, useEffect } from "react";
import TicketSearchNavbar from "./TicketSearchNavbar";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import "./Navbar.css";
import { useUser } from "../context/userContext";

const Navbar = () => {
  const [user] = useAuthState(auth);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dropdownRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();
  const { technician } = useUser();

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const toggleMobileNav = () => {
    setMobileNavOpen((prev) => !prev);
  };

  return (
    <header className="navbar-shell">
      <nav className="navbar">
        <div className="navbar-head">
          <div className="navbar-title">
            <img
              src="/logo-no-background.png"
              alt="365 Solutions"
              className="navbar-title__logo"
            />
          </div>
          <div className="navbar-controls">
            <button
              type="button"
              className={`navbar-toggle ${mobileNavOpen ? "open" : ""}`}
              onClick={toggleMobileNav}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
            >
              <span />
              <span />
              <span />
            </button>
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
          </div>
        </div>

        <div
          className={`navbar-links ${mobileNavOpen ? "navbar-links--open" : ""}`}
        >
          <NavLink
            to="/tickets"
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            Tickets
          </NavLink>
          <NavLink
            to="/customers"
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            Customers
          </NavLink>
          {technician?.permission === "Admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              Admin Dashboard
            </NavLink>
          )}
          {(technician?.name === "System Admin" ||
            technician?.permission === "SystemAdmin") && (
            <NavLink
              to="/user-management"
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              👥 User Management
            </NavLink>
          )}
          {technician?.isAccountant && (
            <NavLink
              to="/accounting"
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              Accounting
            </NavLink>
          )}
          <NavLink
            to="/archived"
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            Archived
          </NavLink>
          <div className="navbar-search">
            <TicketSearchNavbar />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
