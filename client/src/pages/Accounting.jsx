import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaReceipt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Accounting() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [partsByTicket, setPartsByTicket] = useState({});
  const [paymentsByTicket, setPaymentsByTicket] = useState({});
  const [refundsByTicket, setRefundsByTicket] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "tickets"),
      where("shouldHaveInvoice", "==", true)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const ticketsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const partsData = {};
      for (const ticket of ticketsData) {
        if (
          ticket.partDeliveryNote &&
          typeof ticket.partDeliveryNote === "string" &&
          ticket.partDeliveryNote.trim() !== ""
        ) {
          const snap = await getDoc(
            doc(db, "partsDeliveryNotes", ticket.partDeliveryNote)
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
    });

    return () => unsubscribe();
  }, []);

  // Fetch parts and payments for a ticket when expanded
  const handleRowClick = async (ticketId) => {
    const newExpandedRow = expandedRow === ticketId ? null : ticketId;
    setExpandedRow(newExpandedRow);

    // If we are expanding a new row, fetch its details
    if (newExpandedRow) {
      // Fetch parts if not already loaded
      if (!partsByTicket[ticketId]) {
        const ticket = tickets.find((t) => t.id === ticketId);
        if (
          ticket &&
          ticket.partDeliveryNote &&
          typeof ticket.partDeliveryNote === "string" &&
          ticket.partDeliveryNote.trim() !== ""
        ) {
          const snap = await getDoc(
            doc(db, "partsDeliveryNotes", ticket.partDeliveryNote)
          );
          if (snap.exists()) {
            const docData = snap.data();
            setPartsByTicket((prev) => ({
              ...prev,
              [ticketId]: Array.isArray(docData.parts) ? docData.parts : [],
            }));
          } else {
            setPartsByTicket((prev) => ({ ...prev, [ticketId]: [] }));
          }
        } else {
          setPartsByTicket((prev) => ({ ...prev, [ticketId]: [] }));
        }
      }

      // Fetch payments if not already loaded
      if (!paymentsByTicket[ticketId]) {
        const paymentsQuery = query(
          collection(db, "tickets", ticketId, "payments")
        );
        onSnapshot(paymentsQuery, (snapshot) => {
          const paymentsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setPaymentsByTicket((prev) => ({
            ...prev,
            [ticketId]: paymentsData,
          }));
        });
      }

      // Fetch refunds if not already loaded
      if (!refundsByTicket[ticketId]) {
        const refundsQuery = query(
          collection(db, "tickets", ticketId, "refunds")
        );
        onSnapshot(refundsQuery, (snapshot) => {
          const refundsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRefundsByTicket((prev) => ({
            ...prev,
            [ticketId]: refundsData,
          }));
        });
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
                              ticket.invoiceStatus === "Paid"
                                ? "#2e7d32"
                                : ticket.status === "Partially Paid"
                                  ? "#e65100"
                                  : "#b71c1c",
                            backgroundColor:
                              ticket.invoiceStatus === "Paid"
                                ? "#c8e6c9"
                                : ticket.invoiceStatus === "Partially Paid"
                                  ? "#ffe0b2"
                                  : "#ffcdd2",
                            border: `1px solid ${
                              ticket.invoiceStatus === "Paid"
                                ? "#2e7d32"
                                : ticket.invoiceStatus === "Partially Paid"
                                  ? "#e65100"
                                  : "#b71c1c"
                            }`,
                            fontWeight: 400,
                            display: "inline-block",
                          }}
                        >
                          {ticket.invoiceStatus || "Pending"}
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
                        <button
                          onClick={() => navigate(`/refund/${ticket.id}`)}
                          disabled={dueAmount <= 0}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: dueAmount > 0 ? "#f44336" : "#ccc",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: dueAmount > 0 ? "pointer" : "not-allowed",
                            marginLeft: "8px",
                          }}
                        >
                          Refund
                        </button>
                      </td>
                    </tr>
                    {expandedRow === ticket.id && (
                      <tr key={ticket.id + "-details"}>
                        <td
                          colSpan={7}
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
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {partsByTicket[ticket.id].map(
                                      (part, index) => (
                                        <tr key={index}>
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
                                        </tr>
                                      )
                                    )}
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

                            {/* Transaction History Section */}
                            <h4
                              style={{
                                margin: "20px 0 12px 0",
                                fontWeight: 600,
                                color: "#1976d2",
                              }}
                            >
                              Transaction History
                            </h4>
                            {(() => {
                              const payments =
                                paymentsByTicket[ticket.id] || [];
                              const refunds = refundsByTicket[ticket.id] || [];

                              if (
                                payments.length === 0 &&
                                refunds.length === 0
                              ) {
                                return (
                                  <p style={{ margin: 0, color: "#888" }}>
                                    No transactions recorded for this ticket.
                                  </p>
                                );
                              }

                              const transactions = [
                                ...payments.map((p) => ({
                                  ...p,
                                  type: "payment",
                                  date: p.paymentDate,
                                })),
                                ...refunds.map((r) => ({
                                  ...r,
                                  type: "refund",
                                  date: r.refundDate,
                                })),
                              ].sort(
                                (a, b) =>
                                  (b.date?.toDate() || 0) -
                                  (a.date?.toDate() || 0)
                              );

                              return (
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
                                        Date
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Type
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Amount
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Method / Reason
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "left",
                                        }}
                                      >
                                        Processed By
                                      </th>
                                      <th
                                        style={{
                                          padding: "8px",
                                          borderBottom: "1px solid #eee",
                                          textAlign: "center",
                                        }}
                                      >
                                        Receipt
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {transactions.map((tx) => (
                                      <tr key={`${tx.type}-${tx.id}`}>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {tx.date?.toDate().toLocaleString() ||
                                            "N/A"}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          <span
                                            style={{
                                              color:
                                                tx.type === "payment"
                                                  ? "green"
                                                  : "red",
                                              textTransform: "capitalize",
                                            }}
                                          >
                                            {tx.type}
                                          </span>
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                            color:
                                              tx.type === "refund"
                                                ? "red"
                                                : "inherit",
                                          }}
                                        >
                                          JOD{" "}
                                          {tx.type === "payment"
                                            ? Number(tx.amount).toFixed(2)
                                            : `-${Number(tx.amount).toFixed(2)}`}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {tx.type === "payment"
                                            ? tx.paymentMethod
                                            : tx.reason}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          {tx.type === "payment"
                                            ? tx.receivedBy
                                            : tx.refundedBy}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #eee",
                                            textAlign: "center",
                                          }}
                                        >
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (tx.type === "payment") {
                                                navigate(
                                                  `/receipt/${ticket.id}/${tx.id}`
                                                );
                                              } else {
                                                navigate(
                                                  `/refund-receipt/${ticket.id}/${tx.id}`
                                                );
                                              }
                                            }}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "#1976d2",
                                            }}
                                          >
                                            <FaReceipt size={20} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              );
                            })()}
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
