import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  setDoc,
  runTransaction,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { API_ENDPOINTS } from "../config/api";

import { useNavigate } from "react-router-dom";
import SignatureModal from "../components/SignatureModal"; // adjust path as needed
import EmailVerifyModal from "../components/EmailVerifyModal";
// Use public URL instead of import for PDF
const contractPdfFile = `${window.location.origin}/Amman_new_contract.pdf`;
// Fallback test PDF for debugging
const testPdfUrl =
  "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";

import "./NewTicket.css";
import SignaturePdfModal from "../components/SignaturePdfModal";
import OutOfWarrantyReleaseModal from "../components/OutOfWarrantyReleaseModal";
import { useUser } from "../context/userContext";
import TermsAndConditionsPage from "../components/TermsAndConditions";

const NewTicket = () => {
  const { technician } = useUser();
  const [formData, setFormData] = useState({
    ticketNum: null,
    ticketId: "",
    customerName: "",
    mobileNumber: "",
    emailAddress: "",
    customerType: "personal", // or "business"
    companyName: "",
    machineType: "",
    serialNum: "",
    deviceIMEI: "",
    details: [`Started by ${technician.name}`],
    deviceDescription: "",
    warrantyStatus: "Apple limited warranty",
    symptom: "",
    location: technician.location,
    ticketStates: [0],
    technicions: [technician.name],
    countryCode: "962",
    date: new Date().toLocaleDateString("en-GB"),
    deviceStuff: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [contractPdfUrl, setContractPdfUrl] = useState(null);
  const [customerSignatureURL, setCustomerSignatureURL] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseSignature, setReleaseSignature] = useState(null);
  const [noResponsibilityURL, setNoResponsibilityURL] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [customDeviceType, setCustomDeviceType] = useState("");
  const [showCustomDeviceInput, setShowCustomDeviceInput] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [pendingWarrantyStatus, setPendingWarrantyStatus] = useState(null);
  const [emailVerificationLoading, setEmailVerificationLoading] =
    useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationTimeout, setVerificationTimeout] = useState(null);
  const [verificationExpired, setVerificationExpired] = useState(false);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState(null);
  const navigate = useNavigate();

  const logoUrlForEmail =
    "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "machineType") {
      if (value === "Other") {
        // When Other is selected, show custom input and clear machineType
        setShowCustomDeviceInput(true);
        setFormData((prev) => ({ ...prev, [name]: "" }));
      } else {
        // When a predefined option is selected, hide custom input and set machineType
        setShowCustomDeviceInput(false);
        setCustomDeviceType("");
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomDeviceChange = (e) => {
    const { value } = e.target;
    setCustomDeviceType(value);
    setFormData((prev) => ({ ...prev, machineType: value }));
  };

  const handleShowModal = (e) => {
    e.preventDefault();
    setShowEmailVerifyModal(true);
    setPendingEmail(formData.emailAddress);
    setEmailVerificationError("");
    setVerificationExpired(false);
    setVerificationExpiresAt(null);
    if (verificationTimeout) {
      clearTimeout(verificationTimeout);
      setVerificationTimeout(null);
    }
  };

  const handleCloseEmailVerifyModal = () => {
    setShowEmailVerifyModal(false);
    if (verificationTimeout) {
      clearTimeout(verificationTimeout);
      setVerificationTimeout(null);
    }
    setVerificationExpiresAt(null);
    setVerificationExpired(false);
  };

  // Fetch contract PDF URL on mount
  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const storage = getStorage();
        const pdfRef = ref(storage, "Amman Contract/Terms and conditions.pdf");
        const url = await getDownloadURL(pdfRef);
        setContractPdfUrl(url);
      } catch (err) {
        console.error("Failed to fetch contract PDF URL", err);
        setContractPdfUrl(null);
      }
    };
    fetchPdfUrl();
  }, []);

  const handleSendVerificationCode = async (email) => {
    setEmailVerificationLoading(true);
    setEmailVerificationError("");
    setVerificationExpired(false);
    setVerificationExpiresAt(null);
    const code = generate6DigitCode();
    console.log("Generated verification code:", code);
    setVerificationCode(code);
    try {
      await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "365Solutions Ticket Email Verification Code",
          html: `<p>Your verification code is: <b>${code}</b></p>`,
        }),
      });
      const expiryTime = Date.now() + 180000;
      setVerificationExpiresAt(expiryTime);
      // Start 3 minute timer
      if (verificationTimeout) clearTimeout(verificationTimeout);
      const timeout = setTimeout(() => {
        setVerificationExpired(true);
        setVerificationExpiresAt(null);
      }, 180000);
      setVerificationTimeout(timeout);
    } catch (err) {
      setEmailVerificationError(
        "Failed to send verification code. Please try again.",
      );
      setVerificationExpiresAt(null);
    }
    setEmailVerificationLoading(false);
  };

  // Utility to generate a random 3-digit number as string
  function generate3DigitNumber() {
    return Math.floor(100 + Math.random() * 900).toString();
  }

  const handleVerifyCode = async (inputCode) => {
    setEmailVerificationLoading(true);
    setEmailVerificationError("");
    if (inputCode === verificationCode && !verificationExpired) {
      setShowEmailVerifyModal(false);
      setFormData((prev) => ({ ...prev, emailAddress: pendingEmail }));
      if (verificationTimeout) clearTimeout(verificationTimeout);
      setVerificationTimeout(null);
      setVerificationExpiresAt(null);
      setVerificationExpired(false);
      // Only increment if ticketNum is not set
      if (!formData.ticketNum) {
        const ticketNumDocRef = doc(db, "ticketnumber", "OelkqX6vOsleiRSAHl17");
        let newTicketNum = null;
        await runTransaction(db, async (transaction) => {
          const ticketNumDoc = await transaction.get(ticketNumDocRef);
          if (!ticketNumDoc.exists()) {
            transaction.set(ticketNumDocRef, { number: 1000 });
            newTicketNum = 1000;
          } else {
            const current = ticketNumDoc.data().number || 1000;
            newTicketNum = current + 1;
            transaction.update(ticketNumDocRef, { number: newTicketNum });
          }
        });
        const random3 = generate3DigitNumber();
        setFormData((prev) => ({
          ...prev,
          ticketNum: newTicketNum,
          ticketId: `${prev.location}${newTicketNum}${random3}`,
        }));
      }
      if (formData.warrantyStatus === "Out of warranty") {
        setShowReleaseModal(true);
      } else {
        // Only show signature modal if contractPdfUrl is ready
        if (contractPdfUrl) {
          setShowSignatureModal(true);
        } else {
          alert("Contract PDF is not available. Please try again later.");
        }
      }
    } else if (verificationExpired) {
      setEmailVerificationError(
        "Verification expired. Please resend code or use fallback email.",
      );
    } else {
      setEmailVerificationError("Incorrect code. Please try again.");
    }
    setEmailVerificationLoading(false);
  };

  const handleUseFallbackEmail = () => {
    setShowEmailVerifyModal(false);
    setFormData((prev) => ({ ...prev, emailAddress: "refused@apple.com" }));
    if (verificationTimeout) clearTimeout(verificationTimeout);
    setVerificationTimeout(null);
    setVerificationExpiresAt(null);
    setVerificationExpired(false);
    // Only increment if ticketNum is not set
    if (!formData.ticketNum) {
      const ticketNumDocRef = doc(db, "ticketnumber", "OelkqX6vOsleiRSAHl17");
      let newTicketNum = null;
      runTransaction(db, async (transaction) => {
        const ticketNumDoc = await transaction.get(ticketNumDocRef);
        if (!ticketNumDoc.exists()) {
          transaction.set(ticketNumDocRef, { number: 1000 });
          newTicketNum = 1000;
        } else {
          const current = ticketNumDoc.data().number || 1000;
          newTicketNum = current + 1;
          transaction.update(ticketNumDocRef, { number: newTicketNum });
        }
      }).then(() => {
        const random3 = generate3DigitNumber();
        setFormData((prev) => ({
          ...prev,
          ticketNum: newTicketNum,
          ticketId: `${prev.location}${newTicketNum}${random3}`,
        }));
        if (formData.warrantyStatus === "Out of warranty") {
          setShowReleaseModal(true);
        } else {
          if (contractPdfUrl) {
            setShowSignatureModal(true);
          } else {
            alert("Contract PDF is not available. Please try again later.");
          }
        }
      });
    } else {
      if (formData.warrantyStatus === "Out of warranty") {
        setShowReleaseModal(true);
      } else {
        if (contractPdfUrl) {
          setShowSignatureModal(true);
        } else {
          alert("Contract PDF is not available. Please try again later.");
        }
      }
    }
  };

  const handleCompleteContract = async (contractURL, customerSignatureURL) => {
    setLoading(true);
    try {
      const ticketNum = formData.ticketNum;
      // Format created date
      const formattedDate = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Save ticket with ticketId as document ID
      await setDoc(doc(db, "tickets", formData.ticketId), {
        ...formData,
        ticketNum: ticketNum,
        date: formattedDate,
        contractURL,
        noResponsibilityURL,
        customerSignatureURL,
      });
      console.log("location:", formData.location);
      await sendCustomerNotificationEmail(contractURL, formattedDate);
      alert("Ticket created successfully!");
      alert("Please add photos of the device before repair starts.");
      navigate("/tickets");
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  };

  const sendCustomerNotificationEmail = async (contractURL, ticketDate) => {
    try {
      // const contractDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/solutions-system-1e0f5.appspot.com/o/${encodeURIComponent(
      //   contractURL
      // )}?alt=media`;

      const companyEmail =
        formData.location === "M"
          ? "help@365solutionsjo.com"
          : "irbid@365solutionsjo.com";
      const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/solutionssystemmain.appspot.com/o/logo-and-apple.png?alt=media&token=8c0ed18b-8153-425b-8646-9517a93f7f5e";
      const trackingUrl = "https://www.365solutionsjo.com";
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
            .header { background-color: #1ccad4; color: white; padding: 20px; text-align: center; }
            .logo-img { max-height: 60px; margin-bottom: 10px; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .ticket-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .info-row { margin: 8px 0; }
            .label { font-weight: bold; color: #333; }
            .download-button { 
              display: inline-block; 
              background-color: #1ccad4; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 15px 0; 
            }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <img src="${logoUrl}" alt="365Solutions Logo" class="logo-img" />
              <h2>Device Received - 365Solutions</h2>
              <p>Apple Authorized Service Center</p>
            </div>
            
            <div class="content">
              <p>Dear ${formData.customerName},</p>
              
              <p>We have received your device at 365Solutions Apple Authorized Service Center. Thank you for choosing our services.</p>
              
              <div class="ticket-info">
                <h3 style="color: #1ccad4;">Service Ticket Information</h3>
                <div class="info-row">
                  <span class="label">Ticket Number:</span> ${
                    formData.location
                  }${formData.ticketNum}
                </div>
                <div class="info-row">
                  <span class="label">Ticket ID:</span> ${formData.ticketId}
                </div>
                <div class="info-row">
                  <span class="label">Date Received:</span> ${ticketDate}
                </div>
                <div class="info-row">
                  <span class="label">Device Type:</span> ${
                    formData.machineType
                  }
                </div>
                <div class="info-row">
                  <span class="label">Serial Number:</span> ${
                    formData.serialNum
                  }
                </div>
                <div class="info-row">
                  <span class="label">Device Description:</span> ${
                    formData.deviceDescription
                  }
                </div>
                <div class="info-row">
                  <span class="label">Reported Issue:</span> ${formData.symptom}
                </div>
                <div class="info-row">
                  <span class="label">Warranty Status:</span> ${
                    formData.warrantyStatus
                  }
                </div>
                <div class="info-row">
                  <span class="label">Company Email:</span> ${companyEmail}
                </div>
              </div>
              
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Our technicians will begin diagnostic work on your device</li>
                <li>We will contact you with updates on the repair status</li>
                <li>You will receive notification when your device is ready for pickup</li>
              </ul>
              
              <p>Please download and keep a copy of your signed service contract:</p>
              <a href="${contractURL}" class="download-button" target="_blank" rel="noopener noreferrer">Download Service Contract</a>

              <p>You can track your service status anytime at <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer">${trackingUrl}</a> using Ticket ID <strong>${formData.ticketId}</strong>.</p>
              
              <p>If you have any questions, please contact us at:</p>
              <ul>
                <li>Email: ${companyEmail}</li>
                <li>Phone: ${
                  formData.location === "M"
                    ? "+962-79-681-8189"
                    : "+962-79-668-8831"
                }</li>
              </ul>
              
              <div class="footer">
                <p>365Solutions - Apple Authorized Service Provider</p>
                <p>Professional device repair services you can trust</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: formData.emailAddress,
        subject: `Service Confirmation - Your device has been received (Ticket #${formData.location}${formData.ticketNum})`,
        html: emailHtml,
        location: formData.location,
      };

      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        console.log("Customer notification email sent successfully");
      } else {
        console.error("Failed to send customer notification email");
      }
    } catch (error) {
      console.error("Error sending customer notification email:", error);
      // Don't throw error to avoid interrupting ticket creation process
    }
  };

  //   const submitTicketAfterSignature = async (e) => {
  //     setLoading(true);

  //     const formattedDate = new Date().toLocaleString("en-GB", {
  //       day: "2-digit",
  //       month: "2-digit",
  //       year: "numeric",
  //       hour: "2-digit",
  //       minute: "2-digit",
  //       second: "2-digit",
  //       hour12: true,
  //     });

  //     try {
  //       await addDoc(collection(db, "tickets"), {
  //         ...formData,
  //         date: formattedDate,
  //         contractURL,
  //       });
  //       alert("Ticket created successfully!");
  //       navigate("/tickets");
  //     } catch (error) {
  //       console.error("Error creating ticket:", error);
  //       alert("Failed to create ticket.");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  return (
    <div className="ticket-container" style={{ position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="spinner"
            style={{
              width: "60px",
              height: "60px",
              border: "8px solid #eee",
              borderTop: "8px solid #1976d2",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      <div className="ticket-card">
        <h2>Create New Ticket</h2>
        <form onSubmit={(e) => e.preventDefault()} className="ticket-form">
          <div className="form-group readonly">
            <label>Ticket ID</label>
            <div className="readonly-value">{formData.ticketId}</div>
          </div>

          <div className="form-group">
            <label>Customer Name</label>
            <input
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Mobile Number</label>
            <input
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="emailAddress"
              value={formData.emailAddress}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Customer Type</label>
            <select
              name="customerType"
              value={formData.customerType}
              onChange={handleChange}
            >
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>

          {formData.customerType === "business" && (
            <div className="form-group">
              <label>Company Name</label>
              <input
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Device Type</label>
            <select
              name="machineType"
              value={showCustomDeviceInput ? "Other" : formData.machineType}
              onChange={handleChange}
              required
            >
              <option value="">Select a device</option>
              <option value="iMac">iMac</option>
              <option value="MacBook Pro">MacBook Pro</option>
              <option value="MacBook Air">MacBook Air</option>
              <option value="Mac mini">Mac mini</option>
              <option value="Mac Pro">Mac Pro</option>
              <option value="Mac Studio">Mac Studio</option>
              <option value="Apple Studio Display">Apple Studio Display</option>
              <option value="iPhone">iPhone</option>
              <option value="iPhoneX">iPhoneX</option>
              <option value="iPhoneXS">iPhoneXS</option>
              <option value="iPhoneXS Max">iPhoneXS Max</option>
              <option value="iPhone11">iPhone11</option>
              <option value="iPhone12">iPhone12</option>
              <option value="iPhone12 mini">iPhone12 mini</option>
              <option value="iPhone12 Pro">iPhone12 Pro</option>
              <option value="iPhone12 Pro Max">iPhone12 Pro Max</option>
              <option value="iPhone13">iPhone13</option>
              <option value="iPhone13 mini">iPhone13 mini</option>
              <option value="iPhone13 Pro">iPhone13 Pro</option>
              <option value="iPhone13 Pro Max">iPhone13 Pro Max</option>
              <option value="iPhone14">iPhone14</option>
              <option value="iPhone14 Plus">iPhone14 Plus</option>
              <option value="iPhone14 Pro">iPhone14 Pro</option>
              <option value="iPhone14 Pro Max">iPhone14 Pro Max</option>
              <option value="iPhone15">iPhone15</option>
              <option value="iPhone15 Plus">iPhone15 Plus</option>
              <option value="iPhone15 Pro">iPhone15 Pro</option>
              <option value="iPhone15 Pro Max">iPhone15 Pro Max</option>
              <option value="iPhone16">iPhone16</option>
              <option value="iPhone16 Plus">iPhone16 Plus</option>
              <option value="iPhone16 Pro">iPhone16 Pro</option>
              <option value="iPhone16 Pro Max">iPhone16 Pro Max</option>
              <option value="iPad">iPad</option>
              <option value="iPadPro 11">iPadPro 11</option>
              <option value="iPadPro 12.9">iPadPro 12.9</option>
              <option value="iPadAir">iPadAir</option>
              <option value="iPad mini">iPad mini</option>
              <option value="AppleWatch">AppleWatch</option>
              <option value="AppleTV">AppleTV</option>
              <option value="Apple Pencil1">Apple Pencil1</option>
              <option value="Apple Pencil2">Apple Pencil2</option>
              <option value="Apple AirPods">Apple AirPods</option>
              <option value="Apple Pencil">Apple Pencil</option>
              <option value="Beats">Beats</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {showCustomDeviceInput && (
            <div className="form-group">
              <label>Custom Device Type</label>
              <input
                type="text"
                placeholder="Enter custom device type"
                value={customDeviceType}
                onChange={handleCustomDeviceChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Device Serial Number</label>
            <input
              name="serialNum"
              value={formData.serialNum}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>IMEI Number</label>
            <input
              name="deviceIMEI"
              value={formData.deviceIMEI}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Device Description</label>
            <input
              name="deviceDescription"
              value={formData.deviceDescription}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Warranty Status</label>
            <select
              name="warrantyStatus"
              value={formData.warrantyStatus}
              onChange={handleChange}
            >
              <option>Apple limited warranty</option>
              <option>Out of warranty</option>
              <option>Apple care protection</option>
              <option>Quality program</option>
              <option>Repeate Service</option>
              <option>CS code</option>
            </select>
          </div>

          <div className="form-group">
            <label>Symptom</label>
            <textarea
              name="symptom"
              value={formData.symptom}
              onChange={handleChange}
              required
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
            }}
          >
            <div className="form-group" style={{ flex: 1 }}>
              <label>Device stuff</label>
              <textarea
                name="deviceStuff"
                value={formData.deviceStuff}
                onChange={handleChange}
                required
                style={{ width: "100%" }}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                required
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <button className="submit-button" onClick={handleShowModal}>
            Create Ticket
          </button>
        </form>
      </div>
      {/* <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onAccept={handleSignatureAccept}
      /> */}
      <SignaturePdfModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        issuedBy={technician.name}
        customerData={formData}
        ticketNum={formData.ticketNum}
        pdfFile={contractPdfUrl}
        onComplete={handleCompleteContract}
      />
      <OutOfWarrantyReleaseModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        customerData={formData}
        onSign={(pdfUrl) => {
          setNoResponsibilityURL(pdfUrl);
          setShowReleaseModal(false);
          setShowSignatureModal(true);
        }}
      />
      <EmailVerifyModal
        isOpen={showEmailVerifyModal}
        onClose={handleCloseEmailVerifyModal}
        email={pendingEmail}
        onSendCode={handleSendVerificationCode}
        onVerify={handleVerifyCode}
        loading={emailVerificationLoading}
        error={emailVerificationError}
        verificationExpired={verificationExpired}
        onUseFallback={handleUseFallbackEmail}
        expiresAt={verificationExpiresAt}
      />
    </div>
  );
};

// Utility function to generate a random 6-digit code
function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default NewTicket;
