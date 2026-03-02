import React, { useEffect, useRef, useState } from "react";
import TicketCard from "../components/TicketCard";
import TicketDetail from "../components/TicketDetail";
import "../components/TicketCard.css";
import { API_ENDPOINTS } from "../config/api";

// Helper to convert legacy numeric date to formatted string
function formatLegacyDate(num) {
  if (typeof num !== "number") return num;
  // The legacy number is seconds since Jan 1, 2000, 00:00:00 UTC
  // 946684800 is the Unix timestamp for 2000-01-01T00:00:00Z
  const unixSeconds = 978307200 + num;
  const date = new Date(unixSeconds * 1000);
  // Format as DD/MM/YYYY, h:mm:ss AM/PM
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const SEARCH_TYPES = [
  { value: "ticketNum", label: "Ticket Number" },
  { value: "date", label: "Date" },
  { value: "customerName", label: "Customer Name" },
  { value: "serialNum", label: "Device Serial Number" },
  { value: "caseID", label: "Repair ID" },
];

export default function Archived() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicketIdx, setSelectedTicketIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("ticketNum");
  const [localMode, setLocalMode] = useState(false);
  const [localLabel, setLocalLabel] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.ARCHIVE_YEARS);
        if (!res.ok) throw new Error("Failed to load archive years");
        const data = await res.json();
        const list = Array.isArray(data.years) ? data.years : [];
        setYears((prev) => {
          if (localMode && prev.includes("Local")) return prev;
          return list;
        });
        if (!localMode && list.length > 0) {
          setYear((prev) => prev || list[0]);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    fetchYears();
  }, [localMode]);

  useEffect(() => {
    async function fetchTickets() {
      if (localMode) {
        setLoading(false);
        return;
      }
      if (!year) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setSelectedTicketIdx(null);

      try {
        const filesRes = await fetch(
          `${API_ENDPOINTS.ARCHIVE_FILES}?year=${encodeURIComponent(year)}`,
        );
        if (!filesRes.ok) throw new Error("Failed to load archive files");
        const filesData = await filesRes.json();
        const files = Array.isArray(filesData.files) ? filesData.files : [];

        const allTickets = [];
        for (const file of files) {
          const res = await fetch(
            `${API_ENDPOINTS.ARCHIVE_FILE_BASE}/${year}/${file}`,
          );
          if (!res.ok) throw new Error(`Failed to fetch ${file}`);
          const data = await res.json();
          if (Array.isArray(data.tickets)) {
            allTickets.push(
              ...data.tickets.map((t) => ({
                ...t,
                ticketNum: t.ticketNum !== undefined ? t.ticketNum : t.number,
              })),
            );
          }
        }
        setTickets(allTickets);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [year, localMode]);

  const handleLocalFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleLocalFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      const text = await file.text();
      const data = JSON.parse(text);
      const localTickets = Array.isArray(data.tickets) ? data.tickets : [];
      const normalized = localTickets.map((t) => ({
        ...t,
        ticketNum: t.ticketNum !== undefined ? t.ticketNum : t.number,
      }));
      setTickets(normalized);
      setSelectedTicketIdx(null);
      setLocalMode(true);
      setLocalLabel(file.name || "Local archive");
      setYears((prev) => (prev.includes("Local") ? prev : ["Local", ...prev]));
      setYear("Local");
    } catch (err) {
      setError("Failed to load local archive JSON.");
    } finally {
      setLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    switch (searchType) {
      case "ticketNum": {
        const num = String(ticket.ticketNum || ticket.number || "");
        return num.toLowerCase().includes(query);
      }
      case "date":
        return (
          (ticket.date && String(ticket.date).toLowerCase().includes(query)) ||
          false
        );
      case "customerName":
        return (
          (ticket.customerName &&
            ticket.customerName.toLowerCase().includes(query)) ||
          false
        );
      case "serialNum":
        return (
          (ticket.serialNum &&
            ticket.serialNum.toLowerCase().includes(query)) ||
          false
        );
      case "caseID":
        return (
          (ticket.caseID && ticket.caseID.toLowerCase().includes(query)) ||
          false
        );
      default:
        return true;
    }
  });

  if (loading) return <div>Loading archived tickets...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  if (years.length === 0) {
    return <div>No archived tickets found yet.</div>;
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={handleLocalFilePick}>
          Load Local Archive JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={handleLocalFileChange}
        />
        {localMode && localLabel && (
          <span style={{ color: "#666" }}>Loaded: {localLabel}</span>
        )}
        <label htmlFor="archived-year-select" style={{ marginRight: 8 }}>
          Select Year:
        </label>
        <select
          id="archived-year-select"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={`Search by ${SEARCH_TYPES.find((t) => t.value === searchType).label}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginLeft: 8, padding: 4, minWidth: 180 }}
        />
        <select
          value={searchType}
          onChange={(e) => {
            setSearchType(e.target.value);
            setSearchQuery("");
          }}
          style={{ marginLeft: 8 }}
        >
          {SEARCH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ margin: "0 auto" }}>
        {filteredTickets.length === 0 ? (
          <p>No archived tickets found for {year}.</p>
        ) : (
          <div style={{ display: "flex", gap: 24 }}>
            <div
              style={{
                maxHeight: 1000,
                overflowY: "auto",
                flex: selectedTicketIdx === null ? 1 : 1,
                width: selectedTicketIdx === null ? "100%" : undefined,
                transition: "width 0.2s",
              }}
            >
              {filteredTickets.map((ticket, idx) => (
                <TicketCard
                  key={`${ticket.id || "noid"}_${idx}`}
                  ticket={{ ...ticket, date: formatLegacyDate(ticket.date) }}
                  isSelected={selectedTicketIdx === idx}
                  onClick={() => setSelectedTicketIdx(idx)}
                />
              ))}
            </div>
            {selectedTicketIdx !== null &&
              filteredTickets[selectedTicketIdx] && (
                <div style={{ flex: 1, minWidth: 0, maxHeight: 1000 }}>
                  <TicketDetail
                    ticket={{
                      ...filteredTickets[selectedTicketIdx],
                      date: formatLegacyDate(
                        filteredTickets[selectedTicketIdx].date,
                      ),
                    }}
                    onClose={() => setSelectedTicketIdx(null)}
                    archived={true}
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
