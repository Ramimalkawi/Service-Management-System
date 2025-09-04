import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Accounting() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [partsByTicket, setPartsByTicket] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTicketsAndParts() {
      setLoading(true);
      const q = query(
        collection(db, "tickets"),
        where("shouldHaveInvoice", "==", true)
      );
      const snapshot = await getDocs(q);
      const ticketsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const partsData = {};
      for (const ticket of ticketsData) {
        if (
          ticket.partDeliveryNote &&
          typeof ticket.partDeliveryNote === "string"
        ) {
          const { getDoc, doc: docRef } = await import("firebase/firestore");
          const snap = await getDoc(
            docRef(db, "partsDeliveryNotes", ticket.partDeliveryNote)
          );
          if (snap.exists()) {
            const docData = snap.data();
            partsData[ticket.id] = Array.isArray(docData.parts)
              ? docData.parts
              : [];
          } else {
            partsData[ticket.id] = [];
          }
        } else {
          partsData[ticket.id] = [];
        }
      }

      setTickets(ticketsData);
      setPartsByTicket(partsData);
      setLoading(false);
    }

    fetchTicketsAndParts();
  }, []);

  // Fetch parts for a ticket when expanded
  const handleRowClick = async (ticketId) => {
    setExpandedRow(expandedRow === ticketId ? null : ticketId);
    if (expandedRow !== ticketId && !partsByTicket[ticketId]) {
      // Find the ticket object
      const ticket = tickets.find((t) => t.id === ticketId);
      if (
        !ticket ||
        !ticket.partDeliveryNote ||
        typeof ticket.partDeliveryNote !== "string" ||
        ticket.partDeliveryNote.trim() === ""
      ) {
        setPartsByTicket((prev) => ({ ...prev, [ticketId]: [] }));
        return;
      }
      // Fetch the partsDeliveryNotes document by its ID
      const { getDoc, doc: docRef } = await import("firebase/firestore");
      const snap = await getDoc(
        docRef(db, "partsDeliveryNotes", ticket.partDeliveryNote)
      );
      if (snap.exists()) {
        const docData = snap.data();
        const allParts = Array.isArray(docData.parts) ? docData.parts : [];
        setPartsByTicket((prev) => ({ ...prev, [ticketId]: allParts }));
      } else {
        setPartsByTicket((prev) => ({ ...prev, [ticketId]: [] }));
      }
    }
  };

  return (
    <div className="accounting-page" style={{ padding: "2rem" }}>
      <h2
        style={{
          marginBottom: "2rem",
          fontWeight: 700,
          fontSize: "2rem",
          color: "#333",
        }}
      >
        Accounting - Tickets Requiring Invoices
      </h2>
      {loading ? (
        <p>Loading...</p>
      ) : tickets.length === 0 ? (
        <p>No tickets require invoices.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <thead style={{ background: "#f5f5f5" }}>
              <tr>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Ticket #
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Customer
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Device
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Total Amount
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Due Amount
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    borderBottom: "2px solid #e0e0e0",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#555",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, idx) => {
                // Calculate totalAmount based on parts array, default to 0 if parts are undefined or empty
                const totalAmount = partsByTicket[ticket.id]?.length
                  ? Number(
                      partsByTicket[ticket.id].reduce(
                        (sum, part) => sum + Number(part.price || 0),
                        0
                      )
                    ).toFixed(2)
                  : "0.00";
                const dueAmount = Number(ticket.amountPaid || 0).toFixed(2);
                const remainingAmount =
                  partsByTicket[ticket.id]?.reduce(
                    (sum, part) => sum + Number(part.price || 0),
                    0
                  ) - (ticket.amountPaid || 0);

                return (
                  <>
                    <tr
                      key={ticket.id}
                      style={{
                        background: idx % 2 === 0 ? "#fafafa" : "#fff",
                        cursor: "pointer",
                      }}
                      onClick={() => handleRowClick(ticket.id)}
                    >
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {ticket.location}
                        {ticket.ticketNum}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {ticket.customerName}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {ticket.machineType}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "12px",
                            color:
                              ticket.status === "Paid"
                                ? "#2e7d32"
                                : ticket.status === "Partially Paid"
                                  ? "#e65100"
                                  : "#b71c1c",
                            backgroundColor:
                              ticket.status === "Paid"
                                ? "#c8e6c9"
                                : ticket.status === "Partially Paid"
                                  ? "#ffe0b2"
                                  : "#ffcdd2",
                            border: `1px solid ${
                              ticket.status === "Paid"
                                ? "#2e7d32"
                                : ticket.status === "Partially Paid"
                                  ? "#e65100"
                                  : "#b71c1c"
                            }`,
                            fontWeight: 400,
                            display: "inline-block",
                          }}
                        >
                          {ticket.status || "Pending"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {`JOD ${totalAmount}`}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {`JOD ${dueAmount}`}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid #eee",
                          textAlign: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            remainingAmount > 0 &&
                            navigate(`/receive-payment/${ticket.id}`)
                          }
                          disabled={remainingAmount <= 0}
                          style={{
                            padding: "8px 12px",
                            backgroundColor:
                              remainingAmount > 0 ? "#1976d2" : "#ccc",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor:
                              remainingAmount > 0 ? "pointer" : "not-allowed",
                          }}
                        >
                          Receive Payment (JOD)
                        </button>
                      </td>
                    </tr>
                    {expandedRow === ticket.id && (
                      <tr key={ticket.id + "-details"}>
                        <td
                          colSpan={6}
                          style={{ background: "#f9f9f9", padding: "0" }}
                        >
                          <div style={{ padding: "16px" }}>
                            <h4
                              style={{
                                margin: "0 0 12px 0",
                                fontWeight: 600,
                                color: "#1976d2",
                              }}
                            >
                              Parts Details
                            </h4>
                            {partsByTicket[ticket.id] ? (
                              partsByTicket[ticket.id].length > 0 ? (
                                <table
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    background: "#fff",
                                  }}
                                >
                                  <thead>
                                    <tr>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Part Number
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Description
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Quantity
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Price
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Warranty
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        New SN
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Old SN
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {partsByTicket[ticket.id].map((part) => (
                                      <tr key={part.id}>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.partNumber}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.description}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.quantity}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.price}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.warrantyStatus}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.newSN}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {part.oldSN}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={{ margin: 0, color: "#888" }}>
                                  No parts added for this ticket.
                                </p>
                              )
                            ) : (
                              <p style={{ margin: 0 }}>Loading parts...</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
