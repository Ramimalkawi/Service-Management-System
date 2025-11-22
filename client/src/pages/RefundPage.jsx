import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../context/userContext";
import "./RefundPage.css";

const RefundPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { technician } = useUser();
  const [invoice, setInvoice] = useState(null);
  const [amountToRefund, setAmountToRefund] = useState("");
  const [refundReason, setRefundReason] = useState("Discount");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setLoading(true);
      try {
        const invoiceRef = doc(db, "modernInvoices", invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);

        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data();
          setInvoice(invoiceData);
          setTotalPaid(invoiceData.amountPaid || 0);
        } else {
          setError("Invoice not found.");
        }
      } catch (err) {
        setError("Failed to fetch invoice details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId]);

  const handleRefund = async (e) => {
    e.preventDefault();

    if (!technician) {
      setError("You must be logged in to process a refund.");
      return;
    }

    const refundAmount = parseFloat(amountToRefund);

    if (isNaN(refundAmount) || refundAmount <= 0) {
      setError("Please enter a valid refund amount.");
      return;
    }

    if (refundAmount > totalPaid) {
      setError(
        `Cannot refund more than the total amount paid (JOD ${totalPaid.toFixed(2)}).`
      );
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // 1. Add a refund transaction to a new 'refunds' subcollection
      const invoiceRef = doc(db, "modernInvoices", invoiceId);
      const ticketRef = doc(db, "tickets", invoice.ticketId);

      const refundData = invoice.refunds || [];

      refundData.push({
        amount: refundAmount,
        refundDate: new Date().toISOString(),
        refundMethod: "Cash", // Always cash
        reason: refundReason, // Add the reason
        refundedBy: technician?.name || "N/A",
      });

      // 2. Update the amountPaid on the ticket
      const newAmountPaid = totalPaid - refundAmount;

      await updateDoc(doc(db, "modernInvoices", invoiceId), {
        refunds: refundData,
        amountPaid: newAmountPaid,
        invoiceStatus:
          totalPaid - refundAmount > 0 ? "Partially Paid" : "Refunded",
      });

      await updateDoc(ticketRef, {
        invoiceStatus:
          totalPaid - refundAmount > 0 ? "Partially Paid" : "Refunded",
      });

      alert("Refund processed successfully!");
      navigate(`/refund-receipt/${invoiceId}/${refundData.length - 1}`);
    } catch (err) {
      setError("Failed to process refund.");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="refund-page-container">
      {error && <div className="error-message">Error: {error}</div>}
      <h2>
        Process Refund for Ticket #{invoice?.location}
        {invoice?.ticketNum}
      </h2>
      <div className="ticket-summary">
        <p>
          <strong>Customer:</strong> {invoice?.customerName}
        </p>
        <p>
          <strong>Total Amount Paid:</strong> JOD {totalPaid.toFixed(2)}
        </p>
      </div>
      <form onSubmit={handleRefund}>
        <div className="form-group">
          <label htmlFor="amountToRefund">Amount to Refund (JOD)</label>
          <input
            id="amountToRefund"
            type="number"
            step="0.01"
            value={amountToRefund}
            onChange={(e) => setAmountToRefund(e.target.value)}
            placeholder="Enter amount to refund"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="refundReason">Reason for Refund</label>
          <select
            id="refundReason"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          >
            <option value="Discount">Discount</option>
            <option value="Problem wasn't solved">Problem wasn't solved</option>
            <option value="Customer refused the repair">
              Customer refused the repair
            </option>
          </select>
        </div>
        <button type="submit" className="btn-submit" disabled={processing}>
          {processing ? "Processing..." : "Process Refund"}
        </button>
      </form>
    </div>
  );
};

export default RefundPage;
