import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FaPrint, FaDownload, FaEnvelope, FaSignature } from "react-icons/fa";
import { API_ENDPOINTS } from "../config/api";
import SignatureRefundModal from "../components/SignatureRefundModal";
import PrintableRefundContent from "../components/PrintableRefundContent";
import "./PaymentReceipt.css";

const RefundReceipt = () => {
  const { ticketId, refundId } = useParams();
  const [refund, setRefund] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSignatureModalOpen, setSignatureModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const printableContentRef = useRef();

  useEffect(() => {
    const fetchReceiptData = async () => {
      setLoading(true);
      try {
        const ticketRef = doc(db, "tickets", ticketId);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          setTicket({ id: ticketSnap.id, ...ticketSnap.data() });
        }

        const refundRef = doc(db, "tickets", ticketId, "refunds", refundId);
        const refundSnap = await getDoc(refundRef);
        if (refundSnap.exists()) {
          const refundData = { id: refundSnap.id, ...refundSnap.data() };
          setRefund(refundData);
          setPdfUrl(refundData.pdfUrl || null);
        }
      } catch (error) {
        console.error("Error fetching receipt data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [ticketId, refundId]);

  const generateAndUploadPdf = async (signatureDataUrl = null) => {
    const contentElement = printableContentRef.current;
    if (!contentElement) return;

    try {
      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        onclone: (document) => {
          // If a new signature is being added, update the image source in the cloned document
          if (signatureDataUrl) {
            const signatureImg = document.querySelector(
              ".signature-image-for-pdf"
            );
            if (signatureImg) {
              signatureImg.src = signatureDataUrl;
            }
          }
        },
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pdfWidth,
        pdfHeight
      );

      const pdfBlob = pdf.output("blob");
      const pdfStorageRef = ref(
        storage,
        `refund-receipts/${ticketId}/${refundId}.pdf`
      );

      await uploadString(
        pdfStorageRef,
        pdf.output("datauristring"),
        "data_url"
      );
      const downloadUrl = await getDownloadURL(pdfStorageRef);

      await updateDoc(doc(db, "tickets", ticketId, "refunds", refundId), {
        pdfUrl: downloadUrl,
      });

      setPdfUrl(downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error("Error generating or uploading PDF:", error);
      alert("Failed to create or save PDF receipt.");
    }
  };

  const handleSignatureSave = async (signatureDataUrl) => {
    setRefund((prev) => ({ ...prev, signatureUrl: signatureDataUrl }));
    setSignatureModalOpen(false);

    // Regenerate and upload the PDF with the new signature
    await generateAndUploadPdf(signatureDataUrl);
  };

  const handleDownloadPdf = async () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else {
      alert("Generating PDF... please wait.");
      const newPdfUrl = await generateAndUploadPdf(refund?.signatureUrl);
      if (newPdfUrl) {
        window.open(newPdfUrl, "_blank");
      }
    }
  };

  const handlePrint = () => {
    const content = printableContentRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write("<html><head><title>Print Receipt</title>");

      // Copy all style tags from the main document to the print window
      const styles = document.head.querySelectorAll(
        'style, link[rel="stylesheet"]'
      );
      styles.forEach((style) => {
        printWindow.document.head.appendChild(style.cloneNode(true));
      });

      printWindow.document.write("</head><body>");
      printWindow.document.write(content.innerHTML);
      printWindow.document.write("</body></html>");
      printWindow.document.close();

      // Use a timeout to ensure styles are loaded before printing
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 1000); // Increased timeout for better style loading
    }
  };

  const handleSendEmail = async () => {
    if (!ticket) return;

    let currentPdfUrl = pdfUrl;
    if (!currentPdfUrl) {
      alert("Generating PDF to attach to email...");
      currentPdfUrl = await generateAndUploadPdf(refund?.signatureUrl);
      if (!currentPdfUrl) {
        alert("Could not generate PDF for email.");
        return;
      }
    }

    const emailHtml = `
      <p>Dear ${ticket.customerName},</p>
      <p>Please find your refund receipt for ticket #${ticket.ticketId} attached.</p>
      <p>You can also download it directly from this link: <a href="${currentPdfUrl}">Download Receipt</a></p>
      <br/>
      <p>Thank you,</p>
      <p>365 Solutions Team</p>
    `;

    try {
      await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ticket.customerEmail,
          subject: `Your Refund Receipt for Ticket #${ticket.ticketId}`,
          html: emailHtml,
          attachments: [
            {
              filename: `refund-receipt-${refundId}.pdf`,
              path: currentPdfUrl,
            },
          ],
        }),
      });
      alert("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email.");
    }
  };

  if (loading) {
    return <div className="receipt-container">Loading...</div>;
  }

  if (!ticket || !refund) {
    return <div className="receipt-container">Receipt not found.</div>;
  }

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

      {/* This component is for display on the screen */}
      <div className="receipt-container">
        <PrintableRefundContent
          ref={printableContentRef}
          ticket={ticket}
          refund={refund}
          signatureImage={refund?.signatureUrl}
        />
        {!refund.signatureUrl && (
          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <button
              onClick={() => setSignatureModalOpen(true)}
              className="btn-sign"
            >
              <FaSignature /> Sign Receipt
            </button>
          </div>
        )}
      </div>

      {isSignatureModalOpen && (
        <SignatureRefundModal
          ticketId={ticketId}
          refundId={refundId}
          onClose={() => setSignatureModalOpen(false)}
          onSignatureSave={handleSignatureSave}
        />
      )}

      {/* A hidden version for PDF generation that can be manipulated */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <PrintableRefundContent
          ref={printableContentRef}
          ticket={ticket}
          refund={refund}
          signatureImage={refund?.signatureUrl}
        />
      </div>
    </div>
  );
};

export default RefundReceipt;
