import React, { useState, useEffect, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import logo from "../assets/logo-and-apple.png";
import "./PaymentReceipt.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FaPrint, FaDownload, FaEnvelope } from "react-icons/fa";
import { API_ENDPOINTS } from "../config/api";

// Public URL is required for emails, so email clients can render the logo.
const logoUrlForEmail =
  "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";

const ModernInvoicePaymentReceipt = () => {
  const { invoiceId, paymentIndex } = useParams();
  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const componentRef = useRef(null); // Keep for PDF download

  useEffect(() => {
    const fetchReceiptData = async () => {
      setLoading(true);
      try {
        const invoiceRef = doc(db, "modernInvoices", invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);

        if (invoiceSnap.exists()) {
          setInvoice(invoiceSnap.data());
          const payment = invoiceSnap.data().payments[paymentIndex];
          setPayment(payment);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching receipt data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [invoiceId, paymentIndex]);

  // Safe formatter for ticket date which may be a string or Firestore Timestamp
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

  const handlePrint = () => {
    if (!invoice || !payment) return;

    const image = new Image();
    image.src = logo; // Use the imported local asset

    image.onload = () => {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const contentString = ReactDOMServer.renderToString(
          <PrintableContent invoice={invoice} payment={payment} />
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
    };

    image.onerror = () => {
      console.error("Could not load logo for printing. Printing without it.");
      // Fallback to printing without the image if it fails to load
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const contentString = ReactDOMServer.renderToString(
          <PrintableContent invoice={invoice} payment={payment} />
        );
        printWindow.document.write(contentString);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 50);
      }
    };
  };

  const PrintableContent = ({ invoice, payment }) => {
    if (!invoice || !payment) {
      return null;
    }

    // Inline styles for printing
    const styles = `
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .receipt-container { background-color: #fff; padding: 40px; margin: 20px auto; border-radius: 8px; width: 100%; max-width: 800px; }
        .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
        .receipt-logo { max-width: 250px; height: auto; }
        .receipt-header h1 { font-size: 2.5rem; color: #0056b3; margin: 0; }
        .receipt-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .receipt-section h2 { font-size: 1.5rem; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .receipt-section p { margin: 10px 0; font-size: 1rem; line-height: 1.6; }
        .receipt-section p strong { color: #555; min-width: 120px; display: inline-block; }
        .receipt-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; font-size: 0.9rem; color: #777; }
        .footer-contact { margin-top: 10px; }
    `;

    return (
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>{styles}</style>
        </head>
        <body>
          <div className="receipt-container">
            <div className="receipt-header">
              <img src={logo} alt="Company Logo" className="receipt-logo" />
              <h1>Payment Receipt</h1>
            </div>
            <div className="receipt-details">
              <div className="receipt-section">
                <h2>Customer Information</h2>
                <p>
                  <strong>Name:</strong> {invoice.customerName}
                </p>
                <p>
                  <strong>Mobile:</strong> {invoice.mobileNumber}
                </p>
                <p>
                  <strong>Email:</strong> {invoice.emailAddress}
                </p>
                {invoice.customerType === "business" && (
                  <p>
                    <strong>Company:</strong> {invoice.companyName}
                  </p>
                )}
              </div>
              <div className="receipt-section">
                <h2>Payment Information</h2>
                <p>
                  <strong>Payment ID:</strong> {invoiceId}
                  {paymentIndex + 1}
                </p>
                <p>
                  <strong>Payment Date:</strong>{" "}
                  {formatDate(payment.paymentDate)}
                </p>
                <p>
                  <strong>Amount Paid:</strong> JOD{" "}
                  {Number(payment.amount).toFixed(2)}
                </p>
                <p>
                  <strong>Payment Method:</strong> {payment.paymentMethod}
                </p>
                <p>
                  <strong>Received By:</strong> {payment.receivedBy}
                </p>
              </div>
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
        </body>
      </html>
    );
  };

  const handleDownloadPdf = () => {
    const input = componentRef.current;
    if (!input) {
      console.error("Component to download is not available.");
      return;
    }
    html2canvas(input, { useCORS: true, scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt-${invoiceId}-${paymentIndex + 1}.pdf`);
    });
  };

  const handleSendEmail = async () => {
    if (!ticket || !payment) return;

    const emailHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .receipt-container { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; }
            .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .receipt-logo { max-width: 250px; }
            .receipt-details { margin-top: 20px; }
            .receipt-section { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="receipt-header">
              <img src="${logoUrlForEmail}" alt="Company Logo" class="receipt-logo" />
              <h1>Payment Receipt</h1>
            </div>
            <div class="receipt-details">
              <div class="receipt-section">
                <h2>Customer Information</h2>
                <p><strong>Name:</strong> ${invoice.customerName}</p>
                <p><strong>Mobile:</strong> ${invoice.mobileNumber}</p>
                <p><strong>Email:</strong> ${invoice.emailAddress}</p>
                ${
                  invoice.customerType === "business"
                    ? `<p><strong>Company:</strong> ${invoice.companyName}</p>`
                    : ""
                }
              </div>
              <div class="receipt-section">
                <h2>Payment Information</h2>
                <p><strong>Payment ID:</strong> ${invoiceId}${paymentIndex + 1}</p>
                <p><strong>Payment Date:</strong> ${payment.paymentDate
                  ?.toDate()
                  .toLocaleString()}</p>
                <p><strong>Amount Paid:</strong> JOD ${Number(
                  payment.amount
                ).toFixed(2)}</p>
                <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
                <p><strong>Received By:</strong> ${payment.receivedBy}</p>
              </div>
            </div>
             <div class="receipt-footer" style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; font-size: 0.9rem; color: #777;">
                <p>Thank you for your business!</p>
                <p
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <strong>365 Solutions</strong>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              marginLeft: "10px",
            }}
          >
            <div>
              | help@365solutionsjo.com | +962 79 681 8189 | Amman, Jordan
            </div>
            <div>
              | Irbid@365solutionsjo.com | +962 79 666 8831 | Irbid, Jordan
            </div>
          </div>
        </p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ticket.emailAddress,
          subject: `Payment Receipt for Ticket #${ticket.location}${ticket.ticketNum}`,
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

  if (!invoice || !payment) {
    return <div className="receipt-container">Receipt not found.</div>;
  }

  // This is the visible component on the page
  const VisibleContent = () => (
    <div className="receipt-container" ref={componentRef}>
      <div className="receipt-header">
        <img src={logo} alt="Company Logo" className="receipt-logo" />
        <h1>Payment Receipt</h1>
      </div>
      <div className="receipt-details">
        <div className="receipt-section">
          <h2>Customer Information</h2>
          <p>
            <strong>Name:</strong> {invoice.customerName}
          </p>
          <p>
            <strong>Mobile:</strong> {invoice.mobileNumber}
          </p>
          <p>
            <strong>Email:</strong> {invoice.emailAddress}
          </p>
          {invoice.customerType === "business" && (
            <p>
              <strong>Company:</strong> {invoice.companyName}
            </p>
          )}
        </div>
        <div className="receipt-section">
          <h2>Payment Information</h2>
          <p>
            <strong>Payment ID:</strong> {invoiceId}
            {paymentIndex + 1}
          </p>
          <p>
            <strong>Payment Date:</strong> {formatDate(payment.paymentDate)}
          </p>
          <p>
            <strong>Amount Paid:</strong> JOD{" "}
            {Number(payment.amount).toFixed(2)}
          </p>
          <p>
            <strong>Payment Method:</strong> {payment.paymentMethod}
          </p>
          <p>
            <strong>Received By:</strong> {payment.receivedBy}
          </p>
        </div>
      </div>
      <div className="receipt-footer">
        <p>Thank you for your business!</p>
        <p
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <strong>365 Solutions</strong>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              marginLeft: "10px",
            }}
          >
            <div>
              | help@365solutionsjo.com | +962 79 681 8189 | Amman, Jordan
            </div>
            <div>
              | Irbid@365solutionsjo.com | +962 79 666 8831 | Irbid, Jordan
            </div>
          </div>
        </p>
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
    </div>
  );
};

export default ModernInvoicePaymentReceipt;
