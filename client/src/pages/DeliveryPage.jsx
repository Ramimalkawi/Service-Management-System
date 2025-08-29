import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { FaArrowRight } from "react-icons/fa";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import SignatureCanvas from "react-signature-canvas";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUser } from "../context/userContext";
import logoImage from "../assets/logo_new.png";
import { API_ENDPOINTS } from "../config/api";

import "./DeliveryPage.css";

const DeliveryPage = () => {
  const { id } = useParams(); // ticket ID
  const { technician } = useUser();
  const [ticket, setTicket] = useState(null);
  const [isSigned, setIsSigned] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPartsModal, setShowPartsModal] = useState(false);
  const sigCanvas = useRef(null);
  const printRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTicket = async () => {
      const docRef = doc(db, "tickets", id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const ticketData = { id: snap.id, ...snap.data() };
        setTicket(ticketData);
        setShowNextButton(snap.data().partDeliveryNote ? true : false);

        // Test email functionality immediately (for debugging)
        console.log("🧪 Testing email function with current ticket data");
        // Uncomment the line below to test email immediately when page loads
        // await sendTicketClosedEmail(ticketData);
      }
    };
    fetchTicket();
  }, [id]);

  const sendTicketClosedEmail = async (updatedTicketData = null) => {
    try {
      const ticketData = updatedTicketData || ticket;
      console.log(
        "🔄 Starting to send ticket closed email for:",
        ticketData.customerName
      );
      console.log("📧 Customer email:", ticketData.emailAddress);
      console.log("🎫 Ticket ID:", ticketData.id);
      console.log("📍 Location:", ticketData.location);

      // Check if customer email exists
      if (!ticketData.emailAddress || ticketData.emailAddress.trim() === "") {
        console.error("❌ No customer email address found");
        alert("Cannot send email: No customer email address found");
        return;
      }

      const currentDateTime = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Generate Firebase Storage URLs for signed documents
      const documentLinks = [];

      // // Add service contract link if available
      if (ticketData.contractURL) {
        const contractUrl = `https://firebasestorage.googleapis.com/v0/b/solutions-system-1e0f5.appspot.com/o/${encodeURIComponent(
          ticketData.contractURL
        )}?alt=media`;
        documentLinks.push({
          name: "Service Agreement Contract",
          url: contractUrl,
          icon: "📄",
        });
      }

      // // Add delivery receipt link if available
      if (ticketData.deliveryNoteURL) {
        const deliveryUrl = `https://firebasestorage.googleapis.com/v0/b/solutions-system-1e0f5.appspot.com/o/${encodeURIComponent(
          ticketData.deliveryNoteURL
        )}?alt=media`;
        documentLinks.push({
          name: "Delivery Receipt",
          url: deliveryUrl,
          icon: "🧾",
        });
      }

      // // Add parts delivery note link if available
      if (ticketData.partsDeliveryNoteURL) {
        const partsUrl = `https://firebasestorage.googleapis.com/v0/b/solutions-system-1e0f5.appspot.com/o/${encodeURIComponent(
          ticketData.partsDeliveryNoteURL
        )}?alt=media`;
        documentLinks.push({
          name: "Parts Delivery Note",
          url: partsUrl,
          icon: "🔧",
        });
      }

      // console.log("📋 Document links found:", documentLinks.length);

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
            .completion-notice { 
              background-color: #d1ecf1; 
              border: 1px solid #bee5eb; 
              color: #0c5460; 
              padding: 15px; 
              border-radius: 8px; 
              margin: 15px 0; 
            }
            .documents-section {
              background-color: white; 
              padding: 15px; 
              margin: 15px 0; 
              border-radius: 8px;
              border: 2px solid #1ccad4;
            }
            .document-link { 
              display: inline-block; 
              background-color: #1ccad4; 
              color: white; 
              padding: 10px 20px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 8px 8px 8px 0; 
              font-weight: bold;
            }
            .document-link:hover { background-color: #16b1bd; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h2>✅ Service Completed - Ticket Closed</h2>
              <p>365Solutions - Apple Authorized Service Center</p>
            </div>
            
            <div class="content">
              <p>Dear ${ticketData.customerName},</p>
              
              <div class="completion-notice">
                <h3 style="margin-top: 0;">🎉 Service Complete!</h3>
                <p><strong>Your device has been successfully repaired and delivered. Your service ticket is now closed.</strong></p>
                <p>We hope you're satisfied with our repair service. Thank you for choosing 365Solutions!</p>
              </div>
              
              <div class="ticket-info">
                <h3 style="color: #28a745;">Final Service Summary</h3>
                <div class="info-row">
                  <span class="label">Ticket Number:</span> ${
                    ticketData.location
                  }${ticketData.ticketNum}
                </div>
                <div class="info-row">
                  <span class="label">Completion Date:</span> ${currentDateTime}
                </div>
                <div class="info-row">
                  <span class="label">Device Type:</span> ${
                    ticketData.machineType
                  }
                </div>
                <div class="info-row">
                  <span class="label">Serial Number:</span> ${
                    ticketData.serialNum
                  }
                </div>
                <div class="info-row">
                  <span class="label">Original Issue:</span> ${
                    ticketData.symptom
                  }
                </div>
                ${
                  ticketData.caseID
                    ? `<div class="info-row"><span class="label">Repair ID:</span> ${ticketData.caseID}</div>`
                    : ""
                }
                <div class="info-row">
                  <span class="label">Service Status:</span> <strong style="color: #28a745;">COMPLETED ✅</strong>
                </div>
              </div>
              
              ${
                documentLinks.length > 0
                  ? `
              <div class="documents-section">
                <h3 style="color: #1ccad4; margin-top: 0;">📋 Your Signed Documents</h3>
                <p>Please download and keep copies of your signed service documents for your records:</p>
                ${documentLinks
                  .map(
                    (doc) => `
                  <a href="${doc.url}" class="document-link" target="_blank">
                    ${doc.icon} Download ${doc.name}
                  </a>
                `
                  )
                  .join("")}
              </div>
              `
                  : ""
              }
              
              <div style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 8px;">
                <h3 style="color: #1ccad4;">Thank You for Choosing 365Solutions!</h3>
                <p>✅ <strong>Service completed successfully</strong></p>
                <p>✅ <strong>Device delivered to customer</strong></p>
                <p>✅ <strong>All documentation provided</strong></p>
                
                <p><strong>Customer Satisfaction:</strong></p>
                <p>Your satisfaction is important to us. If you have any questions about the repair or need further assistance, please don't hesitate to contact us.</p>
                
                <p><strong>Warranty Information:</strong></p>
                <p>Please keep your service documents as they contain important warranty information for the repair work performed.</p>
              </div>
              
              <p><strong>Future Service Needs:</strong></p>
              <p>Should you need any future repairs or have questions about your device, please contact us at:</p>
              <ul>
                <li>Email: ${
                  ticketData.location === "M"
                    ? "help@365solutionsjo.com"
                    : "irbid@365solutionsjo.com"
                }</li>
                <li>Phone: ${
                  ticketData.location === "M"
                    ? "+962-6-XXX-XXXX"
                    : "+962-2-XXX-XXXX"
                }</li>
              </ul>
              
              <div class="footer">
                <p>365Solutions - Apple Authorized Service Center</p>
                <p>Professional device repair services you can trust</p>
                <p><strong>Thank you for your business!</strong></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: ticketData.emailAddress,
        subject: `✅ Service Complete - Ticket Closed #${ticketData.location}${ticketData.ticketNum}`,
        html: emailHtml,
        location: ticketData.location,
      };

      console.log("📤 Sending email to:", emailData.to);
      console.log("📧 Email subject:", emailData.subject);
      console.log("🔄 Full email data:", JSON.stringify(emailData, null, 2));

      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        console.log("Ticket closed email sent successfully");
        alert("Ticket closed email sent successfully!"); // Add visual confirmation
      } else {
        console.error("Failed to send ticket closed email");
        alert("Failed to send ticket closed email");
      }
    } catch (error) {
      console.error("Error sending ticket closed email:", error);
      alert(`Error sending email: ${error.message}`);
      // Don't throw error to avoid interrupting delivery note saving
    }
  };

  const handleSavePDF = async () => {
    if (!ticket || !ticket.id) return;

    try {
      // ✅ Ensure DOM is rendered before capturing
      setTimeout(async () => {
        const contentEl = printRef.current;
        if (!contentEl) {
          alert("PDF content not found");
          return;
        }
        setSaving(true);
        contentEl.classList.add("no-print-mode");

        const canvas = await html2canvas(contentEl, { scale: 2 });
        const imgData = canvas.toDataURL("image/jpeg");

        const pdf = new jsPDF("p", "mm", "a4");

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Maintain aspect ratio and fit height instead of width
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;

        const offsetX = (pdfWidth - finalWidth) / 2; // center horizontally
        const offsetY = 0; // start at top

        pdf.addImage(
          imgData,
          "JPEG",
          offsetX,
          offsetY,
          finalWidth,
          finalHeight,
          undefined,
          "FAST"
        );

        const pdfBlob = pdf.output("blob");

        const storage = getStorage();
        const filePath = `testDeliveryNotes/Delivery_${ticket.id}.pdf`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, pdfBlob);

        const url = await getDownloadURL(storageRef);

        // Add current technician to the array (allow duplicates for history tracking)
        const currentTechnicians = ticket.technicions || [];
        const technicianName = technician?.name || "Unknown Technician";
        const updatedTechnicians = [...currentTechnicians, technicianName];

        // Add to details array with timestamp and technician info
        const currentDetails = ticket.details || [];
        const formattedDate = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        const newDetail = `${formattedDate} - Closed by ${technicianName}`;
        const updatedDetails = [...currentDetails, newDetail];

        await updateDoc(doc(db, "tickets", ticket.id), {
          deliveryNoteURL: filePath,
          ticketStates: [...ticket.ticketStates, 7], // Add status 7 (Repair Marked Complete)
          technicions: updatedTechnicians, // Add current technician to the array
          details: updatedDetails, // Add closure details with timestamp
        });

        // Update local ticket state with new delivery note URL for email
        const updatedTicket = {
          ...ticket,
          deliveryNoteURL: filePath,
          ticketStates: [...ticket.ticketStates, 7],
          technicions: updatedTechnicians,
          details: updatedDetails,
        };
        setTicket(updatedTicket);

        // Send ticket closed email to customer with updated ticket data
        await sendTicketClosedEmail(updatedTicket);

        alert("Delivery note was saved successfully");
        setSaving(false);
        if (!showNextButton) {
          navigate(`/tickets/`);
        }
      }, 200); // slight delay ensures rendering is complete
    } catch (err) {
      console.error("Error saving delivery note:", err);
      alert("Failed to save PDF.");
    } finally {
      // ✅ Always remove the class afterward
      setSaving(false);
      printRef.current?.classList.remove("no-print-mode");
      setIsSigned(false);
    }
  };

  const handleSavePDF2notued = async () => {
    if (!ticket) return;
    try {
      const contentEl = printRef.current;
      contentEl.classList.add("no-print-mode");

      const canvas = await html2canvas(contentEl, { scale: 2 });
      const imgData = canvas.toDataURL("image/jpeg");

      const pdf = new jsPDF("p", "mm", "a4");
      const ratio = Math.min(
        pdf.internal.pageSize.getWidth() / canvas.width,
        pdf.internal.pageSize.getHeight() / canvas.height
      );
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(
        imgData,
        "JPEG",
        (210 - width) / 2,
        0,
        width,
        height,
        undefined,
        "FAST"
      );

      const pdfBlob = pdf.output("blob");
      const filePath = `testDeliveryNotes/Delivery_${ticket.id}.pdf`;
      const storageRef = ref(getStorage(), filePath);
      await uploadBytes(storageRef, pdfBlob);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "tickets", ticket.id), {
        deliveryNoteURL: filePath,
      });

      //   if (ticket.partDeliveryNote) {
      //     setShowPartsModal(true);
      //   } else {
      //     navigate("/tickets"); // redirect after completion
      //   }
    } catch (err) {
      console.error(err);
      alert("Failed to save PDF");
    } finally {
      printRef.current?.classList.remove("no-print-mode");
    }
  };

  const today = new Date().toLocaleDateString("en-GB");
  const clearSignature = () => {
    sigCanvas.current.clear();
    setIsSigned(false);
  };

  if (!ticket) return <p>Loading...</p>;

  return (
    <div className="delivery-page-container">
      {saving && (
        <div className="saving-overlay">
          <div className="spinner-PDF" />

          <p>Saving PDF, please wait...</p>
        </div>
      )}
      <div className="delivery-page-content" ref={printRef}>
        <div className="modal-contents">
          <div className="header-section">
            <img src={logoImage} alt="365 Solutions Logo" className="logo" />
            <h2 className="modal-title">إقرار استلام جهاز</h2>
          </div>
          <p className="arabic-text">
            أقر أنا <strong>{ticket.customerName}</strong> بأني قد استلمت جهاز{" "}
            <strong>{ticket.machineType}</strong>
            <br />
            والذي تم تسليمه للشركة بتاريخ <strong>{ticket.date}</strong> ويحمل
            رقم تسلسلي <strong>{ticket.serialNum}</strong>
            <br />
            ويحمل استلام برقم <strong>{ticket.ticketNum}</strong> لأغراض الصيانة
            وقد تم عمل الصيانة اللازمة من قبلهم
            <br />
            وعليه أُخلي مسؤولية الشركة من أي مطالبات لاحقاً إلا بما تقضيه شروط
            الضمان المعتمدة من قبل الشركة الأم
            <br />
            وبناءً على ذلك أوقع.
          </p>

          <div className="form-section">
            <div className="form-group">
              <label>الاسم:</label>
              <span>{ticket.customerName}</span>
            </div>
            <div className="form-group">
              <label>التوقيع:</label>
              <div className="signature-box">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="black"
                  minWidth={0.5}
                  maxWidth={1.5}
                  canvasProps={{
                    width: 100,
                    height: 100,
                    className: "sig-canvas",
                  }}
                  onEnd={() => setIsSigned(!sigCanvas.current.isEmpty())}
                />
              </div>
            </div>
            <div className="form-group">
              <label>التاريخ:</label>
              <span>{today}</span>
            </div>
            <div className="image-upload-section">
              <p>* مرفق صورة عن إثبات الشخصية</p>
              <label className="upload-label">
                <input type="file" accept="image/*" />
                <div className="upload-icon">📷</div>
              </label>
            </div>

            <div className="footer-info">
              <p>
                Mecca St, Building 221, Amman, Jordan
                <br />
                Mob: +962 7 96181819
                <br />
                <a href="mailto:help@365solutionsjo.com">
                  help@365solutionsjo.com
                </a>
              </p>
              <img
                src="/apple-authorised.png"
                alt="Apple Authorised Logo"
                className="apple-logo"
              />
            </div>
          </div>

          <div className="button-row no-print">
            <button className="clear-button" onClick={clearSignature}>
              Clear
            </button>
            <button
              className="save-button"
              onClick={handleSavePDF}
              disabled={!isSigned}
            >
              Save
            </button>
            {/* Test button for debugging email */}
            <button
              style={{
                backgroundColor: "#007bff",
                color: "white",
                padding: "10px 15px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginLeft: "10px",
              }}
              onClick={() => sendTicketClosedEmail(ticket)}
            >
              🧪 Test Email
            </button>
          </div>
        </div>
      </div>
      {showNextButton && !saving && (
        <button
          className="next-arrow-button no-print"
          onClick={() => navigate(`/tickets/${ticket.id}/part-delivery`)}
          title="Next: Sign Parts Delivery Note"
        >
          Next
          <FaArrowRight />
        </button>
      )}
    </div>
  );
};

export default DeliveryPage;
