import React, { useEffect, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import JSZip from "jszip";
// import logo from "/logo-and-apple.png";
import { saveAs } from "file-saver";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  getStorage,
  ref,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
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

const logo =
  "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";

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

const StatusStepWithBubble = React.memo(function StatusStepWithBubble({
  statusCode,
  statusText,
  detail,
}) {
  const [showBubble, setShowBubble] = useState(false);
  return (
    <li
      className="status-step"
      style={{ position: "relative", cursor: "pointer" }}
      onMouseEnter={() => console.log("detail:", detail) || setShowBubble(true)}
      onMouseLeave={() => console.log("hide bubble") || setShowBubble(false)}
    >
      <span style={{ fontWeight: "bold" }}>{statusText} </span>
      <p
        style={{
          margin: 2,
          backgroundColor: detail ? "#f9f9f9" : "#fff0f0",
          padding: "4px 8px",
          borderRadius: "4px",
          border: detail ? "1px solid #eee" : "1px solid #e57373",
        }}
      >
        {detail ? (
          typeof detail === "string" ? (
            detail
          ) : (
            JSON.stringify(detail, null, 2)
          )
        ) : (
          <em>No detail available</em>
        )}
      </p>
      {showBubble && (
        <div
          className="status-detail-bubble"
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: detail ? "#fff" : "#ffeaea",
            border: detail ? "1px solid #ccc" : "1px solid #e57373",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "10px 16px",
            minWidth: "220px",
            maxWidth: "350px",
            zIndex: 1000,
            whiteSpace: "pre-wrap",
            color: detail ? undefined : "#a72828",
          }}
        >
          {detail ? (
            typeof detail === "string" ? (
              detail
            ) : (
              JSON.stringify(detail, null, 2)
            )
          ) : (
            <em>No detail available</em>
          )}
        </div>
      )}
    </li>
  );
});

export default function TicketDetail({ ticket, onClose, onDelete }) {
  const [isDownloading, setIsDownloading] = useState(false);
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

  const [contractURL, setContractURL] = useState(null);
  // Helper to fetch a file from Firebase Storage and add to zip
  const fetchAndAddFileToZip = async (zip, folder, fileName, filePath) => {
    if (!filePath) return;
    try {
      const fileRef = ref(storage, filePath);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const blob = await response.blob();
      zip.folder(folder).file(fileName, blob);
    } catch (err) {
      console.error(`Failed to fetch ${fileName}:`, err);
    }
  };

  // Main download handler
  const handleDownloadTicketFolder = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      // Add ticket details as JSON
      zip.file("ticket-details.json", JSON.stringify(ticket, null, 2));

      // Add signed documents
      await Promise.all([
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "contract.pdf",
          ticket.contractURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "delivery-note.pdf",
          ticket.deliveryNoteURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "device-delivery-note.pdf",
          ticket.deviceDeliveryNoteURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "parts-delivery-note.pdf",
          ticket.partsDeliveryNoteURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "no-responsibility-note.pdf",
          ticket.noResponsibilityURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "technical-report.pdf",
          ticket.techReportURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "invoice.pdf",
          ticket.invoiceURL
        ),
        fetchAndAddFileToZip(
          zip,
          "signed-documents",
          "price-quotation.pdf",
          ticket.priceQuotationURL
        ),
      ]);

      // Add uploaded media
      if (ticket.mediaURLs && ticket.mediaURLs.length > 0) {
        await Promise.all(
          ticket.mediaURLs.map(async (path, idx) => {
            // Try to get file extension from path
            const extMatch = path.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : "bin";
            await fetchAndAddFileToZip(
              zip,
              "media",
              `media_${idx + 1}.${ext}`,
              path
            );
          })
        );
      }

      // Generate ZIP and trigger download
      zip.generateAsync({ type: "blob" }).then((content) => {
        saveAs(content, `ticket_${ticket.ticketNum || ticket.id}.zip`);
        setIsDownloading(false);
      });
    } catch (err) {
      setIsDownloading(false);
      alert("Failed to download ticket folder. Please try again.");
    }
  };
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

    if (ticket.techReportURL) {
      setDocumentsLinks((prev) => [...prev, "View Technical Report"]);
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

    if (link === "View Technical Report") {
      filePath = ticket.techReportURL;
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
      // Open the direct PDF URL for best print quality
      window.open(url, "_blank");
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
    // Check for invoice requirement and payment status
    if (ticket.shouldHaveInvoice && ticket.invoiceStatus !== "Paid") {
      alert("You must collect the invoice payment before closing the ticket.");
      return;
    }
    if (!ticket.deliveryNoteURL) {
      navigate(`/tickets/${ticket.id}/deliver`);
    } else {
      navigate(`/tickets/${ticket.id}/part-delivery`);
    }
  };

  const handleSignOtherDocuments = () => {
    if (!ticket.priceQuotationURL && ticket.priceQuotationRef) {
      navigate(`/tickets/${ticket.id}/price-quotation`);
    } else if (!ticket.partsDeliveryNoteURL && ticket.partDeliveryNote) {
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

  const technician = JSON.parse(localStorage.getItem("technician"));

  const canDeleteTicket =
    technician?.permission === "Admin" &&
    ticket.ticketStates?.slice(-1)[0] !== 7;

  const handleDeleteTicket = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this ticket and all its documents? This action cannot be undone."
      )
    )
      return;
    try {
      // Delete all related files from Firebase Storage
      const fileFields = [
        "contractURL",
        "techReportURL",
        "deliveryNoteURL",
        "deviceDeliveryNoteURL",
        "partsDeliveryNoteURL",
        "noResponsibilityURL",
        "invoiceURL",
        "priceQuotationURL",
        "customerSignatureURL",
      ];
      for (const field of fileFields) {
        if (ticket[field]) {
          try {
            const fileRef = ref(storage, ticket[field]);
            await deleteObject(fileRef);
          } catch (err) {
            // Ignore missing files
          }
        }
      }
      // Delete the ticket document
      await deleteDoc(doc(db, "tickets", ticket.id));
      alert("Ticket and all related documents deleted successfully.");
      if (onDelete) onDelete(ticket.id);
      if (onClose) onClose();
    } catch (err) {
      alert("Failed to delete ticket. Please try again.");
      console.error(err);
    }
  };

  const PrintableContent = ({ ticket }) => {
    if (!ticket) {
      return null;
    }

    // Inline styles for printing
    const styles = `
      .print-root { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt-container { background-color: #fff; padding: 40px; margin: 20px auto; border-radius: 8px; width: 100%; max-width: 1200px; max-height: 1000px; position: relative; }
      .receipt-logo { max-width: 180px; height: auto; display: block; margin-bottom: 18px; }
      .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
      .receipt-header h1 { font-size: 2.5rem; color: #0056b3; margin: 0; }
      .receipt-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .receipt-section h2 { font-size: 1.5rem; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
      .receipt-section p { margin: 10px 0; font-size: 1rem; line-height: 1.6; }
      .receipt-section p strong { color: #555; min-width: 120px; display: inline-block; }
      .receipt-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; font-size: 0.95rem; color: #777; background: #f9f9f9; border-radius: 0 0 8px 8px; }
      .footer-contact { margin-top: 10px; font-size: 0.98rem; color: #444; }
    `;

    return (
      <div className="print-root">
        <style>{styles}</style>
        {/* Receipt 1: Technician Copy */}
        <div className="receipt-container">
          <img src={logo} alt="Company Logo" className="receipt-logo" />
          <h2 style={{ color: "#1ccad4", marginBottom: 16 }}>
            Service Ticket #{ticket.location}
            {ticket.ticketNum}
          </h2>
          <hr style={{ margin: "16px 0", borderColor: "#eee" }} />
          <div style={{ marginBottom: 18 }}>
            <strong>Date:</strong> {ticket.date}
            <br />
            <strong>ID:</strong> {ticket.id}
          </div>
          <div className="receipt-details">
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Customer Info</h3>
              <p>
                <strong>Name:</strong> {ticket.customerName}
              </p>
              {ticket.customerType == "Business" && (
                <p>
                  <strong>Company Name:</strong> {ticket.companyName}
                </p>
              )}
              <p>
                <strong>Email:</strong> {ticket.emailAddress}
              </p>
              <p>
                <strong>Mobile:</strong> {ticket.mobileNumber}
              </p>
            </div>
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Device Info</h3>
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
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Repair Info</h3>
              <p>
                <strong>Symptom:</strong> {ticket.symptom}
              </p>
              <p>
                <strong>Repair ID:</strong> {ticket.caseID}
              </p>
            </div>
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Notes</h3>
              <p>
                {ticket.notes ? ticket.notes : <em>No notes added yet.</em>}
              </p>
            </div>
          </div>

          {/* Footer with company details */}
          <div className="receipt-footer">
            <div className="footer-contact">
              {ticket.location === "M" ? (
                <>
                  <strong>365 Solutions</strong> &nbsp;|&nbsp; Amman, Jordan
                  <br />
                  <span>221 Mecca Street</span>
                  <br />
                  <span>
                    Phone: +962 79 681 8189 &nbsp;|&nbsp; Email:
                    help@365solutionsjo.com
                  </span>
                  <br />
                  <span>www.365solutionsjo.com</span>
                </>
              ) : (
                <>
                  <strong>365 Solutions</strong> &nbsp;|&nbsp; Irbid, Jordan
                  <br />
                  <span>Wasfi Al-Tal Street</span>
                  <br />
                  <span>
                    Phone: +962 79 668 8831 &nbsp;|&nbsp; Email:
                    irbid@365solutionsjo.com
                  </span>
                  <br />
                  <span>www.365solutionsjo.com</span>
                </>
              )}
            </div>
          </div>
        </div>
        <style>{styles}</style>
        {/* Receipt 1: Technician Copy */}
        <div className="receipt-container">
          <hr style={{ margin: "30px 0px", borderColor: "#100f0fff" }} />
          <img src={logo} alt="Company Logo" className="receipt-logo" />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              textAlign: "space-between",
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ color: "#1ccad4", marginBottom: 16 }}>
              Service Ticket #{ticket.location}
              {ticket.ticketNum}
            </h2>
            <h6>Customer Copy</h6>
          </div>
          <hr style={{ margin: "16px 0", borderColor: "#eee" }} />
          <div style={{ marginBottom: 18 }}>
            <strong>Date:</strong> {ticket.date}
            <br />
            <strong>ID:</strong> {ticket.id}
          </div>
          <div className="receipt-details">
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Customer Info</h3>
              <p>
                <strong>Name:</strong> {ticket.customerName}
              </p>
              {ticket.customerType == "Business" && (
                <p>
                  <strong>Company Name:</strong> {ticket.companyName}
                </p>
              )}
              <p>
                <strong>Email:</strong> {ticket.emailAddress}
              </p>
              <p>
                <strong>Mobile:</strong> {ticket.mobileNumber}
              </p>
            </div>
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Device Info</h3>
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
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Repair Info</h3>
              <p>
                <strong>Symptom:</strong> {ticket.symptom}
              </p>
              <p>
                <strong>Repair ID:</strong> {ticket.caseID}
              </p>
            </div>
            <div className="receipt-section">
              <h3 style={{ color: "#333", marginBottom: 8 }}>Notes</h3>
              <p>
                {ticket.notes ? ticket.notes : <em>No notes added yet.</em>}
              </p>
            </div>
          </div>

          {/* Footer with company details */}
          <div className="receipt-footer">
            <div className="footer-contact">
              {ticket.location === "M" ? (
                <>
                  <strong>365 Solutions</strong> &nbsp;|&nbsp; Amman, Jordan
                  <br />
                  <span>221 Mecca Street</span>
                  <br />
                  <span>
                    Phone: +962 79 681 8189 &nbsp;|&nbsp; Email:
                    help@365solutionsjo.com
                  </span>
                  <br />
                  <span>www.365solutionsjo.com</span>
                </>
              ) : (
                <>
                  <strong>365 Solutions</strong> &nbsp;|&nbsp; Irbid, Jordan
                  <br />
                  <span>Wasfi Al-Tal Street</span>
                  <br />
                  <span>
                    Phone: +962 79 668 8831 &nbsp;|&nbsp; Email:
                    irbid@365solutionsjo.com
                  </span>
                  <br />
                  <span>www.365solutionsjo.com</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handlePrint2 = () => {
    if (!ticket) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const contentString = ReactDOMServer.renderToString(
        <PrintableContent ticket={ticket} />
      );
      printWindow.document.write(contentString);
      printWindow.document.close();
      printWindow.focus();
      // A small timeout can still help ensure rendering is complete.
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 50);
    }

    // image.onerror = () => {
    //   console.error("Could not load logo for printing. Printing without it.");
    //   // Fallback to printing without the image if it fails to load
    //   const printWindow = window.open("", "_blank");
    //   if (printWindow) {
    //     const contentString = ReactDOMServer.renderToString(
    //       <PrintableContent ticket={ticket} />
    //     );
    //     printWindow.document.write(contentString);
    //     printWindow.document.close();
    //     printWindow.focus();
    //     setTimeout(() => {
    //       printWindow.print();
    //       printWindow.close();
    //     }, 50);
    //   }
    // };
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
          <button className="ticket-action-button" onClick={handlePrint2}>
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
            style={{ position: "relative" }}
          >
            🖼️ Media
            {(!ticket.mediaURLs || ticket.mediaURLs.length === 0) && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  width: 10,
                  height: 10,
                  background: "#e53935",
                  borderRadius: "50%",
                  display: "inline-block",
                  border: "2px solid #fff",
                  boxShadow: "0 0 2px #a72828",
                }}
                title="No media uploaded"
              />
            )}
          </button>
          <button
            className={`ticket-action-button ${isEditing ? "edit-active" : ""} ${ticket.ticketStates?.slice(-1)[0] === 7 ? "disabled" : ""}`}
            onClick={handleEditToggle}
            disabled={ticket.ticketStates?.slice(-1)[0] === 7}
            style={
              ticket.ticketStates?.slice(-1)[0] === 7
                ? { opacity: 0.5, cursor: "not-allowed" }
                : {}
            }
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
          <button
            className="ticket-action-button"
            onClick={handleDownloadTicketFolder}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <span style={{ display: "flex", alignItems: "center" }}>
                <span
                  className="spinner"
                  style={{
                    marginRight: 6,
                    width: 18,
                    height: 18,
                    border: "2px solid #ccc",
                    borderTop: "2px solid #333",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></span>
                Downloading...
              </span>
            ) : (
              <>📁 Download Ticket Folder</>
            )}
          </button>
          {canDeleteTicket && (
            <button
              className="ticket-action-button"
              style={{ background: "#e53935", color: "#fff" }}
              onClick={handleDeleteTicket}
            >
              🗑️ Delete Ticket
            </button>
          )}
          {/* Spinner animation CSS */}
          <style>
            {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
          </style>
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
              {ticket.customerType === "Business" && (
                <div className="edit-field">
                  <label>
                    <strong>Company:</strong>
                  </label>
                  <input
                    type="text"
                    value={editedTicket.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    className="edit-input"
                  />
                </div>
              )}

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
              {ticket.customerType === "Business" && (
                <p>
                  <strong>Company:</strong> {ticket.companyName}
                </p>
              )}
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
                <StatusStepWithBubble
                  key={index}
                  statusCode={statusCode}
                  statusText={
                    statusMap[statusCode] || `Unknown (${statusCode})`
                  }
                  detail={ticket.details?.[index]}
                />
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
