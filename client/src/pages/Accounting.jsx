// State and function to fetch and show invoice count

import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
// Handler to create a modernInvoice document for a ticket
const handleCreateInvoice = async (ticket) => {
  try {
    // Compose invoice data as per the required structure
    const invoiceId = `INV${ticket.location}${ticket.ticketNum}`;
    let parts = [];
    let description = "";
    // Fetch parts from partsDeliveryNotes if partDeliveryNote exists
    if (ticket.partDeliveryNote) {
      const snap = await getDoc(
        doc(db, "partsDeliveryNotes", ticket.partDeliveryNote)
      );
      if (snap.exists()) {
        const docData = snap.data();
        if (Array.isArray(docData.parts) && docData.parts.length > 0) {
          parts = docData.parts;
          description = docData.parts.map((p) => p.description).join(", ");
        } else {
          parts = [];
          description = "";
        }
      }
    }

    // Fetch payments from the payments subcollection for this ticket
    let payments = [];
    try {
      const paymentsSnapshot = await getDocs(
        collection(db, "tickets", ticket.id, "payments")
      );
      payments = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (e) {
      payments = [];
    }

    // Fetch refunds from the refunds subcollection for this ticket
    let refunds = [];
    try {
      const refundsSnapshot = await getDocs(
        collection(db, "tickets", ticket.id, "refunds")
      );
      refunds = refundsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          signatureUrl:
            data.signatureUrl && data.signatureUrl.trim() !== ""
              ? data.signatureUrl
              : ticket.customerSignatureURL &&
                  ticket.customerSignatureURL.trim() !== ""
                ? ticket.customerSignatureURL
                : undefined,
        };
      });
    } catch (e) {
      refunds = [];
    }

    const invoiceData = {
      payments,
      refunds,
      customerName: ticket.customerName,
      machineType: ticket.machineType,
      date: ticket.date,
      description,
      emailAddress: ticket.emailAddress || "",
      invoiceStatus: ticket.invoiceStatus || "Pending",
      location: ticket.location || "",
      mobileNumber: ticket.mobileNumber || "",
      parts,
      ticketNum: Number(ticket.ticketNum),
      ticketId: ticket.id,
    };
    console.log("Creating invoice with data:", invoiceData);
    // Save to Firestore (nam5 region is handled by your Firebase config)
    await setDoc(doc(db, "modernInvoices", invoiceId), invoiceData);

    // Update the ticket with invoiceRef
    await updateDoc(doc(db, "tickets", ticket.id), { invoiceRef: invoiceId });

    alert("Invoice created in modernInvoice collection and ticket updated!");
  } catch (err) {
    alert("Failed to create invoice: " + err.message);
  }
};
import { db } from "../firebase";
import { FaReceipt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Accounting() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [expandedInvoiceRow, setExpandedInvoiceRow] = useState(null);
  const [partsByTicket, setPartsByTicket] = useState({});
  const [partsByInvoice, setPartsByInvoice] = useState({});
  const [paymentsByTicket, setPaymentsByTicket] = useState({});
  const [paymentsByInvoice, setPaymentsByInvoice] = useState({});
  const [refundsByTicket, setRefundsByTicket] = useState({});
  const [sortConfig, setSortConfig] = useState({
    column: "ticketNum",
    asc: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const [invoiceCount, setInvoiceCount] = useState(null);
  const [modernInvoices, setModernInvoices] = useState([]);

  useEffect(() => {
    setLoading(true);
    // Listen for tickets with shouldHaveInvoice true (modern tickets)
    // NOTE: removed the inequality on ticketNum from the Firestore query to
    // avoid requiring a composite index. We will filter ticketNum > 11000
    // client-side after receiving the snapshot. If you'd prefer a server-side
    // filter, create the composite index using the URL in the Firestore error.

    const getModernInvoices = async () => {
      setInvoiceLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "modernInvoices"));
        const invoices = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setModernInvoices(invoices);

        setInvoiceLoading(false);
      } catch (err) {
        alert("Failed to fetch invoices: " + err.message);
        setInvoiceLoading(false);
      }
    };

    getModernInvoices();
    const q = query(
      collection(db, "tickets"),
      where("shouldHaveInvoice", "==", true)
    );

    // Also fetch all tickets with a partDeliveryNote (legacy tickets)
    const legacyQ = query(collection(db, "tickets"));

    // Listen for modern tickets
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let ticketsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Client-side filter for ticketNum > 11000 to avoid composite index requirement.
      ticketsData = ticketsData.filter((t) => {
        const n = parseInt(t.ticketNum, 10);
        return !isNaN(n) && n > 11000;
      });

      // Now check for legacy tickets (missing shouldHaveInvoice but have partDeliveryNote)
      const legacySnapshot = await getDocs(collection(db, "tickets"));
      let legacyTickets = [];
      if (legacySnapshot && legacySnapshot.docs) {
        legacyTickets = legacySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((ticket) => {
            // Exclude if current status is 'Repair Marked Complete'
            const statusArr = Array.isArray(ticket.ticketStates)
              ? ticket.ticketStates
              : [];
            const lastStatus =
              statusArr.length > 0 ? statusArr[statusArr.length - 1] : null;
            // Adjust this value if your status code for 'Repair Marked Complete' is different
            const isRepairMarkedComplete =
              lastStatus === 7 || lastStatus === "Repair Marked Complete";
            return (
              (!ticket.shouldHaveInvoice ||
                ticket.shouldHaveInvoice === false) &&
              ticket.partDeliveryNote &&
              typeof ticket.partDeliveryNote === "string" &&
              ticket.partDeliveryNote.trim() !== "" &&
              Number(ticket.ticketNum) >= 11480 &&
              Number(ticket.ticketNum) <= 11499 &&
              !isRepairMarkedComplete
            );
          });
      }

      // For each legacy ticket, check its partsDeliveryNotes for prices > 0
      for (const ticket of legacyTickets) {
        try {
          const snap = await getDoc(
            doc(db, "partsDeliveryNotes", ticket.partDeliveryNote)
          );
          if (snap.exists()) {
            const docData = snap.data();
            console.log("Legacy ticket parts data:", docData);
            // Check for legacy format: arrays of partNumbers, prices, etc.
            let hasInvoice = false;
            if (Array.isArray(docData.prices)) {
              hasInvoice = docData.prices.some((p) => Number(p) > 0);
            }
            // If any price > 0, update ticket to have shouldHaveInvoice: true
            if (hasInvoice) {
              await import("firebase/firestore").then(
                ({ updateDoc, doc: fdoc }) =>
                  updateDoc(fdoc(db, "tickets", ticket.id), {
                    shouldHaveInvoice: true,
                  })
              );
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Now proceed as before for modern tickets
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
            // Support both legacy (array fields) and modern (parts array) formats
            if (Array.isArray(docData.parts) && docData.parts.length > 0) {
              partsData[ticket.id] = docData.parts;
            } else if (
              Array.isArray(docData.partNumbers) &&
              Array.isArray(docData.prices) &&
              Array.isArray(docData.partDescriptions)
            ) {
              // Legacy format: reconstruct part objects from parallel arrays
              const count = Math.max(
                docData.partNumbers.length,
                docData.prices.length,
                docData.partDescriptions.length
              );
              partsData[ticket.id] = Array.from({ length: count }).map(
                (_, i) => ({
                  partNumber: docData.partNumbers[i] || "",
                  price: docData.prices[i] || "",
                  description:
                    docData.partDescriptions[i] === ">"
                      ? "service"
                      : docData.partDescriptions[i],
                  quantity: (docData.qtys && docData.qtys[i]) || "",
                  warrantyStatus:
                    (docData.warrantyStatus && docData.warrantyStatus[i]) || "",
                  newSN:
                    (docData.newSerialNumber && docData.newSerialNumber[i]) ||
                    "",
                  oldSN:
                    (docData.oldSerialNumber && docData.oldSerialNumber[i]) ||
                    "",
                  service: (docData.services && docData.services[i]) || "",
                })
              );
            } else {
              partsData[ticket.id] = [];
            }
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

  const fetchInvoiceCount = async () => {
    try {
      const snapshot = await getDocs(collection(db, "modernInvoices"));
      setInvoiceCount(snapshot.size);
    } catch (err) {
      setInvoiceCount("Error");
    }
  };

  // Function to fetch and print all invoices
  const fetchAndPrintAllInvoices = async () => {
    setInvoiceLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "modernInvoices"));
      const invoices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setModernInvoices(invoices);
      console.log("All invoices:", modernInvoices);
      alert("Invoices printed to console.");
      setInvoiceLoading(false);
    } catch (err) {
      alert("Failed to fetch invoices: " + err.message);
      setInvoiceLoading(false);
    }
  };

  // Fetch parts and payments for a ticket when expanded
  const handleInvoiceRowClick = async (invoiceId) => {
    const newExpandedRow = expandedInvoiceRow === invoiceId ? null : invoiceId;
    setExpandedInvoiceRow(newExpandedRow);

    // If we are expanding a new row, fetch its details
    if (newExpandedRow) {
      const invoice = modernInvoices.find((inv) => inv.id === invoiceId);
      // Fetch parts if not already loaded
      if (!partsByInvoice[invoiceId]) {
        partsByInvoice[invoiceId] = invoice.parts || [];
        setPartsByInvoice({ ...partsByInvoice });
      }

      // Fetch payments if not already loaded
      const payments = invoice.payments || [];
      setPaymentsByInvoice((prev) => ({
        ...prev,
        [invoiceId]: payments,
      }));
      const refunds = invoice.refunds || [];
      setRefundsByTicket((prev) => ({
        ...prev,
        [invoiceId]: refunds,
      }));
    }
  };

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

  // Safe formatter for ticket date which may be a string or Firestore Timestamp
  const formatTicketDate = (d) => {
    if (!d) return "N/A";
    try {
      let dateObj = null;
      if (typeof d === "string") {
        // try parse string into Date, otherwise return date-part fallback
        const parsed = new Date(d);

        if (!isNaN(parsed)) dateObj = parsed;
        else {
          // fallback: try to strip time portion if present (ISO or ' ' separated)
          const datePart = d.split("T")[0].split(" ")[0];
          return datePart || d;
        }
      } else if (d.toDate && typeof d.toDate === "function") {
        dateObj = d.toDate();
      } else {
        dateObj = new Date(d);
      }

      if (!dateObj || isNaN(dateObj)) return String(d);
      return dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return String(d);
    }
  };

  // Safe formatter for ticket date which may be a string or Firestore Timestamp
  const formatTicketDateModern = (d) => {
    if (!d) return "N/A";
    try {
      let dateObj = null;
      if (typeof d === "string") {
        const datePart = d.split("T")[0].split(" ")[0];

        return datePart || d;
        // // try parse string into Date, otherwise return date-part fallback
        // const parsed = new Date(d);
        // console.log("Parsed date:", parsed);
        // if (!isNaN(parsed)) dateObj = parsed;
        // else {
        //   // fallback: try to strip time portion if present (ISO or ' ' separated)
        //   const datePart = d.split("T")[0].split(" ")[0];
        //   console.log("Date part fallback:", datePart);
        //   return datePart || d;
        // }
      } else if (d.toDate && typeof d.toDate === "function") {
        dateObj = d.toDate();
      } else {
        dateObj = new Date(d);
      }

      if (!dateObj || isNaN(dateObj)) return String(d);
      return dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return String(d);
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
      {/* <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={fetchInvoiceCount}
          style={{
            padding: "6px 14px",
            borderRadius: 4,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Show Invoice Count
        </button>
        <button
          onClick={fetchAndPrintAllInvoices}
          style={{
            marginLeft: 12,
            padding: "6px 14px",
            borderRadius: 4,
            background: "#388e3c",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Print All Invoices to Console
        </button>
        {invoiceCount !== null && (
          <span style={{ marginLeft: 16, fontWeight: 600 }}>
            Total Invoices: {invoiceCount}
          </span>
        )}
      </div> */}
      <div style={{ marginBottom: "1rem", maxWidth: 400 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Ticket # or Customer Name"
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "1rem",
            border: "1px solid #ccc",
            borderRadius: 4,
            marginBottom: 0,
          }}
        />
      </div>
      <div>
        {invoiceLoading ? (
          <p>Loading invoices...</p>
        ) : modernInvoices.length === 0 ? (
          <p>No invoices require action.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <h4>Invoices list</h4>
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
                  {[
                    { key: "ticketNum", label: "Ticket #" },
                    { key: "date", label: "Date" },
                    { key: "customerName", label: "Customer" },
                    { key: "machineType", label: "Device" },
                    { key: "invoiceStatus", label: "Status" },
                    { key: "totalAmount", label: "Total Amount" },
                    { key: "dueAmount", label: "Due Amount" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "2px solid #e0e0e0",
                        textAlign: col.key === "Actions" ? "center" : "left",
                        fontWeight: 600,
                        color: "#555",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => {
                        setSortConfig((prev) =>
                          prev.column === col.key
                            ? { column: col.key, asc: !prev.asc }
                            : { column: col.key, asc: true }
                        );
                      }}
                      title={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {sortConfig.column === col.key
                        ? sortConfig.asc
                          ? " ▲"
                          : " ▼"
                        : ""}
                    </th>
                  ))}
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
                {[...modernInvoices]
                  .filter((t) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.trim().toLowerCase();
                    const ticketNumStr = String(
                      t.ticketNum || ""
                    ).toLowerCase();
                    const customerNameStr = String(
                      t.customerName || ""
                    ).toLowerCase();
                    return (
                      ticketNumStr.includes(q) || customerNameStr.includes(q)
                    );
                  })
                  .sort((a, b) => {
                    const { column, asc } = sortConfig;
                    let av, bv;
                    if (column === "ticketNum") {
                      av = parseInt(a.ticketNum, 10) || 0;
                      bv = parseInt(b.ticketNum, 10) || 0;
                    } else if (column === "date") {
                      // Use raw value for sorting, fallback to string
                      av = a.date;
                      bv = b.date;
                      // Try to parse as Date
                      try {
                        av = new Date(av);
                        bv = new Date(bv);
                      } catch {}
                      av = av instanceof Date && !isNaN(av) ? av.getTime() : 0;
                      bv = bv instanceof Date && !isNaN(bv) ? bv.getTime() : 0;
                    } else if (
                      column === "customerName" ||
                      column === "machineType" ||
                      column === "invoiceStatus"
                    ) {
                      av = (a[column] || "").toString().toLowerCase();
                      bv = (b[column] || "").toString().toLowerCase();
                    } else if (column === "totalAmount") {
                      av = partsByTicket[a.id]?.length
                        ? partsByTicket[a.id].reduce(
                            (sum, part) => sum + Number(part.price || 0),
                            0
                          )
                        : 0;
                      bv = partsByTicket[b.id]?.length
                        ? partsByTicket[b.id].reduce(
                            (sum, part) => sum + Number(part.price || 0),
                            0
                          )
                        : 0;
                    } else if (column === "dueAmount") {
                      av = Number(a.amountPaid || 0);
                      bv = Number(b.amountPaid || 0);
                    } else {
                      av = a[column];
                      bv = b[column];
                    }
                    if (av < bv) return asc ? -1 : 1;
                    if (av > bv) return asc ? 1 : -1;
                    return 0;
                  })
                  .map((invoice, idx) => {
                    // Calculate totalAmount based on parts array, default to 0 if parts are undefined or empty
                    const totalAmount =
                      invoice.parts
                        ?.map((p) => Number(p.price || 0))
                        .reduce((a, b) => a + b, 0)
                        .toFixed(2) || "0.00";
                    // const totalAmount = partsByTicket[invoice.id]?.length
                    //   ? Number(
                    //       partsByTicket[invoice.id].reduce(
                    //         (sum, part) => sum + Number(part.price || 0),
                    //         0
                    //       )
                    //     ).toFixed(2)
                    //   : "0.00";
                    // const dueAmount = Number(invoice.amountPaid || 0).toFixed(
                    //   2
                    // );
                    const dueAmount =
                      (invoice.payments
                        ?.map((p) => Number(p.amount || 0))
                        .reduce((a, b) => a + b, 0)
                        .toFixed(2) || "0.00") -
                      (invoice.refunds
                        ?.map((r) => Number(r.amount || 0))
                        .reduce((a, b) => a + b, 0)
                        .toFixed(2) || "0.00");
                    const remainingAmount = totalAmount - dueAmount;
                    // partsByTicket[invoice.id]?.reduce(
                    //   (sum, part) => sum + Number(part.price || 0),
                    //   0
                    // ) - (invoice.amountPaid || 0);

                    return (
                      <>
                        <tr
                          key={invoice.id}
                          style={{
                            background: idx % 2 === 0 ? "#fafafa" : "#fff",
                            cursor: "pointer",
                          }}
                          onClick={() => handleInvoiceRowClick(invoice.id)}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {invoice.location}
                            {invoice.ticketNum}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {formatTicketDateModern(invoice.date)}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {invoice.customerName}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {invoice.machineType}
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
                                  invoice.invoiceStatus === "Paid"
                                    ? "#2e7d32"
                                    : invoice.invoiceStatus === "Partially Paid"
                                      ? "#e65100"
                                      : "#b71c1c",
                                backgroundColor:
                                  invoice.invoiceStatus === "Paid"
                                    ? "#c8e6c9"
                                    : invoice.invoiceStatus === "Partially Paid"
                                      ? "#ffe0b2"
                                      : "#ffcdd2",
                                border: `1px solid ${
                                  invoice.invoiceStatus === "Paid"
                                    ? "#2e7d32"
                                    : invoice.invoiceStatus === "Partially Paid"
                                      ? "#e65100"
                                      : "#b71c1c"
                                }`,
                                fontWeight: 400,
                                display: "inline-block",
                              }}
                            >
                              {invoice.invoiceStatus || "Pending"}
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
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <button
                              onClick={() =>
                                remainingAmount > 0 &&
                                navigate(`/receive-payment/${invoice.id}`)
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
                                  remainingAmount > 0
                                    ? "pointer"
                                    : "not-allowed",
                              }}
                            >
                              Receive Payment (JOD)
                            </button>
                            <button
                              onClick={() => navigate(`/refund/${invoice.id}`)}
                              disabled={dueAmount <= 0}
                              style={{
                                padding: "8px 12px",
                                backgroundColor:
                                  dueAmount > 0 ? "#f44336" : "#ccc",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                cursor:
                                  dueAmount > 0 ? "pointer" : "not-allowed",
                                marginLeft: "8px",
                              }}
                            >
                              Refund
                            </button>
                          </td>
                        </tr>
                        {expandedInvoiceRow === invoice.id && (
                          <tr key={invoice.id + "-details"}>
                            <td
                              colSpan={8}
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
                                {partsByInvoice[invoice.id] ? (
                                  partsByInvoice[invoice.id].length > 0 ? (
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
                                        {partsByInvoice[invoice.id].map(
                                          (part, index) => (
                                            <tr key={index}>
                                              <td
                                                style={{
                                                  padding: "8px",
                                                  borderBottom:
                                                    "1px solid #eee",
                                                }}
                                              >
                                                {part.partNumber}
                                              </td>
                                              <td
                                                style={{
                                                  padding: "8px",
                                                  borderBottom:
                                                    "1px solid #eee",
                                                }}
                                              >
                                                {part.description}
                                              </td>
                                              <td
                                                style={{
                                                  padding: "8px",
                                                  borderBottom:
                                                    "1px solid #eee",
                                                }}
                                              >
                                                {part.quantity}
                                              </td>
                                              <td
                                                style={{
                                                  padding: "8px",
                                                  borderBottom:
                                                    "1px solid #eee",
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
                                    paymentsByInvoice[invoice.id] || [];
                                  const refunds =
                                    refundsByTicket[invoice.id] || [];

                                  if (
                                    payments.length === 0 &&
                                    refunds.length === 0
                                  ) {
                                    return (
                                      <p style={{ margin: 0, color: "#888" }}>
                                        No transactions recorded for this
                                        invoice.
                                      </p>
                                    );
                                  }

                                  const transactions = [
                                    ...payments.map((p, idx) => ({
                                      ...p,
                                      type: "payment",
                                      date: p.paymentDate,
                                      index: idx,
                                    })),
                                    ...refunds.map((r, idx) => ({
                                      ...r,
                                      type: "refund",
                                      date: r.refundDate,
                                      index: idx,
                                    })),
                                  ].sort(
                                    (a, b) =>
                                      (formatTicketDate(b.date) || 0) -
                                      (formatTicketDate(a.date) || 0)
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
                                              {/* {tx.date
                                                ?.toDate()
                                                .toLocaleString() || "N/A"} */}
                                              {formatTicketDate(tx.date)}
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
                                                      `/modern-invoice-payment-receipt/${invoice.id}/${tx.index}`
                                                    );
                                                  } else {
                                                    navigate(
                                                      `/refund-receipt/${invoice.id}/${tx.index}`
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
    </div>
  );
}

// {loading ? (
//           <p>Loading...</p>
//         ) : tickets.length === 0 ? (
//           <p>No tickets require invoices.</p>
//         ) : (
//           <div style={{ overflowX: "auto" }}>
//             <table
//               style={{
//                 width: "100%",
//                 borderCollapse: "collapse",
//                 background: "#fff",
//                 boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
//               }}
//             >
//               <thead style={{ background: "#f5f5f5" }}>
//                 <tr>
//                   {[
//                     { key: "ticketNum", label: "Ticket #" },
//                     { key: "date", label: "Date" },
//                     { key: "customerName", label: "Customer" },
//                     { key: "machineType", label: "Device" },
//                     { key: "invoiceStatus", label: "Status" },
//                     { key: "totalAmount", label: "Total Amount" },
//                     { key: "dueAmount", label: "Due Amount" },
//                   ].map((col) => (
//                     <th
//                       key={col.key}
//                       style={{
//                         padding: "12px 16px",
//                         borderBottom: "2px solid #e0e0e0",
//                         textAlign: col.key === "Actions" ? "center" : "left",
//                         fontWeight: 600,
//                         color: "#555",
//                         cursor: "pointer",
//                         userSelect: "none",
//                       }}
//                       onClick={() => {
//                         setSortConfig((prev) =>
//                           prev.column === col.key
//                             ? { column: col.key, asc: !prev.asc }
//                             : { column: col.key, asc: true }
//                         );
//                       }}
//                       title={`Sort by ${col.label}`}
//                     >
//                       {col.label}
//                       {sortConfig.column === col.key
//                         ? sortConfig.asc
//                           ? " ▲"
//                           : " ▼"
//                         : ""}
//                     </th>
//                   ))}
//                   <th
//                     style={{
//                       padding: "12px 16px",
//                       borderBottom: "2px solid #e0e0e0",
//                       textAlign: "center",
//                       fontWeight: 600,
//                       color: "#555",
//                     }}
//                   >
//                     Actions
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {[...tickets]
//                   .filter((t) => {
//                     if (!searchQuery.trim()) return true;
//                     const q = searchQuery.trim().toLowerCase();
//                     const ticketNumStr = String(
//                       t.ticketNum || ""
//                     ).toLowerCase();
//                     const customerNameStr = String(
//                       t.customerName || ""
//                     ).toLowerCase();
//                     return (
//                       ticketNumStr.includes(q) || customerNameStr.includes(q)
//                     );
//                   })
//                   .sort((a, b) => {
//                     const { column, asc } = sortConfig;
//                     let av, bv;
//                     if (column === "ticketNum") {
//                       av = parseInt(a.ticketNum, 10) || 0;
//                       bv = parseInt(b.ticketNum, 10) || 0;
//                     } else if (column === "date") {
//                       // Use raw value for sorting, fallback to string
//                       av = a.date;
//                       bv = b.date;
//                       // Try to parse as Date
//                       try {
//                         av = new Date(av);
//                         bv = new Date(bv);
//                       } catch {}
//                       av = av instanceof Date && !isNaN(av) ? av.getTime() : 0;
//                       bv = bv instanceof Date && !isNaN(bv) ? bv.getTime() : 0;
//                     } else if (
//                       column === "customerName" ||
//                       column === "machineType" ||
//                       column === "invoiceStatus"
//                     ) {
//                       av = (a[column] || "").toString().toLowerCase();
//                       bv = (b[column] || "").toString().toLowerCase();
//                     } else if (column === "totalAmount") {
//                       av = partsByTicket[a.id]?.length
//                         ? partsByTicket[a.id].reduce(
//                             (sum, part) => sum + Number(part.price || 0),
//                             0
//                           )
//                         : 0;
//                       bv = partsByTicket[b.id]?.length
//                         ? partsByTicket[b.id].reduce(
//                             (sum, part) => sum + Number(part.price || 0),
//                             0
//                           )
//                         : 0;
//                     } else if (column === "dueAmount") {
//                       av = Number(a.amountPaid || 0);
//                       bv = Number(b.amountPaid || 0);
//                     } else {
//                       av = a[column];
//                       bv = b[column];
//                     }
//                     if (av < bv) return asc ? -1 : 1;
//                     if (av > bv) return asc ? 1 : -1;
//                     return 0;
//                   })
//                   .map((ticket, idx) => {
//                     // Calculate totalAmount based on parts array, default to 0 if parts are undefined or empty
//                     const totalAmount = partsByTicket[ticket.id]?.length
//                       ? Number(
//                           partsByTicket[ticket.id].reduce(
//                             (sum, part) => sum + Number(part.price || 0),
//                             0
//                           )
//                         ).toFixed(2)
//                       : "0.00";
//                     const dueAmount = Number(ticket.amountPaid || 0).toFixed(2);
//                     const remainingAmount =
//                       partsByTicket[ticket.id]?.reduce(
//                         (sum, part) => sum + Number(part.price || 0),
//                         0
//                       ) - (ticket.amountPaid || 0);

//                     return (
//                       <>
//                         <tr
//                           key={ticket.id}
//                           style={{
//                             background: idx % 2 === 0 ? "#fafafa" : "#fff",
//                             cursor: "pointer",
//                           }}
//                           onClick={() => handleRowClick(ticket.id)}
//                         >
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {ticket.location}
//                             {ticket.ticketNum}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {formatTicketDate(ticket.date)}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {ticket.customerName}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {ticket.machineType}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             <span
//                               style={{
//                                 padding: "4px 8px",
//                                 borderRadius: "12px",
//                                 color:
//                                   ticket.invoiceStatus === "Paid"
//                                     ? "#2e7d32"
//                                     : ticket.status === "Partially Paid"
//                                       ? "#e65100"
//                                       : "#b71c1c",
//                                 backgroundColor:
//                                   ticket.invoiceStatus === "Paid"
//                                     ? "#c8e6c9"
//                                     : ticket.invoiceStatus === "Partially Paid"
//                                       ? "#ffe0b2"
//                                       : "#ffcdd2",
//                                 border: `1px solid ${
//                                   ticket.invoiceStatus === "Paid"
//                                     ? "#2e7d32"
//                                     : ticket.invoiceStatus === "Partially Paid"
//                                       ? "#e65100"
//                                       : "#b71c1c"
//                                 }`,
//                                 fontWeight: 400,
//                                 display: "inline-block",
//                               }}
//                             >
//                               {ticket.invoiceStatus || "Pending"}
//                             </span>
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {`JOD ${totalAmount}`}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                             }}
//                           >
//                             {`JOD ${dueAmount}`}
//                           </td>
//                           <td
//                             style={{
//                               padding: "10px 16px",
//                               borderBottom: "1px solid #eee",
//                               textAlign: "center",
//                               display: "flex",
//                               alignItems: "center",
//                               gap: "6px",
//                             }}
//                           >
//                             <button
//                               onClick={() =>
//                                 remainingAmount > 0 &&
//                                 navigate(`/receive-payment/${ticket.id}`)
//                               }
//                               disabled={remainingAmount <= 0}
//                               style={{
//                                 padding: "8px 12px",
//                                 backgroundColor:
//                                   remainingAmount > 0 ? "#1976d2" : "#ccc",
//                                 color: "#fff",
//                                 border: "none",
//                                 borderRadius: "4px",
//                                 cursor:
//                                   remainingAmount > 0
//                                     ? "pointer"
//                                     : "not-allowed",
//                               }}
//                             >
//                               Receive Payment (JOD)
//                             </button>
//                             <button
//                               onClick={() => navigate(`/refund/${ticket.id}`)}
//                               disabled={dueAmount <= 0}
//                               style={{
//                                 padding: "8px 12px",
//                                 backgroundColor:
//                                   dueAmount > 0 ? "#f44336" : "#ccc",
//                                 color: "#fff",
//                                 border: "none",
//                                 borderRadius: "4px",
//                                 cursor:
//                                   dueAmount > 0 ? "pointer" : "not-allowed",
//                                 marginLeft: "8px",
//                               }}
//                             >
//                               Refund
//                             </button>
//                             <button
//                               title="Create Invoice Document"
//                               onClick={(e) => {
//                                 e.stopPropagation();
//                                 handleCreateInvoice(ticket);
//                               }}
//                               style={{
//                                 marginLeft: "8px",
//                                 padding: "6px 10px",
//                                 backgroundColor: "#4caf50",
//                                 color: "#fff",
//                                 border: "none",
//                                 borderRadius: "4px",
//                                 cursor: "pointer",
//                                 fontSize: "0.9rem",
//                               }}
//                             >
//                               + Invoice
//                             </button>
//                           </td>
//                         </tr>
//                         {expandedRow === ticket.id && (
//                           <tr key={ticket.id + "-details"}>
//                             <td
//                               colSpan={8}
//                               style={{ background: "#f9f9f9", padding: "0" }}
//                             >
//                               <div style={{ padding: "16px" }}>
//                                 <h4
//                                   style={{
//                                     margin: "0 0 12px 0",
//                                     fontWeight: 600,
//                                     color: "#1976d2",
//                                   }}
//                                 >
//                                   Parts Details
//                                 </h4>
//                                 {partsByTicket[ticket.id] ? (
//                                   partsByTicket[ticket.id].length > 0 ? (
//                                     <table
//                                       style={{
//                                         width: "100%",
//                                         borderCollapse: "collapse",
//                                         background: "#fff",
//                                       }}
//                                     >
//                                       <thead>
//                                         <tr>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Part Number
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Description
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Quantity
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Price
//                                           </th>
//                                         </tr>
//                                       </thead>
//                                       <tbody>
//                                         {partsByTicket[ticket.id].map(
//                                           (part, index) => (
//                                             <tr key={index}>
//                                               <td
//                                                 style={{
//                                                   padding: "8px",
//                                                   borderBottom:
//                                                     "1px solid #eee",
//                                                 }}
//                                               >
//                                                 {part.partNumber}
//                                               </td>
//                                               <td
//                                                 style={{
//                                                   padding: "8px",
//                                                   borderBottom:
//                                                     "1px solid #eee",
//                                                 }}
//                                               >
//                                                 {part.description}
//                                               </td>
//                                               <td
//                                                 style={{
//                                                   padding: "8px",
//                                                   borderBottom:
//                                                     "1px solid #eee",
//                                                 }}
//                                               >
//                                                 {part.quantity}
//                                               </td>
//                                               <td
//                                                 style={{
//                                                   padding: "8px",
//                                                   borderBottom:
//                                                     "1px solid #eee",
//                                                 }}
//                                               >
//                                                 {part.price}
//                                               </td>
//                                             </tr>
//                                           )
//                                         )}
//                                       </tbody>
//                                     </table>
//                                   ) : (
//                                     <p style={{ margin: 0, color: "#888" }}>
//                                       No parts added for this ticket.
//                                     </p>
//                                   )
//                                 ) : (
//                                   <p style={{ margin: 0 }}>Loading parts...</p>
//                                 )}

//                                 {/* Transaction History Section */}
//                                 <h4
//                                   style={{
//                                     margin: "20px 0 12px 0",
//                                     fontWeight: 600,
//                                     color: "#1976d2",
//                                   }}
//                                 >
//                                   Transaction History
//                                 </h4>
//                                 {(() => {
//                                   const payments =
//                                     paymentsByTicket[ticket.id] || [];
//                                   const refunds =
//                                     refundsByTicket[ticket.id] || [];

//                                   if (
//                                     payments.length === 0 &&
//                                     refunds.length === 0
//                                   ) {
//                                     return (
//                                       <p style={{ margin: 0, color: "#888" }}>
//                                         No transactions recorded for this
//                                         ticket.
//                                       </p>
//                                     );
//                                   }

//                                   const transactions = [
//                                     ...payments.map((p) => ({
//                                       ...p,
//                                       type: "payment",
//                                       date: p.paymentDate,
//                                     })),
//                                     ...refunds.map((r) => ({
//                                       ...r,
//                                       type: "refund",
//                                       date: r.refundDate,
//                                     })),
//                                   ].sort(
//                                     (a, b) =>
//                                       (b.date?.toDate() || 0) -
//                                       (a.date?.toDate() || 0)
//                                   );

//                                   return (
//                                     <table
//                                       style={{
//                                         width: "100%",
//                                         borderCollapse: "collapse",
//                                         background: "#fff",
//                                       }}
//                                     >
//                                       <thead>
//                                         <tr>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Date
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Type
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Amount
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Method / Reason
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "left",
//                                             }}
//                                           >
//                                             Processed By
//                                           </th>
//                                           <th
//                                             style={{
//                                               padding: "8px",
//                                               borderBottom: "1px solid #eee",
//                                               textAlign: "center",
//                                             }}
//                                           >
//                                             Receipt
//                                           </th>
//                                         </tr>
//                                       </thead>
//                                       <tbody>
//                                         {transactions.map((tx) => (
//                                           <tr key={`${tx.type}-${tx.id}`}>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                               }}
//                                             >
//                                               {/* {tx.date
//                                                 ?.toDate()
//                                                 .toLocaleString() || "N/A"} */}
//                                               {formatTicketDate(
//                                                 tx.date?.toDate() || null
//                                               )}
//                                             </td>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                               }}
//                                             >
//                                               <span
//                                                 style={{
//                                                   color:
//                                                     tx.type === "payment"
//                                                       ? "green"
//                                                       : "red",
//                                                   textTransform: "capitalize",
//                                                 }}
//                                               >
//                                                 {tx.type}
//                                               </span>
//                                             </td>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                                 color:
//                                                   tx.type === "refund"
//                                                     ? "red"
//                                                     : "inherit",
//                                               }}
//                                             >
//                                               JOD{" "}
//                                               {tx.type === "payment"
//                                                 ? Number(tx.amount).toFixed(2)
//                                                 : `-${Number(tx.amount).toFixed(2)}`}
//                                             </td>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                               }}
//                                             >
//                                               {tx.type === "payment"
//                                                 ? tx.paymentMethod
//                                                 : tx.reason}
//                                             </td>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                               }}
//                                             >
//                                               {tx.type === "payment"
//                                                 ? tx.receivedBy
//                                                 : tx.refundedBy}
//                                             </td>
//                                             <td
//                                               style={{
//                                                 padding: "8px",
//                                                 borderBottom: "1px solid #eee",
//                                                 textAlign: "center",
//                                               }}
//                                             >
//                                               <button
//                                                 onClick={(e) => {
//                                                   e.stopPropagation();
//                                                   if (tx.type === "payment") {
//                                                     navigate(
//                                                       `/receipt/${ticket.id}/${tx.id}`
//                                                     );
//                                                   } else {
//                                                     navigate(
//                                                       `/refund-receipt/${ticket.id}/${tx.id}`
//                                                     );
//                                                   }
//                                                 }}
//                                                 style={{
//                                                   background: "none",
//                                                   border: "none",
//                                                   cursor: "pointer",
//                                                   color: "#1976d2",
//                                                 }}
//                                               >
//                                                 <FaReceipt size={20} />
//                                               </button>
//                                             </td>
//                                           </tr>
//                                         ))}
//                                       </tbody>
//                                     </table>
//                                   );
//                                 })()}
//                               </div>
//                             </td>
//                           </tr>
//                         )}
//                       </>
//                     );
//                   })}
//               </tbody>
//             </table>
//           </div>
//         )}
