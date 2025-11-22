import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../context/userContext";

export default function ReceivePayment() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [parts, setParts] = useState([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(true);
  const { technician } = useUser();

  useEffect(() => {
    async function fetchInvoiceDetails() {
      console.log("Fetching invoice details for ID:", invoiceId);
      setLoading(true);
      try {
        const invoiceRef = doc(db, "modernInvoices", invoiceId);
        console.log("Invoice Ref:", invoiceRef);
        const invoiceSnap = await getDoc(invoiceRef);

        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data();
          setInvoice(invoiceData);
          console.log("Fetched invoice data:", invoiceData);
          setParts(invoiceData.parts || []);
        }
      } catch (error) {
        console.error("Error fetching invoice details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoiceDetails();
  }, [invoiceId]);

  const handlePayment = async () => {
    if (!invoice || !amountPaid || amountPaid <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const totalAmount = parts.reduce(
      (sum, part) => sum + Number(part.price || 0),
      0
    );

    const newAmountPaid = Number(invoice.amountPaid || 0) + Number(amountPaid);

    const newStatus =
      newAmountPaid >= totalAmount
        ? "Paid"
        : newAmountPaid > 0
          ? "Partially Paid"
          : "Pending";

    try {
      // 1. Add a new payment record to the 'payments' subcollection
      const invoiceRef = doc(db, "modernInvoices", invoiceId);
      const ticketRef = doc(db, "tickets", invoice.ticketId);

      const paymentData = invoice.payments || [];

      paymentData.push({
        amount: Number(amountPaid),
        paymentDate: new Date().toISOString(),
        receivedBy: technician.name,
        paymentMethod: paymentMethod,
      });

      // await updateDoc(invoiceRef, { payments: paymentData });
      // invoiceRef.payments = arrayUnion({
      //   amount: Number(amountPaid),
      //   paymentDate: serverTimestamp(),
      //   receivedBy: technician.name,
      //   paymentMethod: paymentMethod,
      // });
      //   paymentMethod: paymentMethod,
      // });

      // 2. Update the total amountPaid and status on the ticket document
      await updateDoc(invoiceRef, {
        payments: paymentData,
        amountPaid: newAmountPaid,
        invoiceStatus: newStatus,
      });

      await updateDoc(ticketRef, {
        invoiceStatus: newStatus,
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
    (invoice?.amountPaid || 0);

  if (loading) return <p>Loading...</p>;
  if (!invoice) return <p>Invoice not found.</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Receive Payment</h2>
      <div style={{ marginBottom: "1rem" }}>
        <h3>Invoice Details</h3>
        <p>
          <strong>Invoice #:</strong> {invoiceId}
        </p>
        <p>
          <strong>Customer:</strong> {invoice.customerName}
        </p>
        <p>
          <strong>Device:</strong> {invoice.machineType}
        </p>
        <p>
          <strong>Status:</strong> {invoice.invoiceStatus || "Pending"}
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

      {invoice && (
        <div style={{ marginBottom: "1rem" }}>
          <h3>Payment Details</h3>
          <p>
            <strong>Amount Paid:</strong> JOD {invoice.amountPaid || 0}
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
          <strong>Amount Paid:</strong> JOD {invoice.amountPaid || 0}
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
        <div style={{ marginTop: "1rem" }}>
          <label>
            Payment Method:
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ marginLeft: "8px", padding: "4px" }}
            >
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </label>
        </div>
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
