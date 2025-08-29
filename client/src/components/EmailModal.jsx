import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { API_ENDPOINTS } from "../config/api";
import React, { useState } from "react";
import "./EmailModal.css"; // optional external styling

const EmailModal = ({ isOpen, onClose, onSend, ticket }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [useCustomerEmail, setUseCustomerEmail] = useState(true);
  const [customEmail, setCustomEmail] = useState("");
  const [selectedDocs, setSelectedDocs] = useState([]);

  const destinationEmail = useCustomerEmail ? ticket.emailAddress : customEmail;

  const sendEmailViaSMTP = async (
    headerLogoBase64,
    footerLogoBase64,
    htmlContentPartContract,
    htmlContentPartDN,
    htmlContentPartPDN,
    htmlContentPartInvoice
  ) => {
    setIsLoading(true);

    try {
      const htmlContentLast = `
        <p>You can always shop for any Apple product at <a href="https://estorejo.com"> Smart Cloud - eStore</a></p>
        
        <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; font-size: 13px; color: #999; text-align: center;">
          ${
            footerLogoBase64
              ? `<div style="margin-bottom: 15px;">
            <img src="${footerLogoBase64}" alt="365 Solutions Email Logo" style="max-height: 40px; height: auto;" />
          </div>`
              : ""
          }
          <p>© 2025 365 Solutions. All rights reserved.</p>
          <p>Mecca Street, Building No. 221, Amman, Jordan • help@365solutionsjo.com, Tel: +962 796818189</p>
          <p>Wasfi AlTal Street, Irbid, Jordan • irbid@365solutionsjo.com, Tel: +962 796818189</p>
        </div>
      </div>`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #094549; padding-bottom: 15px;">
            ${
              headerLogoBase64
                ? `<img src="${headerLogoBase64}" alt="365 Solutions Logo" style="max-height: 60px; height: auto; margin-right: 20px;" />`
                : ""
            }
            <h2 style="color: #094549; margin: 0; flex-grow: 1;">Document Download - Ticket #${
              ticket.location
            }${ticket.ticketNum}</h2>
          </div>
          
          <p>Dear ${ticket.customerName},</p>
          <p>Please find below the download links for your requested documents related to Ticket #${
            ticket.location
          }${ticket.ticketNum} for device ${
        ticket.machineType
      } with serial number ${ticket.serialNum}.</p>
          
          ${htmlContentPartContract}
          ${htmlContentPartPDN}
          ${htmlContentPartInvoice}
          ${htmlContentPartDN}
          ${htmlContentLast}
      `;

      // Send email via server endpoint using SMTP
      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: destinationEmail,
          subject: `Documents - Ticket #${ticket.location}${ticket.ticketNum}`,
          html: emailHtml,
          location: ticket.location, // Pass location for SMTP configuration
        }),
      });

      if (response.ok) {
        alert(`Documents sent successfully to ${destinationEmail}`);
        setIsLoading(false);
        setUseCustomerEmail(true);
        setCustomEmail("");
        setSelectedDocs([]);
        onClose();
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error ||
            `Server returned ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert(`Failed to send email: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setSelectedDocs((prev) =>
      checked ? [...prev, value] : prev.filter((doc) => doc !== value)
    );
  };

  const handleGetDocumentsURLs = async () => {
    var htmlContentPartContract = "";
    var htmlContentPartDN = "";
    var htmlContentPartPDN = "";
    var htmlContentPartInvoice = "";

    try {
      const storage = getStorage();

      // Load logos for email (using local assets approach like PriceQuotationModal)
      const headerLogoPath = "/src/assets/logo_new.png";
      const footerLogoPath = "/src/assets/email_logo.png";
      let headerLogoBase64 = "";
      let footerLogoBase64 = "";

      try {
        // Load header logo (main logo for left side)
        const headerLogoResponse = await fetch(headerLogoPath);
        const headerLogoBlob = await headerLogoResponse.blob();
        headerLogoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(headerLogoBlob);
        });
      } catch (error) {
        console.warn("Could not load header logo for email:", error);
      }

      try {
        // Load footer logo (email logo)
        const footerLogoResponse = await fetch(footerLogoPath);
        const footerLogoBlob = await footerLogoResponse.blob();
        footerLogoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(footerLogoBlob);
        });
      } catch (error) {
        console.warn("Could not load footer logo for email:", error);
      }

      // Generate download URLs for selected documents
      if (selectedDocs.includes("contract") && ticket.contractURL) {
        const fileRef = ref(storage, ticket.contractURL);
        const url = await getDownloadURL(fileRef);
        htmlContentPartContract = `<p><strong>Service Agreement:</strong> <a href="${url}" style="color: #094549; text-decoration: none;">Click here to download</a></p>`;
      }

      if (
        selectedDocs.includes("parts delivery note") &&
        ticket.partsDeliveryNoteURL
      ) {
        const fileRef = ref(storage, ticket.partsDeliveryNoteURL);
        const url = await getDownloadURL(fileRef);
        htmlContentPartPDN = `<p><strong>Parts Delivery Note:</strong> <a href="${url}" style="color: #094549; text-decoration: none;">Click here to download</a></p>`;
      }

      if (selectedDocs.includes("invoice") && ticket.invoiceURL) {
        const fileRef = ref(storage, ticket.invoiceURL);
        const url = await getDownloadURL(fileRef);
        htmlContentPartInvoice = `<p><strong>Invoice:</strong> <a href="${url}" style="color: #094549; text-decoration: none;">Click here to download</a></p>`;
      }

      if (selectedDocs.includes("delivery note") && ticket.deliveryNoteURL) {
        const fileRef = ref(storage, ticket.deliveryNoteURL);
        const url = await getDownloadURL(fileRef);
        htmlContentPartDN = `<p><strong>Delivery Note:</strong> <a href="${url}" style="color: #094549; text-decoration: none;">Click here to download</a></p>`;
      }

      await sendEmailViaSMTP(
        headerLogoBase64,
        footerLogoBase64,
        htmlContentPartContract,
        htmlContentPartDN,
        htmlContentPartPDN,
        htmlContentPartInvoice
      );
    } catch (error) {
      console.error("Failed to get download URLs or send email:", error);
      alert("Could not fetch document URLs or send email. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!destinationEmail || selectedDocs.length === 0) {
      alert("Please enter an email address and select at least one document.");
      return;
    }

    if (!useCustomerEmail && !customEmail) {
      alert("Please enter a custom email address.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(destinationEmail)) {
      alert("Please enter a valid email address.");
      return;
    }

    handleGetDocumentsURLs();
  };

  if (!isOpen) return null;

  return (
    <div className="email-modal-overlay">
      <div className="email-modal">
        <button className="email-modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Send Documents by Email</h2>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <input
              type="radio"
              checked={useCustomerEmail}
              onChange={() => setUseCustomerEmail(true)}
            />
            Send to customer email: <strong>{ticket.emailAddress}</strong>
          </label>
          <br />
          <label>
            <input
              type="radio"
              checked={!useCustomerEmail}
              onChange={() => setUseCustomerEmail(false)}
            />
            Send to another email:
          </label>
          {!useCustomerEmail && (
            <input
              type="email"
              placeholder="Enter custom email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              style={{ display: "block", marginTop: "0.5rem", width: "100%" }}
            />
          )}
        </div>

        <label>Select Documents to Send:</label>
        <div className="doc-options">
          {ticket.contractURL && (
            <label>
              <input
                type="checkbox"
                value="contract"
                checked={selectedDocs.includes("contract")}
                onChange={handleCheckboxChange}
              />
              contract
            </label>
          )}
          {ticket.partsDeliveryNoteURL && (
            <label>
              <input
                type="checkbox"
                value="parts delivery note"
                checked={selectedDocs.includes("parts delivery note")}
                onChange={handleCheckboxChange}
              />
              parts delivery note
            </label>
          )}
          {ticket.invoiceURL && (
            <label>
              <input
                type="checkbox"
                value="invoice"
                checked={selectedDocs.includes("invoice")}
                onChange={handleCheckboxChange}
              />
              invoice
            </label>
          )}
          {ticket.deliveryNoteURL && (
            <label>
              <input
                type="checkbox"
                value="delivery note"
                checked={selectedDocs.includes("delivery note")}
                onChange={handleCheckboxChange}
              />
              delivery note
            </label>
          )}
        </div>

        {isLoading ? (
          <div className="spinner"></div> // Add a CSS spinner or loading gif
        ) : (
          <button className="send-button" onClick={handleSubmit}>
            Send Email
          </button>
        )}
      </div>
    </div>
  );
};

export default EmailModal;
