// ProcessTicketPage.jsx
import { useParams } from "react-router-dom";
import Modal from "react-modal";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { useEffect, useState } from "react";
import "./ProcessTicketPage.css";
import { useUser } from "../context/userContext";
import PartsModal from "../components/PartsModal";
import PriceQuotationModal from "../components/PriceQuotationModal";
import { API_ENDPOINTS } from "../config/api";
import MediaModal from "../components/MediaModal";

Modal.setAppElement("#root"); // for accessibility
const statusOptions = [
  "Start",
  "VMI Troubleshooting",
  "Repair Released from Processing",
  "Awaiting Parts",
  "Parts Allocated",
  "In Repair",
  "Ready For Pickup",
  "Repair Marked Complete",
];

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

const ProcessTicketPage = () => {
  const { id } = useParams();
  const { technician } = useUser();
  const [ticket, setTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState(0);
  const [note, setNote] = useState("");
  const [newRepairID, setNewRepairID] = useState("");

  const [isPartsModalOpen, setIsPartsModalOpen] = useState(false);
  const [isPriceQuotationModalOpen, setIsPriceQuotationModalOpen] =
    useState(false);
  const [mediaURLs, setMediaURLs] = useState([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const storage = getStorage();
  const openPartsModal = () => setIsPartsModalOpen(true);
  const closePartsModal = () => setIsPartsModalOpen(false);
  const openPriceQuotationModal = () => setIsPriceQuotationModalOpen(true);
  const closePriceQuotationModal = () => setIsPriceQuotationModalOpen(false);

  useEffect(() => {
    const fetchTicket = async () => {
      const docRef = doc(db, "tickets", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const latestStatusIndex = data.ticketStates?.slice(-1)[0] || 0;

        setTicket({ id: docSnap.id, ...data });
        setCurrentStatusIndex(latestStatusIndex);
        setSelectedStatus(latestStatusIndex);
        // setRepairID(data.caseID || ""); // Initialize repair ID from existing data

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
        // ✅ Extract media URLs if they exist
        // if (data.mediaURLs && Array.isArray(data.mediaURLs)) {
        //   setMediaURLs(data.mediaFiles);
        // }
        setLoading(false);
      }
    };
    fetchTicket();
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!note.trim()) {
      alert("Please add a note.");
      return;
    }

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

    await updateDoc(docRef, updates);

    // Send email notification if status is "Ready For Pickup"
    if (parseInt(selectedStatus) === 6) {
      await sendReadyForPickupEmail();
    }

    alert("Status and note updated successfully");

    setTicket((prev) => ({
      ...prev,
      ticketStates: [...prev.ticketStates, parseInt(selectedStatus)],
      details: [...(prev.details || []), fullNote],
      technicions: [...prev.technicions, technician.name],
      approvalRequired: selectedStatus === 1 ? true : prev.approvalRequired,
      approvalStatus: selectedStatus === 1 ? "pending" : prev.approvalStatus,
    }));

    setNote("");
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
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
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
                  <li>Sunday - Thursday: 9:00 AM - 6:00 PM</li>
                  <li>Saturday: 9:00 AM - 2:00 PM</li>
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
                    ? "+962-6-XXX-XXXX"
                    : "+962-2-XXX-XXXX"
                }</li>
              </ul>
              
              <p>Thank you for choosing 365Solutions for your device repair needs. We appreciate your patience and look forward to serving you again.</p>
              
              <div class="footer">
                <p>365Solutions - Apple Authorized Service Center</p>
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

  const handleUpdateRepairID = async () => {
    if (!newRepairID.trim()) {
      alert("Please enter a repair ID.");
      return;
    }

    const docRef = doc(db, "tickets", id);

    try {
      await updateDoc(docRef, {
        caseID: newRepairID.trim(),
        lastModified: new Date().toISOString(),
      });
      setNewRepairID("");
      alert("Repair ID updated successfully");

      // Update the local ticket state
      setTicket((prev) => ({
        ...prev,
        caseIDID: newRepairID.trim(),
      }));
    } catch (error) {
      console.error("Error updating repair ID:", error);
      alert("Failed to update repair ID. Please try again.");
    }
  };

  if (loading) return <div className="loading">Loading ticket...</div>;

  return (
    <div className="process-ticket-layout">
      <div className="process-ticket-container">
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
            <label>Ticket#:</label>
            <span>
              {ticket.location}
              {ticket.ticketNum}
            </span>
          </div>
          <div className="ticket-info-item">
            <label>Customer:</label>
            <span>{ticket.customerName}</span>
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
            <label>Repair ID:</label>
            <span>{ticket.caseID || "Not assigned"}</span>
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
          <h3>Update Repair ID</h3>
          <label htmlFor="repair-id-standalone">Repair ID:</label>
          <input
            id="repair-id-standalone"
            type="text"
            value={newRepairID}
            onChange={(e) => setNewRepairID(e.target.value)}
            placeholder="Enter repair ID"
            className="repair-id-input"
          />
          <button
            className="repair-id-update-button"
            onClick={handleUpdateRepairID}
            disabled={!newRepairID.trim()}
          >
            Update Repair ID
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
              selectedStatus <= currentStatusIndex || note.trim() === ""
            }
          >
            Update Status
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
        <button className="side-button">Report</button>
        <button className="side-button" onClick={openPartsModal}>
          Parts
        </button>
        <button className="side-button" onClick={openPriceQuotationModal}>
          Price Quotation
        </button>
      </div>
      <PartsModal
        isOpen={isPartsModalOpen}
        onClose={closePartsModal}
        ticket={ticket}
      />
      <PriceQuotationModal
        isOpen={isPriceQuotationModalOpen}
        onClose={closePriceQuotationModal}
        ticket={ticket}
      />
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaURLs={mediaURLs}
        setMediaURLs={setMediaURLs}
        ticket={ticket}
      />
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
