import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ReceivePayment() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [parts, setParts] = useState([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTicketDetails() {
      setLoading(true);
      try {
        const ticketRef = doc(db, "tickets", ticketId);
        const ticketSnap = await getDoc(ticketRef);

        if (ticketSnap.exists()) {
          const ticketData = ticketSnap.data();
          setTicket(ticketData);

          if (ticketData.partDeliveryNote) {
            const partsRef = doc(
              db,
              "partsDeliveryNotes",
              ticketData.partDeliveryNote
            );
            const partsSnap = await getDoc(partsRef);

            if (partsSnap.exists()) {
              const partsData = partsSnap.data();
              setParts(partsData.parts || []);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching ticket details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTicketDetails();
  }, [ticketId]);

  const handlePayment = async () => {
    if (!ticket) return;

    const totalAmount = parts.reduce(
      (sum, part) => sum + Number(part.price || 0),
      0
    );
    const newAmountPaid = Number(ticket.amountPaid || 0) + Number(amountPaid);
    const newStatus =
      newAmountPaid >= totalAmount
        ? "Paid"
        : newAmountPaid > 0
          ? "Partially Paid"
          : "Pending";

    try {
      const ticketRef = doc(db, "tickets", ticketId);
      await updateDoc(ticketRef, {
        amountPaid: newAmountPaid,
        status: newStatus,
      });

      alert("Payment updated successfully!");
      navigate("/accounting");
    } catch (error) {
      console.error("Error updating payment:", error);
      alert("Failed to update payment. Please try again.");
    }
  };

  const remainingAmount =
    parts.reduce((sum, part) => sum + Number(part.price || 0), 0) -
    (ticket?.amountPaid || 0);

  if (loading) return <p>Loading...</p>;
  if (!ticket) return <p>Ticket not found.</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Receive Payment</h2>
      <div style={{ marginBottom: "1rem" }}>
        <h3>Ticket Details</h3>
        <p>
          <strong>Ticket #:</strong> {ticket.location}
          {ticket.ticketNum}
        </p>
        <p>
          <strong>Customer:</strong> {ticket.customerName}
        </p>
        <p>
          <strong>Device:</strong> {ticket.machineType}
        </p>
        <p>
          <strong>Status:</strong> {ticket.status}
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <h3>Parts to be Paid</h3>
        {parts.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    borderBottom: "2px solid #e0e0e0",
                    padding: "12px 16px",
                    textAlign: "left",
                  }}
                >
                  Part Number
                </th>
                <th
                  style={{
                    borderBottom: "2px solid #e0e0e0",
                    padding: "12px 16px",
                    textAlign: "left",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    borderBottom: "2px solid #e0e0e0",
                    padding: "12px 16px",
                    textAlign: "left",
                  }}
                >
                  Quantity
                </th>
                <th
                  style={{
                    borderBottom: "2px solid #e0e0e0",
                    padding: "12px 16px",
                    textAlign: "left",
                  }}
                >
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr key={index}>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    {part.partNumber}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    {part.description}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    {part.quantity}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    JOD {part.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No parts associated with this ticket.</p>
        )}
      </div>

      {ticket && (
        <div style={{ marginBottom: "1rem" }}>
          <h3>Payment Details</h3>
          <p>
            <strong>Amount Paid:</strong> JOD {ticket.amountPaid || 0}
          </p>
          <p>
            <strong>Remaining Amount:</strong> JOD {remainingAmount}
          </p>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <h3>Payment</h3>
        <p>
          <strong>Total Amount:</strong> JOD
          {parts
            .reduce((sum, part) => sum + Number(part.price || 0), 0)
            .toFixed(2)}
        </p>
        <p>
          <strong>Amount Paid:</strong> JOD {ticket.amountPaid || 0}
        </p>
        <label>
          Enter Amount Paid:
          <input
            type="number"
            value={amountPaid}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value <= remainingAmount) {
                setAmountPaid(value);
              } else {
                alert("Paid amount cannot exceed the remaining amount.");
              }
            }}
            style={{ marginLeft: "8px", padding: "4px" }}
          />
        </label>
      </div>

      <button
        onClick={handlePayment}
        style={{
          padding: "8px 16px",
          backgroundColor: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Submit Payment
      </button>
    </div>
  );
}
