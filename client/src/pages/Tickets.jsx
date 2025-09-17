import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import TicketCard from "../components/TicketCard";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { useRef } from "react";

import "./Tickets.css";
import TicketDetail from "../components/TicketDetail";
import { useUser } from "../context/userContext";

const TICKETS_PER_PAGE = 50;

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Search state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all"); // all, ticketNumber, date, machineType, customerName

  const { technician } = useUser();
  const navigate = useNavigate();
  const { id: selectedTicketId } = useParams();

  const selectedTicket = filteredTickets.find((t) => t.id === selectedTicketId);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartNum, setExportStartNum] = useState("");
  const [exportEndNum, setExportEndNum] = useState("");
  const exportRef = useRef();

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const snapshot = await getDocs(collection(db, "tickets"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const sorted = data.sort((a, b) => b.ticketNum - a.ticketNum);

        setTickets(sorted);
        setFilteredTickets(sorted);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      }
    };

    fetchTickets();
  }, []);

  useEffect(() => {
    let filtered = tickets;

    // Apply location filter
    if (locationFilter === "Amman") {
      filtered = filtered.filter((ticket) => ticket.location === "M");
    } else if (locationFilter === "Irbid") {
      filtered = filtered.filter((ticket) => ticket.location === "I");
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      filtered = filtered.filter((ticket) => {
        switch (searchType) {
          case "ticketNumber":
            const ticketNumber = `${ticket.location}${ticket.ticketNum}`;
            return ticketNumber.toLowerCase().includes(query);

          case "date":
            // Search in ticket date
            return ticket.date && ticket.date.toLowerCase().includes(query);

          case "machineType":
            return (
              ticket.machineType &&
              ticket.machineType.toLowerCase().includes(query)
            );

          case "customerName":
            return (
              ticket.customerName &&
              ticket.customerName.toLowerCase().includes(query)
            );

          case "all":
          default:
            // Search across all fields
            const ticketNum = `${ticket.location}${ticket.ticketNum}`;
            return (
              ticketNum.toLowerCase().includes(query) ||
              (ticket.date && ticket.date.toLowerCase().includes(query)) ||
              (ticket.machineType &&
                ticket.machineType.toLowerCase().includes(query)) ||
              (ticket.customerName &&
                ticket.customerName.toLowerCase().includes(query)) ||
              (ticket.symptom &&
                ticket.symptom.toLowerCase().includes(query)) ||
              (ticket.emailAddress &&
                ticket.emailAddress.toLowerCase().includes(query)) ||
              (ticket.mobileNumber &&
                ticket.mobileNumber.toLowerCase().includes(query))
            );
        }
      });
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [locationFilter, tickets, searchQuery, searchType]);

  const totalPages = Math.ceil(filteredTickets.length / TICKETS_PER_PAGE);
  const currentTickets = filteredTickets.slice(
    (currentPage - 1) * TICKETS_PER_PAGE,
    currentPage * TICKETS_PER_PAGE
  );

  const handleCardClick = (ticket) => {
    navigate(`/tickets/${ticket.id}`);
  };

  const handleNewTicket = () => {
    navigate("/tickets/new"); // or whatever route you use for creating tickets
  };

  const handleExportExcel = () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = () => {
    // Find indices for start and end ticketNum
    const startIdx = filteredTickets.findIndex(
      (t) => String(t.ticketNum) === exportStartNum
    );
    const endIdx = filteredTickets.findIndex(
      (t) => String(t.ticketNum) === exportEndNum
    );

    if (startIdx === -1 || endIdx === -1) {
      alert("Start or end ticket number not found in the filtered list.");
      return;
    }

    // Ensure startIdx <= endIdx
    const from = Math.min(startIdx, endIdx);
    const to = Math.max(startIdx, endIdx);

    const ticketsToExport = filteredTickets.slice(from, to + 1);

    if (ticketsToExport.length === 0) {
      alert("No tickets to export for the selected range.");
      return;
    }

    // Prepare data for Excel
    const data = ticketsToExport.map((t) => ({
      TicketID: t.id,
      TicketNumber: `${t.location}${t.ticketNum}`,
      Date: t.date,
      CustomerName: t.customerName,
      Email: t.emailAddress,
      Mobile: t.mobileNumber,
      MachineType: t.machineType,
      DeviceDescription: t.deviceDescription,
      SerialNum: t.serialNum,
      WarrantyStatus: t.warrantyStatus,
      Symptom: t.symptom,
      RepairID: t.caseID,
      Notes: t.notes,
      StatusTimeline: t.ticketStates ? t.ticketStates.join(", ") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    XLSX.writeFile(
      wb,
      `tickets_export_${exportStartNum}_to_${exportEndNum}.xlsx`
    );
    setShowExportModal(false);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="tickets-header">
        <div className="tickets-header-content">
          <div className="left-section">
            <div className="tickets-new">
              <h1>🎫 Tickets</h1>
              <button className="new-ticket-button" onClick={handleNewTicket}>
                + New Ticket
              </button>
            </div>
            <div className="search-controls">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="search-type-select"
              >
                <option value="all">All Fields</option>
                <option value="ticketNumber">Ticket Number</option>
                <option value="date">Date</option>
                <option value="machineType">Machine Type</option>
                <option value="customerName">Customer Name</option>
              </select>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="clear-search-button"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="filter-menu">
              {["All", "Amman", "Irbid"].map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocationFilter(loc)}
                  style={{
                    marginRight: "10px",
                    padding: "8px 16px",
                    backgroundColor:
                      locationFilter === loc ? "#1ccad4" : "#f0f0f0",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                ◀
              </button>
              <span style={{ margin: "0 10px" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                ▶
              </button>
              <button
                className="export-excel-button"
                onClick={handleExportExcel}
                style={{
                  marginLeft: "16px",
                  background: "#1ccad4",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Export to Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Results Counter */}
      {searchQuery && (
        <div className="search-results-info">
          Found {filteredTickets.length} ticket
          {filteredTickets.length !== 1 ? "s" : ""}
          {searchType !== "all" &&
            ` in ${searchType.replace(/([A-Z])/g, " $1").toLowerCase()}`}
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}

      {/* Main container */}

      {/* <div className="tickets-container">
        <div className={`tickets-list ${selectedTicket ? "shrink" : ""}`}>
          {currentTickets.length === 0 ? (
            <p>No tickets found.</p>
          ) : (
            currentTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={ticket.id === selectedTicketId}
                onClick={() => handleCardClick(ticket)}
              />
            ))
          )}
        </div>

        {selectedTicket && <TicketDetail ticket={selectedTicket} />}
      </div> */}

      <div className="tickets-page-wrapper">
        <div
          className={`ticket-list-panel ${selectedTicket ? "shrink" : "full-width"}`}
        >
          {currentTickets.length === 0 ? (
            <p>No tickets found.</p>
          ) : (
            currentTickets.map((ticket) => (
              <>
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={ticket.id === selectedTicketId}
                  onClick={() => handleCardClick(ticket)}
                />
                {/* On small screens, show TicketDetail below the selected card */}
                {selectedTicket && ticket.id === selectedTicketId && (
                  <div className="ticket-detail-mobile">
                    <TicketDetail
                      ticket={selectedTicket}
                      onClose={() => {
                        navigate("/tickets");
                      }}
                    />
                  </div>
                )}
              </>
            ))
          )}
        </div>

        {/* On desktop, show TicketDetail on the right only if selectedTicket exists */}
        {selectedTicket && (
          <div className="ticket-detail-panel">
            <TicketDetail
              ticket={selectedTicket}
              onClose={() => {
                navigate("/tickets");
              }}
            />
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="modal-overlay" ref={exportRef}>
          <div className="modal-content">
            <h3>Export Tickets to Excel</h3>
            <label>
              Start Ticket Number:
              <input
                type="text"
                value={exportStartNum}
                onChange={(e) => setExportStartNum(e.target.value)}
                style={{ marginLeft: "8px", width: "120px" }}
                placeholder="e.g. 111097"
              />
            </label>
            <br />
            <label>
              End Ticket Number:
              <input
                type="text"
                value={exportEndNum}
                onChange={(e) => setExportEndNum(e.target.value)}
                style={{ marginLeft: "8px", width: "120px" }}
                placeholder="e.g. 111101"
              />
            </label>
            <br />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button
                onClick={handleConfirmExport}
                style={{
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Export
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: "#ccc",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ marginTop: "12px", color: "#888" }}>
              Number of tickets to export:{" "}
              {(() => {
                const startIdx = filteredTickets.findIndex(
                  (t) => String(t.ticketNum) === exportStartNum
                );
                const endIdx = filteredTickets.findIndex(
                  (t) => String(t.ticketNum) === exportEndNum
                );
                if (startIdx === -1 || endIdx === -1) return 0;
                return Math.abs(endIdx - startIdx) + 1;
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
