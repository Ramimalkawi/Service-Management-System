import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import MediaModal from "./MediaModal"; // adjust the path if necessary
import emailjs from "@emailjs/browser";
import DeliveryModal from "./DeliveryModal";

// import { Resend } from "resend";
import PrintableTicket from "./PrintableTicket";
import "./TicketDetail.css";
import {
  FaTimes,
  FaPrint,
  FaFolderOpen,
  FaCogs,
  FaEnvelope,
  FaTruck,
  FaPenAlt,
  FaEdit,
  FaSave,
  FaUndo,
} from "react-icons/fa";
import { useReactToPrint } from "react-to-print";
import EmailModal from "./EmailModal";
import { useNavigate } from "react-router-dom";
import PartsDeliveryModal from "./PartsDeliveryModal";

// const resend = new Resend("re_CERL4s6x_H8JGbjuuPSTjE8ZWvnUeKrn9");

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

export default function TicketDetail({ ticket, onClose }) {
  const [mediaURLs, setMediaURLs] = useState([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTicket, setEditedTicket] = useState({});
  const [ticketNotes, setTicketNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const storage = getStorage();

  useEffect(() => {
    setShowDocumentsLinks(false);
    setMediaURLs([]);

    // Initialize editing data when ticket changes
    if (ticket) {
      setEditedTicket({
        customerName: ticket.customerName || "",
        emailAddress: ticket.emailAddress || "",
        mobileNumber: ticket.mobileNumber || "",
        machineType: ticket.machineType || "",
        deviceDescription: ticket.deviceDescription || "",
        serialNum: ticket.serialNum || "",
        warrantyStatus: ticket.warrantyStatus || "",
        symptom: ticket.symptom || "",
        repairID: ticket.repairID || "",
      });
      setTicketNotes(ticket.notes || "");
    }

    const fetchMediaURLs = async () => {
      if (!ticket?.mediaURLs || ticket.mediaURLs.length === 0) return;
      try {
        const urls = await Promise.all(
          ticket.mediaURLs.map(async (path) => {
            const fileRef = ref(storage, path);
            return await getDownloadURL(fileRef);
          })
        );
        setMediaURLs(urls);
      } catch (error) {
        console.error("Failed to fetch media URLs:", error);
      }
    };
    fetchMediaURLs();
  }, [ticket]);

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const [contractURL, setContractURL] = useState(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [showDocumentsLinks, setShowDocumentsLinks] = useState(false);
  const [documentsLinks, setDocumentsLinks] = useState([]);
  const [downloadURL, setDownloadURL] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [logoURL, setLogoURL] = useState("");
  const navigate = useNavigate();

  const handleProcess = () => {
    navigate(`/tickets/${ticket.id}/process`);
  };

  const handleShowDocumentsLinks = () => {
    setDocumentsLinks([]);

    const filePath = ticket.contractURL;

    if (ticket.contractURL) {
      setDocumentsLinks((prev) => [...prev, "View Contract"]);
    }

    if (ticket.deliveryNoteURL) {
      setDocumentsLinks((prev) => [...prev, "View Delivery Note"]);
    }

    if (ticket.deviceDeliveryNoteURL) {
      setDocumentsLinks((prev) => [...prev, "View Device Delivery Note"]);
    }

    if (ticket.partsDeliveryNoteURL) {
      setDocumentsLinks((prev) => [...prev, "View Parts Delivery Note"]);
    }

    if (ticket.noResponsibilityURL) {
      setDocumentsLinks((prev) => [...prev, "View No Responsibility Note"]);
    }

    if (ticket.invoiceURL) {
      setDocumentsLinks((prev) => [...prev, "View Invoice"]);
    }

    if (ticket.priceQuotationURL) {
      setDocumentsLinks((prev) => [...prev, "View Price Quotation"]);
    }

    if (documentsLinks.length > 0) {
      setShowDocumentsLinks((prev) => !prev);
    }
  };

  const handleOpenContractInTab = async ({ link }) => {
    const storage = getStorage();
    var filePath = "";
    if (link === "View Contract") {
      filePath = ticket.contractURL;
    }
    if (link === "View Delivery Note") {
      filePath = ticket.deliveryNoteURL;
    }

    if (link === "View Device Delivery Note") {
      filePath = ticket.deviceDeliveryNoteURL;
    }

    if (link === "View Parts Delivery Note") {
      filePath = ticket.partsDeliveryNoteURL;
    }

    if (link === "View No Responsibility Note") {
      filePath = ticket.noResponsibilityURL;
    }

    if (link === "View Invoice") {
      filePath = ticket.invoiceURL;
    }

    if (link === "View Invoice") {
      filePath = ticket.invoiceURL;
    }

    if (link === "View Price Quotation") {
      filePath = ticket.priceQuotationURL;
    }

    const fileRef = ref(storage, filePath);

    try {
      const url = await getDownloadURL(fileRef);
      const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
        url
      )}`;
      window.open(viewerUrl, "_blank");
    } catch (error) {
      console.error("Error opening contract PDF:", error);
      alert("Failed to open contract.");
    }
  };

  const handleDeliverToCustomer = () => {
    // You can later replace this with opening a delivery form modal or navigating to a delivery page
    alert(`Starting delivery process for ticket #${ticket.ticketNum}`);
  };

  const handleDeliver = () => {
    if (!ticket.deliveryNoteURL) {
      navigate(`/tickets/${ticket.id}/deliver`);
    } else {
      navigate(`/tickets/${ticket.id}/part-delivery`);
    }
  };

  const handleSignOtherDocuments = () => {
    if (!ticket.partsDeliveryNoteURL && ticket.partDeliveryNote) {
      navigate(`/tickets/${ticket.id}/part-delivery`);
    } else if (!ticket.invoiceURL && ticket.hasAnInvoice) {
      navigate(`/tickets/${ticket.id}/receipt-page`);
    } else {
      alert("No other documents to sign.");
    }
  };

  // Editing functions
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset to original values
      if (ticket) {
        setEditedTicket({
          customerName: ticket.customerName || "",
          emailAddress: ticket.emailAddress || "",
          mobileNumber: ticket.mobileNumber || "",
          machineType: ticket.machineType || "",
          deviceDescription: ticket.deviceDescription || "",
          serialNum: ticket.serialNum || "",
          warrantyStatus: ticket.warrantyStatus || "",
          symptom: ticket.symptom || "",
          repairID: ticket.caseID || "",
        });
        setTicketNotes(ticket.notes || "");
      }
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (field, value) => {
    setEditedTicket((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveChanges = async () => {
    // Show confirmation alert
    const confirmSave = window.confirm(
      "Are you sure you want to save these changes? This will update the ticket information permanently."
    );

    if (!confirmSave) {
      return;
    }

    setIsSaving(true);

    try {
      const ticketRef = doc(db, "tickets", ticket.id);
      const updatedData = {
        ...editedTicket,
        notes: ticketNotes,
        lastModified: new Date().toISOString(),
      };

      await updateDoc(ticketRef, updatedData);

      alert("Ticket information updated successfully!");
      setIsEditing(false);

      // Update parent component or refresh data if needed
      // You might want to call a parent function to refresh the ticket data
    } catch (error) {
      console.error("Error updating ticket:", error);
      alert("Failed to update ticket. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ticket-detail-container">
      {/* Header with close button */}
      <div className="ticket-detail-header">
        <h2>
          Ticket #{ticket.location}
          {ticket.ticketNum}
        </h2>
        <button className="close-button" onClick={onClose} title="Close">
          <FaTimes />
        </button>
        <p className="ticket-date">{ticket.date}</p>
        <p className="ticket-id">ID: {ticket.id}</p>
      </div>

      {/* ✅ Sticky Action Bar */}
      <div className="ticket-detail-sticky-bar">
        <div style={{ display: "flex", width: "100%", gap: "12px" }}>
          <button className="ticket-action-button" onClick={handlePrint}>
            <FaPrint /> Print
          </button>

          <button
            className="ticket-action-button"
            onClick={handleShowDocumentsLinks}
          >
            <FaFolderOpen /> Documents
          </button>
          <button className="ticket-action-button" onClick={handleProcess}>
            <FaCogs /> Process
          </button>
          <button
            className="ticket-action-button"
            onClick={() => setShowEmailModal(true)}
          >
            <FaEnvelope /> Email
          </button>
          <button
            className="ticket-action-button"
            onClick={() => setShowMediaModal(true)}
          >
            🖼️ Media
          </button>
          <button
            className={`ticket-action-button ${isEditing ? "edit-active" : ""}`}
            onClick={handleEditToggle}
          >
            {isEditing ? <FaUndo /> : <FaEdit />}{" "}
            {isEditing ? "Cancel" : "Edit"}
          </button>
          {isEditing && (
            <button
              className="ticket-action-button save-button"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              <FaSave /> {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
        {ticket.ticketStates?.slice(-1)[0] === 6 && (
          <div className="deliver-button-wrapper">
            <button className="deliver-button" onClick={handleDeliver}>
              <FaTruck /> Deliver to Customer
            </button>
          </div>
        )}
        {ticket.ticketStates?.slice(-1)[0] === 7 && (
          <div className="deliver-button-wrapper">
            <button
              className="deliver-button"
              onClick={handleSignOtherDocuments}
              style={{ backgroundColor: "#a72828ff", borderColor: "#28a745" }}
            >
              <FaPenAlt /> Sign Other Documents
            </button>
          </div>
        )}
      </div>
      {showDocumentsLinks && (
        <div className="contract-link-box">
          {" "}
          {documentsLinks.map((link) => (
            <h4
              className="contract-link-box"
              onClick={() => handleOpenContractInTab({ link })}
            >
              📄 {link}
            </h4>
          ))}
        </div>
      )}

      {showDocumentsLinks && !ticket.contractURL && (
        <p style={{ color: "red" }}>
          No contract URL available for this ticket.
        </p>
      )}

      {/* Hidden printable ticket */}
      <div
        style={{
          visibility: "hidden",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: -1,
        }}
      >
        <PrintableTicket ref={printRef} ticket={ticket} />
      </div>

      <div className="ticket-detail-body">
        <div className="ticket-detail-group">
          <h3>👤 Customer Info</h3>
          {isEditing ? (
            <>
              <div className="edit-field">
                <label>
                  <strong>Name:</strong>
                </label>
                <input
                  type="text"
                  value={editedTicket.customerName}
                  onChange={(e) =>
                    handleInputChange("customerName", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Email:</strong>
                </label>
                <input
                  type="email"
                  value={editedTicket.emailAddress}
                  onChange={(e) =>
                    handleInputChange("emailAddress", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Mobile:</strong>
                </label>
                <input
                  type="text"
                  value={editedTicket.mobileNumber}
                  onChange={(e) =>
                    handleInputChange("mobileNumber", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
            </>
          ) : (
            <>
              <p>
                <strong>Name:</strong> {ticket.customerName}
              </p>
              <p>
                <strong>Email:</strong> {ticket.emailAddress}
              </p>
              <p>
                <strong>Mobile:</strong> {ticket.mobileNumber}
              </p>
            </>
          )}
        </div>

        <div className="ticket-detail-group">
          <h3>💻 Device Info</h3>
          {isEditing ? (
            <>
              <div className="edit-field">
                <label>
                  <strong>Type:</strong>
                </label>
                <input
                  type="text"
                  value={editedTicket.machineType}
                  onChange={(e) =>
                    handleInputChange("machineType", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Description:</strong>
                </label>
                <textarea
                  value={editedTicket.deviceDescription}
                  onChange={(e) =>
                    handleInputChange("deviceDescription", e.target.value)
                  }
                  className="edit-textarea"
                  rows="3"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Serial Number:</strong>
                </label>
                <input
                  type="text"
                  value={editedTicket.serialNum}
                  onChange={(e) =>
                    handleInputChange("serialNum", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Warranty Status:</strong>
                </label>
                <select
                  value={editedTicket.warrantyStatus}
                  onChange={(e) =>
                    handleInputChange("warrantyStatus", e.target.value)
                  }
                  className="edit-select"
                >
                  <option value="">Select Status</option>
                  <option value="In Warranty">In Warranty</option>
                  <option value="Out of Warranty">Out of Warranty</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="ticket-detail-group">
          <h3>🛠️ Repair Info</h3>
          {isEditing ? (
            <>
              <div className="edit-field">
                <label>
                  <strong>Symptom:</strong>
                </label>
                <textarea
                  value={editedTicket.symptom}
                  onChange={(e) => handleInputChange("symptom", e.target.value)}
                  className="edit-textarea"
                  rows="3"
                />
              </div>
              <div className="edit-field">
                <label>
                  <strong>Repair ID:</strong>
                </label>
                <input
                  type="text"
                  value={editedTicket.caseID}
                  onChange={(e) =>
                    handleInputChange("repairID", e.target.value)
                  }
                  className="edit-input"
                />
              </div>
            </>
          ) : (
            <>
              <p>
                <strong>Symptom:</strong> {ticket.symptom}
              </p>
              <p>
                <strong>Repair ID:</strong> {ticket.caseID}
              </p>
            </>
          )}
        </div>

        {/* Notes Section */}
        <div className="ticket-detail-group">
          <h3>📝 Notes</h3>
          {isEditing ? (
            <div className="edit-field">
              <label>
                <strong>Add/Edit Notes:</strong>
              </label>
              <textarea
                value={ticketNotes}
                onChange={(e) => setTicketNotes(e.target.value)}
                className="edit-textarea"
                rows="4"
                placeholder="Add notes about this ticket..."
              />
            </div>
          ) : (
            <p>{ticket.notes ? ticket.notes : <em>No notes added yet.</em>}</p>
          )}
        </div>

        {ticket.ticketStates?.length > 0 && (
          <div className="ticket-detail-group">
            <h3>📈 Status Timeline</h3>
            <ol className="status-timeline">
              {ticket.ticketStates.map((statusCode, index) => (
                <li key={index} className="status-step">
                  <span>
                    {statusMap[statusCode] || `Unknown (${statusCode})`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        ticket={ticket}
      />
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaURLs={mediaURLs}
        setMediaURLs={setMediaURLs}
        ticket={ticket}
      />
      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        ticket={ticket}
      />
    </div>
  );
}
