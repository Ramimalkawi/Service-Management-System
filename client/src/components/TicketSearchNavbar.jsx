import React, { useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function TicketSearchNavbar() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showInput, setShowInput] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    console.log("Searching for ticket:", search);
    setError("");
    setLoading(true);
    let found = null;
    try {
      // Try to search by ticketNum first (convert to number)
      let ticketNum = Number(search);
      let snap;
      if (!isNaN(ticketNum) && search.trim() !== "") {
        let q = query(
          collection(db, "tickets"),
          where("ticketNum", "==", ticketNum)
        );
        snap = await getDocs(q);
        if (!snap.empty) {
          found = snap.docs[0].id;
        }
      }
      if (!found) {
        // Try to search by customerName, caseID, serialNum (case-insensitive, partial)
        let q = query(collection(db, "tickets"));
        snap = await getDocs(q);
        const lowerSearch = search.toLowerCase();
        const match = snap.docs.find((doc) => {
          const data = doc.data();
          const name = typeof data.customerName === "string" ? data.customerName.toLowerCase() : "";
          let caseIDMatch = false;
          if (typeof data.caseID === "string") {
            caseIDMatch = data.caseID.toLowerCase().includes(lowerSearch);
          } else if (Array.isArray(data.caseID)) {
            caseIDMatch = data.caseID.some(
              (id) => typeof id === "string" && id.toLowerCase().includes(lowerSearch)
            );
          }
          const serialNum = typeof data.serialNum === "string" ? data.serialNum.toLowerCase() : "";
          const imei = typeof data.deviceIMEI === "string" ? data.deviceIMEI.toLowerCase() : "";
          return (
            name.includes(lowerSearch) ||
            caseIDMatch ||
            serialNum.includes(lowerSearch) ||
            imei.includes(lowerSearch)
          );
        });
        if (match) found = match.id;
      }
      if (found) {
        console.log("Navigating to ticket ID:", found);
        navigate(`/tickets/${found}/process`);
      } else {
        setError("Ticket not found.");
      }
    } catch (err) {
      setError(err.message || "Error searching for ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginLeft: 16,
        position: "relative",
      }}
    >
      {!showInput && (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
          }}
          title="Search Ticket"
        >
          <FaSearch size={20} color="#fff" />
        </button>
      )}
      {showInput && (
        <form
          onSubmit={handleSearch}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <input
            type="text"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket"
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              border: "1px solid #ccc",
              fontSize: "1rem",
              minWidth: 180,
            }}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => {
              setShowInput(false);
              setSearch("");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              marginLeft: 4,
            }}
            title="Close Search"
          >
            <FaTimes size={18} color="#e53935" />
          </button>
          <button
            type="submit"
            style={{
              padding: "6px 16px",
              borderRadius: 4,
              background: "#1ccad4",
              color: "#fff",
              border: "none",
              fontWeight: 600,
            }}
            disabled={loading || !search}
          >
            {loading ? "Searching..." : "Search"}
          </button>
          {error && (
            <span style={{ color: "#e53935", marginLeft: 8 }}>{error}</span>
          )}
        </form>
      )}
    </div>
  );
}
