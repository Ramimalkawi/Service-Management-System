// ProcessTicketPage.jsx
import { useNavigate, useParams } from "react-router-dom";
import Modal from "react-modal";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { useEffect, useState } from "react";
import "./ProcessTicketPage.css";
import { useUser } from "../context/userContext";
import TechnicalReportModal from "../components/TechnicalReportModal";
import { useRef } from "react";
import PartsModal from "../components/PartsModal";
import PriceQuotationModal from "../components/PriceQuotationModal";
import { API_ENDPOINTS } from "../config/api";
import MediaModal from "../components/MediaModal";
import TicketStatusTimeline from "../components/TicketStatusTimeline";

Modal.setAppElement("#root"); // for accessibility
const statusOptions = [
  "Start",
  "VMI Troubleshooting",
  "Repair Released from Processing",
  "Awaiting Parts",
  "Parts Allocated",
  "In Repair",
  "Ready For Pickup",
];

const statusMap = {
  0: "Start",
  1: "VMI Troubleshooting",
  2: "Repair Released from Processing",
  3: "Awaiting Parts",
  4: "Parts Allocated",
  5: "In Repair",
  6: "Ready For Pickup",
};

const emailHeaderLogo =
  "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";

const emailFooterLogo =
  "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/email_logo.png?alt=media&token=8691c5b9-a58b-4076-891c-d1d3d4275a6b";

const ProcessTicketPage = () => {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);
  const { id } = useParams();
  const { technician } = useUser();
  const [ticket, setTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState(0);
  const [note, setNote] = useState("");
  const [newRepairID, setNewRepairID] = useState("");

  const [isPartsModalOpen, setIsPartsModalOpen] = useState(false);
  const [isPriceQuotationModalOpen, setIsPriceQuotationModalOpen] =
    useState(false);
  // State to hold part info to pass to PriceQuotationModal
  const [pendingQuotationPart, setPendingQuotationPart] = useState(null);
  const [mediaURLs, setMediaURLs] = useState([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const storage = getStorage();
  const openPartsModal = () => setIsPartsModalOpen(true);
  const closePartsModal = () => setIsPartsModalOpen(false);
  const openPriceQuotationModal = (partInfo) => {
    if (partInfo) setPendingQuotationPart(partInfo);
    setIsPriceQuotationModalOpen(true);
  };
  // Refetch ticket after closing price quotation modal to get updated priceQuotationRef
  const fetchTicket = async () => {
    const docRef = doc(db, "tickets", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const latestStatusIndex = data.ticketStates?.slice(-1)[0] || 0;
      setTicket({ id: docSnap.id, ...data });
      setCurrentStatusIndex(latestStatusIndex);
      setSelectedStatus(latestStatusIndex);
    }
  };

  // Admin-only: revert ticket status backward
  const handleRevertStatus = async () => {
    if (
      !ticket ||
      !Array.isArray(ticket.ticketStates) ||
      ticket.ticketStates.length <= 1
    ) {
      alert("Cannot revert status further.");
      return;
    }
    // Prevent revert if last status is 'Repair Marked Complete' (status 7)
    const lastStatus = ticket.ticketStates[ticket.ticketStates.length - 1];
    if (lastStatus === 7 || lastStatus === "Repair Marked Complete") {
      alert(
        "Cannot revert status: Ticket is marked as 'Repair Marked Complete'."
      );
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to revert the ticket status? This will remove the last status, technician, and note."
      )
    )
      return;
    const docRef = doc(db, "tickets", ticket.id);
    const newStates = ticket.ticketStates.slice(0, -1);
    const newTechs = Array.isArray(ticket.technicions)
      ? ticket.technicions.slice(0, -1)
      : [];
    const newDetails = Array.isArray(ticket.details)
      ? ticket.details.slice(0, -1)
      : [];
    await updateDoc(docRef, {
      ticketStates: newStates,
      technicions: newTechs,
      details: newDetails,
    });
    setTicket((prev) => ({
      ...prev,
      ticketStates: newStates,
      technicions: newTechs,
      details: newDetails,
    }));
    setCurrentStatusIndex(newStates[newStates.length - 1] || 0);
    setSelectedStatus(newStates[newStates.length - 1] || 0);
    alert("Ticket status reverted successfully.");
  };

  const closePriceQuotationModal = () => {
    setIsPriceQuotationModalOpen(false);
    setPendingQuotationPart(null);
    // Refetch ticket to get updated priceQuotationRef
    setTimeout(fetchTicket, 300); // slight delay to ensure DB update
  };

  useEffect(() => {
    const fetchTicketAndMedia = async () => {
      const docRef = doc(db, "tickets", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const latestStatusIndex = data.ticketStates?.slice(-1)[0] || 0;
        setTicket({ id: docSnap.id, ...data });
        setCurrentStatusIndex(latestStatusIndex);
        setSelectedStatus(latestStatusIndex);
        if (data.mediaURLs)
          try {
            const urls = await Promise.all(
              data.mediaURLs.map(async (path) => {
                const fileRef = ref(storage, path);
                return await getDownloadURL(fileRef);
              })
            );
            setMediaURLs(urls);
          } catch (error) {
            console.error("Failed to fetch media URLs:", error);
          }
        setLoading(false);
      }
    };
    fetchTicketAndMedia();
  }, [id]);

  const handleUpdateStatus = async () => {
    // If status is Parts Allocated (index 4), send parts arrival email
    if (parseInt(selectedStatus) === 4) {
      await sendPartsAllocatedEmail();
    }

    if (!note.trim()) {
      alert("Please add a note.");
      return;
    }
    setStatusUpdating(true);
    const docRef = doc(db, "tickets", id);

    const now = new Date();
    const formattedTime = now.toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const technicianName = technician?.name || "Unknown Technician";
    const fullNote = `[${formattedTime}] ${technicianName}: ${note.trim()}`;

    const updates = {
      ticketStates: [...ticket.ticketStates, parseInt(selectedStatus)],
      details: [...(ticket.details || []), fullNote],
      technicions: [...ticket.technicions, technicianName],
    };

    if (selectedStatus === 1) {
      updates.approvalRequired = true;
      updates.approvalStatus = "pending";
    }

    // If status is Ready For Pickup, check for parts delivery note and prices
    let invoiceMessage = "";
    if (parseInt(selectedStatus) === 6) {
      if (
        ticket.partDeliveryNote &&
        typeof ticket.partDeliveryNote === "string" &&
        ticket.partDeliveryNote.trim() !== ""
      ) {
        // Fetch parts delivery note document
        try {
          const partsDocRef = doc(
            db,
            "partsDeliveryNotes",
            ticket.partDeliveryNote
          );
          const partsSnap = await getDoc(partsDocRef);
          if (partsSnap.exists()) {
            const partsData = partsSnap.data();
            if (Array.isArray(partsData.parts)) {
              const hasPricedPart = partsData.parts.some(
                (part) => Number(part.price) > 0
              );
              if (hasPricedPart) {
                updates.shouldHaveInvoice = true;
                invoiceMessage =
                  "This ticket now requires an invoice because at least one part has a price.";
              }
            }
          }
        } catch (err) {
          console.error("Error checking parts for invoice:", err);
        }
      }
      await sendReadyForPickupEmail();
    }

    await updateDoc(docRef, updates);

    let finalMessage = "Status and note updated successfully";
    if (invoiceMessage) {
      finalMessage += "\n" + invoiceMessage;
    }
    alert(finalMessage);

    setTicket((prev) => ({
      ...prev,
      ticketStates: [...prev.ticketStates, parseInt(selectedStatus)],
      details: [...(prev.details || []), fullNote],
      technicions: [...prev.technicions, technician.name],
      approvalRequired: selectedStatus === 1 ? true : prev.approvalRequired,
      approvalStatus: selectedStatus === 1 ? "pending" : prev.approvalStatus,
      shouldHaveInvoice:
        parseInt(selectedStatus) === 6 && updates.shouldHaveInvoice
          ? true
          : prev.shouldHaveInvoice,
    }));

    setNote("");
    setStatusUpdating(false);
  };

  // Email to notify customer that parts have arrived and repair is starting
  const sendPartsAllocatedEmail = async () => {
    try {
      const currentDateTime = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const companyEmail =
        ticket.location === "M"
          ? "help@365solutionsjo.com"
          : "irbid@365solutionsjo.com";
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
            .header { background-color: #1ccad4; color: white; padding: 20px; text-align: center; }
            .logo-img { max-height: 60px; margin-bottom: 10px; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .ticket-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .info-row { margin: 8px 0; }
            .label { font-weight: bold; color: #333; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .footer-logo-img { max-height: 40px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <img src="${emailHeaderLogo}" alt="365Solutions Logo" class="logo-img" />
              <h2>Parts Have Arrived – Repair in Progress</h2>
              <p>365Solutions - Apple Authorized Service Center</p>
            </div>
            <div class="content">
              <p>Dear ${ticket.customerName},</p>
              <p>We are pleased to inform you that the parts required to complete the repair of your device have arrived at our service center. Our technicians have started the process of exchanging the old parts with the new ones.</p>
              <div class="ticket-info">
                <h3 style="color: #1ccad4;">Ticket Details</h3>
                <div class="info-row">
                  <span class="label">Ticket Number:</span> ${ticket.location}${ticket.ticketNum}
                </div>
                <div class="info-row">
                  <span class="label">Device Type:</span> ${ticket.machineType}
                </div>
                <div class="info-row">
                  <span class="label">Serial Number:</span> ${ticket.serialNum}
                </div>
                <div class="info-row">
                  <span class="label">Original Issue:</span> ${ticket.symptom}
                </div>
                ${ticket.caseID ? `<div class="info-row"><span class="label">Repair ID:</span> ${ticket.caseID}</div>` : ""}
                <div class="info-row">
                  <span class="label">Status:</span> Parts Allocated & Repair Started
                </div>
                <div class="info-row">
                  <span class="label">Date:</span> ${currentDateTime}
                </div>
              </div>
              <p>If you have any questions or need further information, please contact us at <a href="mailto:${companyEmail}">${companyEmail}</a>.</p>
              <p>Thank you for your patience and for choosing 365Solutions for your device repair needs.</p>
              <div class="footer">
                <img src="${emailFooterLogo}" alt="365Solutions Logo" class="footer-logo-img" />
                <p>365Solutions - Apple Authorized Service Provider</p>
                <p>Email: <a href="mailto:${companyEmail}">${companyEmail}</a></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: ticket.emailAddress,
        subject: `Parts Arrived – Repair in Progress (Ticket #${ticket.location}${ticket.ticketNum})`,
        html: emailHtml,
        location: ticket.location,
      };

      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        console.log("Parts allocated email sent successfully");
      } else {
        console.error("Failed to send parts allocated email");
      }
    } catch (error) {
      console.error("Error sending parts allocated email:", error);
    }
  };

  const sendReadyForPickupEmail = async () => {
    try {
      const currentDateTime = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .logo-img { max-height: 60px; margin-bottom: 10px; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .ticket-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .info-row { margin: 8px 0; }
            .label { font-weight: bold; color: #333; }
            .pickup-notice { 
              background-color: #d4edda; 
              border: 1px solid #c3e6cb; 
              color: #155724; 
              padding: 15px; 
              border-radius: 8px; 
              margin: 15px 0; 
            }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .footer-logo-img { max-height: 40px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <img src="${emailHeaderLogo}" alt="365Solutions Logo" class="logo-img" />
              <h2>🎉 Your Device is Ready for Pickup!</h2>
              <p>365Solutions - Apple Authorized Service Center</p>
            </div>
            
            <div class="content">
              <p>Dear ${ticket.customerName},</p>
              
              <p><strong>Great news!</strong> Your device has been successfully repaired and is now ready for pickup.</p>
              
              <div class="pickup-notice">
                <h3 style="margin-top: 0;">📍 Ready for Pickup</h3>
                <p>Your device is waiting for you at our service center. Please bring a valid ID and your service receipt when collecting your device.</p>
              </div>
              
              <div class="ticket-info">
                <h3 style="color: #28a745;">Service Completion Details</h3>
                <div class="info-row">
                  <span class="label">Ticket Number:</span> ${ticket.location}${
                    ticket.ticketNum
                  }
                </div>
                <div class="info-row">
                  <span class="label">Completion Date:</span> ${currentDateTime}
                </div>
                <div class="info-row">
                  <span class="label">Device Type:</span> ${ticket.machineType}
                </div>
                <div class="info-row">
                  <span class="label">Serial Number:</span> ${ticket.serialNum}
                </div>
                <div class="info-row">
                  <span class="label">Original Issue:</span> ${ticket.symptom}
                </div>
                ${
                  ticket.caseID
                    ? `<div class="info-row"><span class="label">Repair ID:</span> ${ticket.caseID}</div>`
                    : ""
                }
              </div>
              
              <div style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 8px;">
                <h3 style="color: #1ccad4;">Pickup Information</h3>
                <p><strong>Service Center Location:</strong></p>
                <p>${
                  ticket.location === "M" ? "Amman Branch" : "Irbid Branch"
                }</p>
                
                <p><strong>Business Hours:</strong></p>
                <ul>
                ${
                  ticket.location === "M"
                    ? `<li>Sunday - Thursday: 9:00 AM - 9:00 PM</li>
                  <li>Saturday: 10:00 AM - 9:00 PM</li>
                  `
                    : `<li>Saturday - Thursday: 10:00 AM - 9:00 PM</li>`
                }
                  
                  <li>Friday: Closed</li>
                </ul>
                
                
                
                <p><strong>What to bring:</strong></p>
                <ul>
                  <li>Valid photo ID</li>
                  <li>Service receipt or ticket number</li>
                  <li>Payment method (if applicable)</li>
                </ul>
              </div>
              
              <p><strong>Contact Information:</strong></p>
              <ul>
                <li>Email: ${
                  ticket.location === "M"
                    ? "help@365solutionsjo.com"
                    : "irbid@365solutionsjo.com"
                }</li>
                <li>Phone: ${
                  ticket.location === "M"
                    ? "+962-79-681-8189"
                    : "+962-79-668-8831"
                }</li>
              </ul>
              
              <p>Thank you for choosing 365Solutions for your device repair needs. We appreciate your patience and look forward to serving you again.</p>
              
              <div class="footer">
                <img src="${emailFooterLogo}" alt="365Solutions Logo" class="footer-logo-img" />
                <p>365Solutions - Apple Authorized Service Provider</p>
                <p>Professional device repair services you can trust</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: ticket.emailAddress,
        subject: `🎉 Device Ready for Pickup - Ticket #${ticket.location}${ticket.ticketNum}`,
        html: emailHtml,
        location: ticket.location,
      };

      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        console.log("Ready for pickup email sent successfully");
      } else {
        console.error("Failed to send ready for pickup email");
      }
    } catch (error) {
      console.error("Error sending ready for pickup email:", error);
      // Don't throw error to avoid interrupting status update
    }
  };

  // handleUpdateRepairID removed; logic now inline in button above

  if (loading) return <div className="loading">Loading ticket...</div>;

  return (
    <div className="process-ticket-layout">
      <button
        style={{
          marginBottom: 16,
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "8px 16px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
        onClick={() => navigate(`/tickets/${id}`)}
      >
        ← Back to Tickets
      </button>
      <div className="process-ticket-container">
        {/* Admin-only: Revert status button */}
        {technician?.permission === "Admin" &&
          ticket.ticketStates?.length > 1 && (
            <button
              style={{
                marginBottom: 16,
                background: "#e53935",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "8px 16px",
                cursor: "pointer",
              }}
              onClick={handleRevertStatus}
            >
              Revert Ticket Status (Admin Only)
            </button>
          )}
        {ticket.approvalRequired && (
          <div className="approval-toast">
            <span className="pulse-indicator" />
            <div className="approval-message">
              <strong>Approval Needed</strong>: This ticket is currently
              awaiting admin approval. You can only select the final steps.
            </div>
          </div>
        )}
        {ticket.approvalStatus === "rejected" && (
          <div className="rejected-banner">
            ❌ This ticket has been <strong>rejected</strong> by the admin.
          </div>
        )}

        <div className="ticket-info-grid">
          <div className="ticket-info-item">
            <div style={{ display: "flex", gap: "16px", width: "100%" }}>
              <div style={{ flexGrow: 1 }}>
                <label>Ticket#:</label>
                <span>
                  {ticket.location}
                  {ticket.ticketNum}
                </span>
              </div>
              <div style={{ flexGrow: 1 }}>
                <label>Date:</label>
                <span>{ticket.date}</span>
              </div>
            </div>
          </div>
          <div className="ticket-info-item">
            <div style={{ display: "flex", gap: "16px", width: "100%" }}>
              <div style={{ flexGrow: 1 }}>
                <label>Customer:</label>
                <span>{ticket.customerName}</span>
              </div>
              {ticket.customerType === "Business" && (
                <div style={{ flexGrow: 1 }}>
                  <label>Company:</label>
                  <span>{ticket.companyName || "N/A"}</span>
                </div>
              )}
            </div>
          </div>
          <div className="ticket-info-item">
            <label>Mobile:</label>
            <span>{ticket.mobileNumber}</span>
          </div>
          <div className="ticket-info-item">
            <label>Email:</label>
            <span>{ticket.emailAddress}</span>
          </div>
          <div className="ticket-info-item">
            <label>Device:</label>
            <span>{ticket.machineType}</span>
          </div>
          <div className="ticket-info-item">
            <label>Symptom:</label>
            <span>{ticket.symptom}</span>
          </div>
          <div className="ticket-info-item">
            <label>Repair ID(s):</label>
            {Array.isArray(ticket.caseID) ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {ticket.caseID.map((rid, idx) => (
                  <li
                    key={idx}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span>{rid}</span>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#e53935",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                      title="Remove Repair ID"
                      disabled={
                        ticket.ticketStates?.slice(-1)[0] === 7 ||
                        ticket.ticketStates?.slice(-1)[0] ===
                          "Repair Marked Complete"
                      }
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Are you sure you want to delete this repair ID?"
                          )
                        )
                          return;
                        const newArr = ticket.caseID.filter(
                          (_, i) => i !== idx
                        );
                        await updateDoc(doc(db, "tickets", ticket.id), {
                          caseID: newArr,
                          lastModified: new Date().toISOString(),
                        });
                        setTicket((prev) => ({ ...prev, caseID: newArr }));
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span>{ticket.caseID || "Not assigned"}</span>
            )}
          </div>
          <div className="ticket-info-item">
            <label>Current Status:</label>
            <span>
              {statusMap[ticket.ticketStates?.slice(-1)[0]] || "Unknown"}
            </span>
          </div>
        </div>

        {/* Repair ID Update Section */}
        <div className="repair-id-update-section">
          <h3>Add Repair ID</h3>
          <label htmlFor="repair-id-standalone">Repair ID:</label>
          <input
            id="repair-id-standalone"
            type="text"
            value={newRepairID}
            onChange={(e) => setNewRepairID(e.target.value)}
            placeholder="Enter repair ID"
            className="repair-id-input"
            disabled={
              ticket.ticketStates?.slice(-1)[0] === 7 ||
              ticket.ticketStates?.slice(-1)[0] === "Repair Marked Complete"
            }
          />
          <button
            className="repair-id-update-button"
            onClick={async () => {
              if (!newRepairID.trim()) return;
              let arr = Array.isArray(ticket.caseID)
                ? [...ticket.caseID]
                : ticket.caseID
                  ? [ticket.caseID]
                  : [];
              arr.push(newRepairID.trim());
              await updateDoc(doc(db, "tickets", ticket.id), {
                caseID: arr,
                lastModified: new Date().toISOString(),
              });
              setTicket((prev) => ({ ...prev, caseID: arr }));
              setNewRepairID("");
              alert("Repair ID added successfully");
            }}
            disabled={
              !newRepairID.trim() ||
              ticket.ticketStates?.slice(-1)[0] === 7 ||
              ticket.ticketStates?.slice(-1)[0] === "Repair Marked Complete"
            }
          >
            Add Repair ID
          </button>
        </div>

        <div className="status-update-section">
          <label htmlFor="status-select">Change Status:</label>
          {/* <select
          id="status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(parseInt(e.target.value))}
        >
          {statusOptions.map((status, index) => (
            <option
              key={index}
              value={index}
              disabled={index < currentStatusIndex}
            >
              {status}
            </option>
          ))}
        </select> */}
          <select
            id="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(parseInt(e.target.value))}
          >
            {statusOptions.map((status, index) => {
              const isPrevious = index <= currentStatusIndex;
              const isLocked =
                (ticket.approvalRequired && index < 6) ||
                (ticket.approvalStatus === "rejected" && index < 6); // restrict 3–5 unless approved

              return (
                <option
                  key={index}
                  value={index}
                  disabled={isPrevious || isLocked}
                >
                  {status}
                </option>
              );
            })}
          </select>

          <label htmlFor="status-note">Note:</label>
          <textarea
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter technician note (required)"
            rows={4}
            required
          />

          <button
            onClick={handleUpdateStatus}
            disabled={
              selectedStatus <= currentStatusIndex ||
              note.trim() === "" ||
              statusUpdating
            }
            style={{ position: "relative" }}
          >
            {statusUpdating ? (
              <span
                style={{
                  display: "inline-block",
                  width: 24,
                  height: 24,
                  border: "4px solid #eee",
                  borderTop: "4px solid #1976d2",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  verticalAlign: "middle",
                  marginRight: 8,
                }}
              />
            ) : null}
            Update Status
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </button>
        </div>
        {technician?.permission === "Admin" &&
          ticket.approvalRequired &&
          ticket.approvalStatus === "pending" && (
            <div className="admin-approval-section">
              <p className="approval-warning">
                This ticket is awaiting approval.
              </p>
              <button
                className="approve-btn"
                onClick={async () => {
                  await updateDoc(doc(db, "tickets", id), {
                    approvalRequired: false,
                    approvalStatus: "approved",
                  });
                  setTicket((prev) => ({
                    ...prev,
                    approvalRequired: false,
                    approvalStatus: "approved",
                  }));
                }}
              >
                Approve Ticket
              </button>
              <button
                className="reject-btn"
                onClick={async () => {
                  await updateDoc(doc(db, "tickets", id), {
                    approvalRequired: false,
                    approvalStatus: "rejected",
                  });
                  setTicket((prev) => ({
                    ...prev,
                    approvalRequired: false,
                    approvalStatus: "rejected",
                  }));
                }}
              >
                Reject Ticket
              </button>
            </div>
          )}
      </div>
      <div className="process-ticket-sidebar">
        <button className="side-button" onClick={() => setShowMediaModal(true)}>
          Media
        </button>
        <button
          className="side-button"
          onClick={() => setShowReportModal(true)}
        >
          Report
        </button>
        <button className="side-button" onClick={openPartsModal}>
          Parts
        </button>
        <button className="side-button" onClick={openPriceQuotationModal}>
          Price Quotation
        </button>
        <TicketStatusTimeline
          states={ticket.ticketStates || []}
          details={ticket.details || []}
          isEditable={ticket.ticketStates?.slice(-1)[0] !== 7}
          onUpdateDetail={async (idx, newDetail) => {
            // Update Firestore
            const docRef = doc(db, "tickets", ticket.id);
            const newDetails = [...(ticket.details || [])];
            newDetails[idx] = newDetail;
            await updateDoc(docRef, { details: newDetails });
            setTicket((prev) => ({ ...prev, details: newDetails }));
          }}
        />
      </div>

      <PartsModal
        isOpen={isPartsModalOpen}
        onClose={closePartsModal}
        ticket={ticket}
        onOpenPriceQuotationModal={(partInfo) => {
          closePartsModal();
          openPriceQuotationModal(partInfo);
        }}
      />
      <PriceQuotationModal
        isOpen={isPriceQuotationModalOpen}
        onClose={closePriceQuotationModal}
        ticket={ticket}
        initialPart={pendingQuotationPart}
      />
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaURLs={mediaURLs}
        setMediaURLs={setMediaURLs}
        ticket={ticket}
      />
      {showReportModal && ticket?.techReportURL ? (
        <div
          className="pdf-modal-overlay"
          onClick={() => setShowReportModal(false)}
        >
          <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-btn"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 2,
                background: "#fff",
                border: "none",
                fontSize: "2rem",
                cursor: "pointer",
                borderRadius: "50%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
              onClick={() => setShowReportModal(false)}
            >
              &times;
            </button>
            <iframe
              src={ticket.techReportURL}
              title="Technical Report PDF"
              width="100%"
              height="700px"
              style={{ border: "none", borderRadius: "8px" }}
            />
          </div>
        </div>
      ) : (
        <TechnicalReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          ticket={ticket}
        />
      )}
      {/* <Modal
        isOpen={isPartsModalOpen}
        onRequestClose={closePartsModal}
        className="parts-slide-modal"
        overlayClassName="parts-modal-overlay"
        closeTimeoutMS={300}
      >
        <div className="parts-modal-content">
          <h2>Parts Panel</h2>
          
          <button onClick={closePartsModal} className="close-parts-button">
            ×
          </button>
          <form className="parts-form">
            <div className="form-group">
              <label htmlFor="partNumber">Part#:</label>
              <input id="partNumber" type="text" placeholder="Enter Part#" />
            </div>

            <div className="form-group">
              <label htmlFor="newSN">New SN:</label>
              <input id="newSN" type="text" placeholder="Enter New SN" />
            </div>

            <div className="form-group">
              <label htmlFor="oldSN">Old SN:</label>
              <input id="oldSN" type="text" placeholder="Enter Old SN" />
            </div>

            <div className="form-group">
              <label htmlFor="warrantyStatus">Warranty Status:</label>
              <select id="warrantyStatus">
                <option>Apple limited warranty</option>
                <option>Out of warranty</option>
                <option>Quality Program</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">Part Description:</label>
              <input
                id="description"
                type="text"
                placeholder="Enter Description"
              />
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Quantity:</label>
              <input id="quantity" type="number" placeholder="Enter Quantity" />
            </div>

            <div className="form-group">
              <label htmlFor="price">Price:</label>
              <input id="price" type="number" placeholder="Enter Price" />
            </div>

            <div className="form-group checkbox-group">
              <input type="checkbox" id="serviceCheckbox" />
              <label htmlFor="serviceCheckbox">Service</label>
            </div>

            <button type="submit" className="apply-button">
              Apply
            </button>
          </form>
        </div>
      </Modal> */}
    </div>
  );
};

export default ProcessTicketPage;

{
  /* <ul>
                  <li>Sunday - Thursday: 9:00 AM - 9:00 PM</li>
                  <li>Saturday: 10:00 AM - 9:00 PM</li>
                  <li>Friday: Closed</li>
                </ul> */
}
