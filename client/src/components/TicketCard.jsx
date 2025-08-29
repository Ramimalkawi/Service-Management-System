import "./TicketCard.css";

const statusMap = {
  0: "Start",
  1: "VMI Troubleshooting",
  2: "Repair Released from Processing",
  3: "Awaiting Parts",
  4: "Parts Allocated",
  5: "In Repair",
  6: "Ready For Pickup",
  7: "Repair Marked Complete",
};

const statusColorMap = {
  0: "#b9caff", // Start
  3: "#ffe08a", // Awaiting Parts
  6: "#50fa8d", // Ready For Pickup
  // All others default to white
};

const TicketCard = ({ ticket, onClick, isSelected }) => {
  const lastStatusIndex = ticket.ticketStates?.[ticket.ticketStates.length - 1];
  const statusText = statusMap[lastStatusIndex] || "Unknown";
  const bgColor = statusColorMap[lastStatusIndex] || "#ffffff";

  return (
    <div
      className={`ticket-card-new ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      style={{
        backgroundColor: bgColor,
        padding: "12px",
        borderRadius: "10px",
        marginBottom: "10px",
        border: "1px solid #ddd",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <div className="ticket-header">
        <span className="ticket-id">
          Tic# {ticket.location}
          {ticket.ticketNum}
        </span>
        <span className="ticket-status">Status: {statusText}</span>
        <span className="ticket-customer">Customer: {ticket.customerName}</span>
      </div>
      <div className="ticket-body">
        Device {ticket.machineType} with problem {ticket.symptom}
      </div>

      <div className="ticket-date">{ticket.date}</div>
    </div>
  );
};

export default TicketCard;
