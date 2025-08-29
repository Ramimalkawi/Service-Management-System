// PrintableTicket.jsx
import React from "react";
import "./PrintableTicket.css";

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

const PrintableTicket = React.forwardRef(({ ticket }, ref) => {
  return (
    <div ref={ref} className="printable-ticket">
      <h1>
        Ticket #{ticket.location}
        {ticket.ticketNum}
      </h1>
      <p>
        <strong>Date:</strong> {new Date(ticket.date).toLocaleString()}
      </p>
      <p>
        <strong>Ticket ID:</strong> {ticket.id}
      </p>

      <div className="print-section">
        <h2>Customer Info</h2>
        <p>
          <strong>Name:</strong> {ticket.customerName}
        </p>
        <p>
          <strong>Email:</strong> {ticket.emailAddress}
        </p>
        <p>
          <strong>Mobile:</strong> {ticket.mobileNumber}
        </p>
      </div>

      <div className="print-section">
        <h2>Device Info</h2>
        <p>
          <strong>Type:</strong> {ticket.machineType}
        </p>
        <p>
          <strong>Description:</strong> {ticket.deviceDescription}
        </p>
        <p>
          <strong>Serial Number:</strong> {ticket.serialNum}
        </p>
        <p>
          <strong>Warranty Status:</strong> {ticket.warrantyStatus}
        </p>
      </div>

      <div className="print-section">
        <h2>Repair Info</h2>
        <p>
          <strong>Symptom:</strong> {ticket.symptom}
        </p>
        <p>
          <strong>Repair ID:</strong> {ticket.repairID}
        </p>
      </div>

      {ticket.ticketStates?.length > 0 && (
        <div className="print-section">
          <h2>Status Timeline</h2>
          <ol>
            {ticket.ticketStates.map((statusCode, idx) => (
              <li key={idx}>
                {statusMap[statusCode] || `Unknown (${statusCode})`}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
});

export default PrintableTicket;
