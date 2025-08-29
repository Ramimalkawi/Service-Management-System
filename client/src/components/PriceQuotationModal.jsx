// PriceQuotationModal.jsx
import React, { useRef, useState, useEffect } from "react";
import Modal from "react-modal";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { API_ENDPOINTS } from "../config/api";
import "./PriceQuotationModal.css";

Modal.setAppElement("#root");

const PriceQuotationModal = ({ isOpen, onClose, ticket }) => {
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("0");
  const [service, setService] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [customServiceType, setCustomServiceType] = useState("");
  const [quotesList, setQuotesList] = useState([]);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    const fetchQuotation = async () => {
      if (ticket?.priceQuotationRef) {
        try {
          const quoteRef = doc(
            db,
            "priceQuotationsData",
            ticket.priceQuotationRef
          );
          const quoteSnap = await getDoc(quoteRef);
          if (quoteSnap.exists()) {
            const data = quoteSnap.data();
            setQuotesList(data.quotes || []);
          }
        } catch (err) {
          console.error("Failed to fetch price quotation:", err);
        }
      }
    };
    fetchQuotation();
  }, [ticket]);

  const clearForm = () => {
    setPartNumber("");
    setDescription("");
    setQuantity("1");
    setPrice("0");
    setService(false);
    setServiceType("");
    setCustomServiceType("");
  };

  const generateCustomDocumentId = () => {
    if (!ticket) return null;
    const sanitizedCustomer = ticket.customerName
      ? ticket.customerName.replace(/[^a-zA-Z0-9]/g, "")
      : "UnknownCustomer";
    const sanitizedLocation = ticket.location
      ? ticket.location.replace(/[^a-zA-Z0-9]/g, "")
      : "UnknownLocation";
    const timestamp = new Date().getTime();
    return `PQ_${sanitizedLocation}_${sanitizedCustomer}_${timestamp}`;
  };

  const addQuote = async () => {
    if (
      !description ||
      (!service && !partNumber) ||
      (service && !serviceType && !customServiceType)
    ) {
      alert(
        "Please fill in all required fields: Description, and either Part# (for parts) or Service Type (for services)"
      );
      return;
    }

    const newQuote = {
      partNumber: service ? "" : partNumber,
      description,
      quantity: parseInt(quantity) || 1,
      price: parseFloat(price) || 0,
      service,
      serviceType: service
        ? serviceType === "Custom"
          ? customServiceType
          : serviceType
        : "",
    };

    const updatedQuotes = [...quotesList, newQuote];
    setQuotesList(updatedQuotes);

    // Save to Firestore
    try {
      let documentId = ticket.priceQuotationRef || generateCustomDocumentId();

      const quoteData = {
        ticketId: ticket.ticketId,
        customer: ticket.customerName,
        location: ticket.location,
        quotes: updatedQuotes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (ticket.priceQuotationRef) {
        // Update existing document
        const quoteRef = doc(
          db,
          "priceQuotationsData",
          ticket.priceQuotationRef
        );
        await updateDoc(quoteRef, {
          quotes: updatedQuotes,
          updatedAt: new Date(),
        });
      } else {
        // Create new document with custom ID
        const quoteRef = doc(db, "priceQuotationsData", documentId);
        await setDoc(quoteRef, quoteData);

        // Update ticket with the quotation reference
        const ticketRef = doc(db, "tickets", ticket.id);
        await updateDoc(ticketRef, {
          priceQuotationRef: documentId,
        });
      }

      clearForm();
    } catch (error) {
      console.error("Error saving quote:", error);
      alert("Failed to save quote. Please try again.");
    }
  };

  const deleteQuote = async (index) => {
    const updatedQuotes = quotesList.filter((_, i) => i !== index);
    setQuotesList(updatedQuotes);

    try {
      if (ticket.priceQuotationRef) {
        const quoteRef = doc(
          db,
          "priceQuotationsData",
          ticket.priceQuotationRef
        );
        await updateDoc(quoteRef, {
          quotes: updatedQuotes,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error deleting quote:", error);
      alert("Failed to delete quote. Please try again.");
    }
  };

  const calculateTotal = () => {
    return quotesList
      .reduce((total, quote) => total + quote.price * quote.quantity, 0)
      .toFixed(2);
  };

  const sendQuotationEmail = async () => {
    if (quotesList.length === 0) {
      alert("Please add items to the quotation before sending email.");
      return;
    }

    if (!ticket.emailAddress) {
      alert("No email address found for this customer.");
      return;
    }

    setIsEmailLoading(true);

    try {
      // Generate email content
      const quotationItemsHtml = quotesList
        .map(
          (quote, index) =>
            `<tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${
            quote.service ? "Service" : "Part"
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${
            quote.partNumber || (quote.service ? quote.serviceType : "")
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${
            quote.description
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${
            quote.quantity
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${quote.price.toFixed(
            2
          )} JOD</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${(
            quote.price * quote.quantity
          ).toFixed(2)} JOD</td>
        </tr>`
        )
        .join("");

      // Convert logos to base64
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

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #094549; padding-bottom: 15px;">
            ${
              headerLogoBase64
                ? `<img src="${headerLogoBase64}" alt="365 Solutions Logo" style="max-height: 60px; height: auto; margin-right: 20px;" />`
                : ""
            }
            <h2 style="color: #094549; margin: 0; flex-grow: 1;">Price Quotation</h2>
          </div>
          <h3>Ticket #${ticket.location}${ticket.ticketNum}</h3>
          <p><strong>Customer:</strong> ${ticket.customerName}</p>

          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 10px; border: 1px solid #ddd;">#</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Type</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Part #</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Description</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Qty</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Price</th>
                <th style="padding: 10px; border: 1px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${quotationItemsHtml}
              <tr style="background-color: #f9f9f9; font-weight: bold;">
                <td colspan="6" style="padding: 10px; border: 1px solid #ddd; text-align: right;">Grand Total:</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${calculateTotal()} JOD</td>
              </tr>
            </tbody>
          </table>
          
          <p style="margin-top: 15px; font-style: italic; color: #333; text-align: center;">
            All prices include 16% sales tax
          </p>
          
          <p style="margin-top: 30px; color: #666;">
            This quotation is valid for 7 days from the date of issue.
          </p>
          
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
        </div>
      `;

      // Send email via server endpoint
      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: ticket.emailAddress,
          subject: `Price Quotation - Ticket #${ticket.ticketId}`,
          html: emailHtml,
          location: ticket.location, // Pass location for SMTP configuration
        }),
      });

      if (response.ok) {
        alert(`Price quotation sent successfully to ${ticket.emailAddress}`);
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
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="right-modal"
      overlayClassName="modal-overlay"
    >
      <button className="modal-close-button" onClick={onClose}>
        ×
      </button>

      <div className="modal-form">
        <div className="logo-section">
          <h2>Price Quotation</h2>
          <div className="underline"></div>
        </div>

        <div>
          <label>
            <strong>Ticket#:</strong>
          </label>
          <p>{ticket?.ticketNum}</p>
        </div>

        <div>
          <label>
            <strong>Customer:</strong>
          </label>
          <p>{ticket?.customerName}</p>
        </div>

        {/* Service Section */}
        <div className="service-section">
          <div className="service-row">
            <div className="service-checkbox">
              <input
                type="checkbox"
                checked={service}
                onChange={(e) => setService(e.target.checked)}
              />
              <label>Service</label>
            </div>

            {service && (
              <div className="service-type-select">
                <label>Service Type:</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="">Select Service Type</option>
                  <option value="Diagnosis">Diagnosis</option>
                  <option value="Repair">Repair</option>
                  <option value="Software Update">Software Update</option>
                  <option value="Hardware Installation">
                    Hardware Installation
                  </option>
                  <option value="Data Recovery">Data Recovery</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Consultation">Consultation</option>
                  <option value="Custom">Custom</option>
                </select>
                {serviceType === "Custom" && (
                  <input
                    type="text"
                    className="custom-service-input"
                    placeholder="Enter custom service type"
                    value={customServiceType}
                    onChange={(e) => setCustomServiceType(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Part Number - only show if not service */}
        {!service && (
          <div>
            <label>
              <strong>Part #:</strong>
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="Enter part number"
            />
          </div>
        )}

        <div>
          <label>
            <strong>Description:</strong>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
          />
        </div>

        <div>
          <label>
            <strong>Quantity:</strong>
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            min="1"
          />
        </div>

        <div>
          <label>
            <strong>Price:</strong>
          </label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter price"
            min="0"
          />
        </div>

        <button className="apply-button" onClick={addQuote}>
          Add to Quote
        </button>

        {/* Quote List */}
        {quotesList.length > 0 && (
          <div className="delivery-header">
            <h3>Price Quotation Items</h3>
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotesList.map((quote, index) => (
                  <tr key={index}>
                    <td>{quote.service ? "Service" : "Part"}</td>
                    <td>
                      {quote.partNumber ||
                        (quote.service ? quote.serviceType : "")}
                    </td>
                    <td>{quote.description}</td>
                    <td>{quote.quantity}</td>
                    <td>{quote.price.toFixed(2)} JOD</td>
                    <td>{(quote.price * quote.quantity).toFixed(2)} JOD</td>
                    <td>
                      <button
                        className="delete-part-button"
                        onClick={() => deleteQuote(index)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  <td colSpan="5">Total:</td>
                  <td>{calculateTotal()} JOD</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="modal-actions">
        {quotesList.length > 0 && (
          <button
            className="apply-button"
            onClick={sendQuotationEmail}
            disabled={isEmailLoading}
            style={{
              marginBottom: "10px",
              backgroundColor: isEmailLoading ? "#ccc" : "#3333cc",
            }}
          >
            {isEmailLoading ? "Sending..." : "Send Price Quotation by Email"}
          </button>
        )}
        <button className="save-button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default PriceQuotationModal;
