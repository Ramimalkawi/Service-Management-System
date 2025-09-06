import React, { useState, useEffect, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import logo from "../assets/logo-and-apple.png";
import "./PaymentReceipt.css"; // Reuse the same CSS for consistent styling
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FaPrint, FaDownload, FaEnvelope, FaSignature } from "react-icons/fa";
import { API_ENDPOINTS } from "../config/api";
import SignatureRefundModal from "../components/SignatureRefundModal";

const logoUrlForEmail =
  "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";

const PrintableRefundContent = ({ ticket, refund }) => {
  if (!ticket || !refund) {
    return null;
  }

  const styles = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt-container { background-color: #fff; padding: 40px; margin: 20px auto; border-radius: 8px; width: 100%; max-width: 800px; }
    .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
    .receipt-logo { max-width: 250px; height: auto; }
    .receipt-header h1 { font-size: 2.5rem; color: #d32f2f; margin: 0; }
    .receipt-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .receipt-section h2 { font-size: 1.5rem; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
    .receipt-section p { margin: 10px 0; font-size: 1rem; line-height: 1.6; }
    .receipt-section p strong { color: #555; min-width: 120px; display: inline-block; }
    .signature-section { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    .signature-section h3 { font-size: 1.2rem; color: #333; }
    .signature-image { max-width: 250px; height: auto; margin-top: 10px; border-bottom: 1px solid #000; }
    .receipt-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; font-size: 0.9rem; color: #777; }
    .footer-contact { margin-top: 10px; }
  `;

  return (
    <html>
      <head>
        <title>Refund Receipt</title>
        <style>{styles}</style>
      </head>
      <body>
        <div className="receipt-container">
          <div className="receipt-header">
            <img src={logo} alt="Company Logo" className="receipt-logo" />
            <h1>Refund Receipt</h1>
          </div>
          <div className="receipt-details">
            <div className="receipt-section">
              <h2>Customer Information</h2>
              <p>
                <strong>Name:</strong> {ticket.customerName}
              </p>
              <p>
                <strong>Mobile:</strong> {ticket.mobileNumber}
              </p>
              <p>
                <strong>Email:</strong> {ticket.emailAddress}
              </p>
            </div>
            <div className="receipt-section">
              <h2>Refund Information</h2>
              <p>
                <strong>Refund ID:</strong> {ticket.location}
                {ticket.ticketNum}
              </p>
              <p>
                <strong>Refund Date:</strong>{" "}
                {refund.refundDate?.toDate().toLocaleString()}
              </p>
              <p>
                <strong>Amount Refunded:</strong> JOD{" "}
                {Number(refund.amount).toFixed(2)}
              </p>
              <p>
                <strong>Refund Method:</strong> {refund.refundMethod}
              </p>
              <p>
                <strong>Reason:</strong> {refund.reason}
              </p>
              <p>
                <strong>Processed By:</strong> {refund.refundedBy}
              </p>
            </div>
          </div>
          {refund.signatureUrl && (
            <div className="signature-section">
              <h3>Customer Signature</h3>
              <img
                src={refund.signatureUrl}
                alt="Customer Signature"
                className="signature-image"
              />
            </div>
          )}
          <div className="receipt-footer">
            <p>We appreciate your understanding.</p>
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
      </body>
    </html>
  );
};

const RefundReceipt = () => {
  const { ticketId, refundId } = useParams();
  const [refund, setRefund] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSignatureModalOpen, setSignatureModalOpen] = useState(false);
  const componentRef = useRef(null);

  useEffect(() => {
    const fetchReceiptData = async () => {
      setLoading(true);
      try {
        const ticketRef = doc(db, "tickets", ticketId);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          setTicket(ticketSnap.data());
        }

        const refundRef = doc(db, "tickets", ticketId, "refunds", refundId);
        const refundSnap = await getDoc(refundRef);
        if (refundSnap.exists()) {
          setRefund({ id: refundSnap.id, ...refundSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching receipt data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [ticketId, refundId]);

  const handleSignatureSave = (signatureUrl) => {
    setRefund((prevRefund) => ({ ...prevRefund, signatureUrl }));
  };

  const handlePrint = () => {
    if (!ticket || !refund) return;

    const imagesToLoad = [logo];
    if (refund.signatureUrl) {
      imagesToLoad.push(refund.signatureUrl);
    }

    let loadedImages = 0;
    const totalImages = imagesToLoad.length;

    const onImageLoad = () => {
      loadedImages++;
      if (loadedImages === totalImages) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          const contentString = ReactDOMServer.renderToString(
            <PrintableRefundContent ticket={ticket} refund={refund} />
          );
          printWindow.document.write(contentString);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 50);
        }
      }
    };

    imagesToLoad.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = onImageLoad;
      img.onerror = onImageLoad; // Also count as "loaded" to not block printing
    });
  };

  const handleDownloadPdf = () => {
    const input = componentRef.current;
    if (!input) return;
    html2canvas(input, { useCORS: true, scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`refund-receipt-${ticket.ticketNum}-${refundId}.pdf`);
    });
  };

  const handleSendEmail = async () => {
    if (!ticket || !refund) return;

    const emailHtml = ReactDOMServer.renderToString(
      <PrintableRefundContent ticket={ticket} refund={refund} />
    );

    try {
      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ticket.emailAddress,
          subject: `Refund Confirmation for Ticket #${ticket.location}${ticket.ticketNum}`,
          html: emailHtml,
          location: ticket.location,
        }),
      });

      if (response.ok) {
        alert("Email sent successfully!");
      } else {
        alert("Failed to send email.");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("An error occurred while sending the email.");
    }
  };

  if (loading) {
    return <div className="receipt-container">Loading...</div>;
  }

  if (!ticket || !refund) {
    return <div className="receipt-container">Receipt not found.</div>;
  }

  const VisibleContent = () => (
    <div className="receipt-container" ref={componentRef}>
      <div className="receipt-header">
        <img src={logo} alt="Company Logo" className="receipt-logo" />
        <h1 style={{ color: "#d32f2f" }}>Refund Receipt</h1>
      </div>
      <div className="receipt-details">
        <div className="receipt-section">
          <h2>Customer Information</h2>
          <p>
            <strong>Name:</strong> {ticket.customerName}
          </p>
          <p>
            <strong>Mobile:</strong> {ticket.mobileNumber}
          </p>
          <p>
            <strong>Email:</strong> {ticket.emailAddress}
          </p>
        </div>
        <div className="receipt-section">
          <h2>Refund Information</h2>
          <p>
            <strong>Refund ID:</strong> {ticket.location}
            {ticket.ticketNum}
          </p>
          <p>
            <strong>Refund Date:</strong>{" "}
            {refund.refundDate?.toDate().toLocaleString()}
          </p>
          <p>
            <strong>Amount Refunded:</strong> JOD{" "}
            {Number(refund.amount).toFixed(2)}
          </p>
          <p>
            <strong>Refund Method:</strong> {refund.refundMethod}
          </p>
          <p>
            <strong>Reason:</strong> {refund.reason}
          </p>
          <p>
            <strong>Processed By:</strong> {refund.refundedBy}
          </p>
        </div>
      </div>
      {refund.signatureUrl ? (
        <div
          className="signature-section"
          style={{
            marginTop: "40px",
            paddingTop: "20px",
            borderTop: "1px solid #eee",
          }}
        >
          <h3>Customer Signature</h3>
          <img
            src={refund.signatureUrl}
            alt="Customer Signature"
            style={{
              maxWidth: "250px",
              height: "auto",
              marginTop: "10px",
              borderBottom: "1px solid #000",
            }}
          />
        </div>
      ) : (
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <button
            onClick={() => setSignatureModalOpen(true)}
            className="btn-sign"
          >
            <FaSignature /> Sign Receipt
          </button>
        </div>
      )}
      <div className="receipt-footer">
        <p>We appreciate your understanding.</p>
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

  return (
    <div className="receipt-page-container">
      <div className="receipt-actions">
        <button onClick={handlePrint} title="Print Receipt">
          <FaPrint />
        </button>
        <button onClick={handleDownloadPdf} title="Download PDF">
          <FaDownload />
        </button>
        <button onClick={handleSendEmail} title="Send Email">
          <FaEnvelope />
        </button>
      </div>
      <VisibleContent />
      {isSignatureModalOpen && (
        <SignatureRefundModal
          ticketId={ticketId}
          refundId={refundId}
          onClose={() => setSignatureModalOpen(false)}
          onSignatureSave={handleSignatureSave}
        />
      )}
    </div>
  );
};

export default RefundReceipt;
