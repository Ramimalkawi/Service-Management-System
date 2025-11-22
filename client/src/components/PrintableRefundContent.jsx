import React from "react";

import logo from "../assets/logo-and-apple.png";
import "./PrintableTicket.css";
import "./PrintableRefundContent.css";

const PrintableRefundContent = React.forwardRef(
  ({ invoice, refund, signatureImage }, ref) => {
    if (!invoice || !refund) {
      return <div ref={ref}>Loading...</div>;
    }

    // const formatDate = (date) => {
    //   return new Date(date.seconds * 1000).toLocaleString("en-US", {
    //     year: "numeric",
    //     month: "long",
    //     day: "numeric",
    //     hour: "2-digit",
    //     minute: "2-digit",
    //     hour12: true,
    //   });
    // };

    const formatDate = (d) => {
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

    return (
      <div
        ref={ref}
        className="printable-content receipt-container"
        style={{ background: "#fff" }}
      >
        <div
          className="receipt-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #f0f0f0",
            paddingBottom: "20px",
            marginBottom: "30px",
          }}
        >
          <img
            src={logo}
            alt="Company Logo"
            className="receipt-logo"
            style={{ maxWidth: "250px", height: "auto" }}
          />
          <h1 style={{ fontSize: "2rem", color: "#d32f2f", margin: 0 }}>
            Refund Receipt
          </h1>
        </div>
        <div className="receipt-details">
          <div className="receipt-section">
            <h2>Customer Information</h2>
            <p>
              <strong>Name:</strong> {invoice.customerName}
            </p>
            <p>
              <strong>Phone:</strong> {invoice.mobileNumber}
            </p>
          </div>
          <div className="receipt-section">
            <h2>Ticket Information</h2>
            <p>
              <strong>Ticket #:</strong>
              {invoice.location}
              {invoice.ticketNum}
            </p>
            <p>
              <strong>Device:</strong> {invoice.machineType}
            </p>
          </div>
        </div>
        <div className="receipt-section">
          <h2>Refund Details</h2>
          <p>
            <strong>Refund ID:</strong> {invoice.id}
          </p>
          <p>
            <strong>Refund Date:</strong> {formatDate(refund.refundDate)}
          </p>
          <p>
            <strong>Amount Refunded:</strong>
            {parseFloat(refund.amount).toFixed(2)} JOD
          </p>
          <p>
            <strong>Reason for Refund:</strong> {refund.reason}
          </p>
          <p>
            <strong>Processed By:</strong> {refund.refundedBy}
          </p>
        </div>
        <div className="signature-section">
          <h2>Customer Signature</h2>
          {signatureImage ? (
            <img
              src={signatureImage}
              alt="Customer Signature"
              className="signature-image-for-pdf"
              style={{
                maxWidth: "250px",
                height: "auto",
                marginTop: "10px",
                borderBottom: "1px solid #000",
              }}
            />
          ) : (
            <div
              style={{
                height: "50px",
                borderBottom: "1px solid #000",
                marginBottom: "10px",
              }}
            >
              {/* Placeholder for signature if not available */}
            </div>
          )}
          <p>I confirm the receipt of the refund amount stated above.</p>
        </div>
        <div className="receipt-footer">
          <p>Thank you for your business!</p>
          <div className="footer-contact">
            <strong>365 Solutions</strong>
            <div>
              | help@365solutionsjo.com | +962 79 681 8189 | Amman, Jordan
            </div>
            <div>
              | Irbid@365solutionsjo.com | +962 79 666 8831 | Irbid, Jordan
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default PrintableRefundContent;
