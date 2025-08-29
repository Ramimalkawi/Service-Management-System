import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { createUserWithoutSessionConflict } from "../utils/secondaryAuth";
import { useUser } from "../context/userContext";
import "./UserManagement.css";

const UserManagement = () => {
  const { technician } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [assigningCredentialsUser, setAssigningCredentialsUser] =
    useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    location: "M", // Default to Main (Amman)
    permission: "User", // Default permission
    isAccountant: false,
  });
  const [credentialsData, setCredentialsData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  const [credentialsSuccess, setCredentialsSuccess] = useState("");

  // Check if current user is System Admin
  const isSystemAdmin =
    technician?.name === "System Admin" ||
    technician?.permission === "SystemAdmin" ||
    technician?.permission === "Admin";

  useEffect(() => {
    if (!isSystemAdmin) {
      setError("Access denied. Only System Admin can manage users.");
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [isSystemAdmin]);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "technicions"));
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCredentialsInputChange = (e) => {
    const { name, value } = e.target;
    setCredentialsData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      location: "M",
      permission: "User",
      isAccountant: false,
    });
    setEditingUser(null);
    setError("");
    setSuccess("");
  };

  const resetCredentialsForm = () => {
    setCredentialsData({
      email: "",
      password: "",
    });
    setAssigningCredentialsUser(null);
    setCredentialsError("");
    setCredentialsSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name || !formData.email) {
      setError("Name and email are required");
      return;
    }

    if (!editingUser && !formData.password) {
      setError("Password is required for new users");
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        const userRef = doc(db, "technicions", editingUser.id);
        const updateData = {
          name: formData.name,
          email: formData.email,
          location: formData.location,
          permission: formData.permission,
          isAccountant: formData.isAccountant,
        };

        await updateDoc(userRef, updateData);
        setSuccess("User updated successfully");
      } else {
        // Create new user using secondary auth (preserves admin session)
        const result = await createUserWithoutSessionConflict(
          formData.email,
          formData.password
        );

        if (result.success) {
          // Create the technician record
          await addDoc(collection(db, "technicions"), {
            name: formData.name,
            email: formData.email,
            location: formData.location,
            permission: formData.permission,
            isAccountant: formData.isAccountant,
            uid: result.uid,
            createdAt: new Date(),
            createdBy: technician.name,
          });

          setSuccess("User created successfully!");
        } else {
          throw new Error(result.error || "Failed to create user");
        }
      }

      await fetchUsers();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error saving user:", err);
      setError(err.message || "Failed to save user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      location: user.location || "M",
      permission: user.permission || "User",
      isAccountant: user.isAccountant || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "technicions", userId));
      setSuccess("User deleted successfully");
      await fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      setError("Failed to delete user");
    }
  };

  const handleAssignCredentials = (user) => {
    setAssigningCredentialsUser(user);
    setCredentialsData({
      email: "",
      password: "",
    });
    setShowCredentialsModal(true);
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setCredentialsError("");
    setCredentialsSuccess("");

    if (!credentialsData.email || !credentialsData.password) {
      setCredentialsError("Both email and password are required");
      return;
    }

    try {
      // Create authentication user using secondary auth (preserves admin session) - Updated
      const result = await createUserWithoutSessionConflict(
        credentialsData.email,
        credentialsData.password
      );

      if (result.success) {
        // Update the user document with email and UID
        const userRef = doc(db, "technicions", assigningCredentialsUser.id);
        await updateDoc(userRef, {
          email: credentialsData.email,
          uid: result.uid,
        });

        setCredentialsSuccess("Login credentials assigned successfully!");
        await fetchUsers();

        setTimeout(() => {
          setShowCredentialsModal(false);
          resetCredentialsForm();
        }, 2000);
      } else {
        throw new Error(
          result.error || "Failed to create authentication account"
        );
      }
    } catch (err) {
      console.error("Error assigning credentials:", err);
      setCredentialsError(err.message || "Failed to assign credentials");
    }
  };

  const getPermissionBadge = (user) => {
    let badgeClass = "permission-badge ";
    let displayText = "";

    if (user.permission === "Admin") {
      badgeClass += "admin";
      displayText = "Admin";
    } else {
      badgeClass += "user";
      displayText = "User";
    }

    if (user.isAccountant) {
      displayText += " + Accountant";
      badgeClass += " accountant";
    }

    return <span className={badgeClass}>{displayText}</span>;
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (!isSystemAdmin) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>Only System Admin can access user management.</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>👥 User Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          ➕ Add New User
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="users-grid">
        {users.map((user) => (
          <div key={user.id} className="user-card">
            <div className="user-info">
              <h3>{user.name}</h3>
              {user.email ? (
                <p className="user-email">📧 {user.email}</p>
              ) : (
                <p className="user-email no-email">❌ No login credentials</p>
              )}
              <p className="user-location">
                📍{" "}
                {user.location === "M" ? "Main Office (Amman)" : "Irbid Branch"}
              </p>
              {getPermissionBadge(user)}
            </div>
            <div className="user-actions">
              {user.email ? (
                // User has email - show normal edit/delete buttons
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => handleEdit(user)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(user.id)}
                    disabled={user.name === "System Admin"}
                  >
                    🗑️ Delete
                  </button>
                </>
              ) : (
                // User has no email - show assign credentials button
                <>
                  <button
                    className="btn-primary assign-credentials"
                    onClick={() => handleAssignCredentials(user)}
                  >
                    🔐 Assign Login
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleEdit(user)}
                  >
                    ✏️ Edit Info
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(user.id)}
                    disabled={user.name === "System Admin"}
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingUser ? "Edit User" : "Add New User"}</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={editingUser} // Can't change email when editing
                />
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength="6"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="location">Location *</label>
                <select
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                >
                  <option value="M">Main Office (Amman)</option>
                  <option value="I">Irbid Branch</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="permission">Permission Level *</label>
                <select
                  id="permission"
                  name="permission"
                  value={formData.permission}
                  onChange={handleInputChange}
                  required
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isAccountant"
                    checked={formData.isAccountant}
                    onChange={handleInputChange}
                  />
                  <span className="checkmark"></span>
                  Also assign as Accountant
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingUser ? "Update User" : "Create User"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Assignment Modal */}
      {showCredentialsModal && assigningCredentialsUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>🔐 Assign Login Credentials</h2>
              <p className="modal-subtitle">
                Assign email and password for:{" "}
                <strong>{assigningCredentialsUser.name}</strong>
              </p>
              <button
                className="close-btn"
                onClick={() => {
                  setShowCredentialsModal(false);
                  resetCredentialsForm();
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="user-form">
              {credentialsError && (
                <div className="error-message">❌ {credentialsError}</div>
              )}
              {credentialsSuccess && (
                <div className="success-message">✅ {credentialsSuccess}</div>
              )}

              <div className="form-group">
                <label htmlFor="credentials-email">Email Address *</label>
                <input
                  type="email"
                  id="credentials-email"
                  name="email"
                  value={credentialsData.email}
                  onChange={handleCredentialsInputChange}
                  placeholder="Enter email for login"
                  required
                />
                <small className="form-help">
                  This email will be used to log into the system
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="credentials-password">Password *</label>
                <input
                  type="password"
                  id="credentials-password"
                  name="password"
                  value={credentialsData.password}
                  onChange={handleCredentialsInputChange}
                  placeholder="Enter password (min 6 characters)"
                  required
                  minLength="6"
                />
                <small className="form-help">
                  Password must be at least 6 characters long
                </small>
              </div>

              <div className="credentials-info">
                <h4>ℹ️ Current User Info:</h4>
                <p>
                  <strong>Name:</strong> {assigningCredentialsUser.name}
                </p>
                <p>
                  <strong>Location:</strong>{" "}
                  {assigningCredentialsUser.location === "M"
                    ? "Main Office (Amman)"
                    : "Irbid Branch"}
                </p>
                <p>
                  <strong>Permission:</strong>{" "}
                  {assigningCredentialsUser.permission || "User"}
                </p>
                {assigningCredentialsUser.isAccountant && (
                  <p>
                    <strong>Additional Role:</strong> Accountant
                  </p>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  🔐 Assign Credentials
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCredentialsModal(false);
                    resetCredentialsForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
