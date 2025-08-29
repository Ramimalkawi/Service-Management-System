import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import TicketCard from "../components/TicketCard";
import { useNavigate, useParams } from "react-router-dom";

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
          className={`ticket-list-panel ${
            selectedTicket ? "shrink" : "full-width"
          }`}
        >
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

        {selectedTicket && (
          <div className="ticket-detail-panel">
            <TicketDetail
              ticket={selectedTicket}
              onClose={() => {
                navigate("/tickets"); // optional: if using routes
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets;
