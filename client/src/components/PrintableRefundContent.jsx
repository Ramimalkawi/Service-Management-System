import React from "react";

import logo from "../assets/logo-and-apple.png";
import "./PrintableTicket.css";
import "./PrintableRefundContent.css";

const PrintableRefundContent = React.forwardRef(
  ({ ticket, refund, signatureImage }, ref) => {
    if (!ticket || !refund) {
      return <div ref={ref}>Loading...</div>;
    }

    const formatDate = (date) => {
      return new Date(date.seconds * 1000).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
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
              <strong>Name:</strong> {ticket.customerName}
            </p>
            <p>
              <strong>Phone:</strong> {ticket.mobileNumber}
            </p>
          </div>
          <div className="receipt-section">
            <h2>Ticket Information</h2>
            <p>
              <strong>Ticket #:</strong> {ticket.location}
              {ticket.ticketNum}
            </p>
            <p>
              <strong>Device:</strong> {ticket.machineType}
            </p>
            <p>
              <strong>Serial Number:</strong> {ticket.serialNum}
            </p>
          </div>
        </div>
        <div className="receipt-section">
          <h2>Refund Details</h2>
          <p>
            <strong>Refund ID:</strong> {ticket.location}
            {ticket.ticketNum}
          </p>
          <p>
            <strong>Refund Date:</strong> {formatDate(refund.refundDate)}
          </p>
          <p>
            <strong>Amount Refunded:</strong> $
            {parseFloat(refund.amount).toFixed(2)}
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
