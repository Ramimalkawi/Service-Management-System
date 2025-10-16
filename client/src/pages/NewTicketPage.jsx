import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
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
import CustomerContractModal from "../components/CustomerContractModal";
import OutOfWarrantyReleaseModal from "../components/OutOfWarrantyReleaseModal";
import { useUser } from "../context/userContext";

const NewTicket = () => {
  const { technician } = useUser();
  const [formData, setFormData] = useState({
    ticketNum: null,
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
    location: "M",
    ticketStates: [0],
    technicions: [technician.name],
    countryCode: "962",
    date: new Date().toLocaleDateString("en-GB"),
  });

  const [loading, setLoading] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
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
  };

  const handleSendVerificationCode = async (email) => {
    setEmailVerificationLoading(true);
    setEmailVerificationError("");
    setVerificationExpired(false);
    const code = generate6DigitCode();
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
      // Start 1 minute timer
      if (verificationTimeout) clearTimeout(verificationTimeout);
      const timeout = setTimeout(() => {
        setVerificationExpired(true);
      }, 60000);
      setVerificationTimeout(timeout);
    } catch (err) {
      setEmailVerificationError(
        "Failed to send verification code. Please try again."
      );
    }
    setEmailVerificationLoading(false);
  };

  const handleVerifyCode = async (inputCode) => {
    setEmailVerificationLoading(true);
    setEmailVerificationError("");
    if (inputCode === verificationCode && !verificationExpired) {
      setShowEmailVerifyModal(false);
      setFormData((prev) => ({ ...prev, emailAddress: pendingEmail }));
      if (verificationTimeout) clearTimeout(verificationTimeout);
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
        setFormData((prev) => ({ ...prev, ticketNum: newTicketNum }));
      }
      if (formData.warrantyStatus === "Out of warranty") {
        setShowReleaseModal(true);
      } else {
        setShowSignatureModal(true);
      }
    } else if (verificationExpired) {
      setEmailVerificationError(
        "Verification expired. Please resend code or use fallback email."
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
        setFormData((prev) => ({ ...prev, ticketNum: newTicketNum }));
        if (formData.warrantyStatus === "Out of warranty") {
          setShowReleaseModal(true);
        } else {
          setShowSignatureModal(true);
        }
      });
    } else {
      if (formData.warrantyStatus === "Out of warranty") {
        setShowReleaseModal(true);
      } else {
        setShowSignatureModal(true);
      }
    }
  };

  const handleCompleteContract = async (contractURL, signatureUrl) => {
    setLoading(true);
    try {
      const ticketNum = formData.ticketNum;
      const storage = getStorage();
      // Upload customer signature for future use
      if (customerSignatureURL) {
        // Already uploaded
      } else if (signatureBlob) {
        const sigBlob = await (await fetch(signatureBlob)).blob();
        const sigRef = ref(
          storage,
          `customerSignatures/${ticketNum}_${formData.customerName}.png`
        );
        await uploadBytes(sigRef, sigBlob);
        const sigUrl = await getDownloadURL(sigRef);
        setCustomerSignatureURL(sigUrl);
      }
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

      // Save ticket
      await addDoc(collection(db, "tickets"), {
        ...formData,
        ticketNum: ticketNum,
        location: technician.location || "M",
        date: formattedDate,
        contractURL,
        noResponsibilityURL,
        customerSignatureURL: signatureUrl || customerSignatureURL,
      });

      await sendCustomerNotificationEmail(contractURL, formattedDate);
      alert("Ticket created successfully!");
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
              <a " class="download-button">Download Service Contract</a>
              
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
                <p>365Solutions - Apple Authorized Service Center</p>
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
            <label>Ticket Number</label>
            <div className="readonly-value">{formData.ticketNum}</div>
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
      <CustomerContractModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        customerData={formData}
        contractHtml={`
            <div style='direction:rtl; font-family:Arial, sans-serif;'>
              <div style='display:flex; align-items:center; justify-content:space-between; gap:16px;'>
              <div style='text-align:right; flex:1;'>
                <h4 style='margin:0;'>شركة ثلاثمائة وخمس وستون للخدمات والحلول الالكترونية</h4>
                <h5 style='margin:0;'>Three Hundred and Sixty-Five Solutions</h5>
                <div style='color:#1976d2;'>Apple Authorised Service Provider</div>
              </div>
                <img src="/logo_new.png" alt="365 Solutions" style="height:50px; margin-left:16px;" />
              </div>
                <hr style='margin:16px 0; border:0; border-top:2px solid #1976d2;' />
              <h2 style='text-align:center;'>عقد صيانة</h2>
              <h3>أولاً: شروط عامة متعلقة بعملية الاستلام لفنيات الفحص والصيانة.</h3>
              <div style='font-size:15px; direction:rtl; text-align:right;'>
                <div><span style='font-weight:bold; margin-left:8px;'>١.</span> يلتزم العميل بإحضار إيصال الصيانة الأصلي عند الاستلام، ويسلم الجهاز للإيصال فقط. وفي حالة فقدان الإيصال يجب على صاحب الجهاز إحضار الهوية لمطابقة البيانات المسجلة على النظام ولا تقبل صورة الهوية المخزنة على الهاتف.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٢.</span> حفظ البيانات والمعلومات من مسؤولية العميل حيث يتطلب الفحص للمنتجات محو الأنظمة والمحتويات، لذا فإن الشركة لا تتحمل مسؤولية فقدان المعلومات أو أسرارها.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٣.</span> الشركة غير مسؤولة عن فتح الأجهزة المغلقة على شبكة معينة حيث تبديلها في حال كانت مشفرة على شبكة أخرى سابقاً.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٤.</span> الشركة غير مسؤولة عن حفظ أي قطعة أو ملحقات تأتي مع الجهاز أثناء استلامه وتخلي مسؤوليتها من مطالبة الزبون بها.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٥.</span> تخصم الشركة الكفالة إذا الشركة قامت بالإجراءات المعتمدة من قبل الشركة الأم مع العلم أن الكفالة لا تشمل سوء الاستخدام مثل (السقوط، الكسر، السوائل، آثار فتح الجهاز).</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٦.</span> يتم تحديد تكلفة الكفالة النهائية بعد مراجعة الشركة الأم، وتدقيق من قبل الشركة الأم حسب طبيعة المشكلة حيث لا تشترط بعض الأعطال التي تظهر أثناء الفحص استبدال الكفالة أو مراجعة الشركة الأم لمعالجة المشكلة حسب المشكلة، إلا إذا تم تحديد المشكلة من قبل الشركة.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٧.</span> الزمن المتوقع لوصول القطعة أو الجهاز من (٧ أيام) ولغاية (٤٥ يوم) عمل، وقد تتجاوز تلك المدة في الظروف الاستثنائية الخارجة عن السيطرة.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٨.</span> الشركة غير مسؤولة عن أي ضرر أو عطل يظهر على الجهاز بعد فتحه (خلال عملية الفحص)، إذا تبين وجود تلاعب مسبق في الجهاز أو صيانة غير أصلية.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٩.</span> الكفالة المعتمدة للقطع والأجهزة المستبدلة هي (٩٠) يوماً بعد عملية استكمال إجراءات الصيانة، وإبلاغ العميل بذلك مع التنويه الى استمرار الكفالة للقطع والأجهزة المستبدلة على الجهاز الأصلي إذا زادت عن (٩٠) يوماً.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٠.</span> من حق الشركة مطالبة العميل بدفع كامل قيمة الإصلاح قبل استلام الجهاز، وسيتم وقف استلام الجهاز حتى يتم الدفع (للأجهزة خارج الكفالة).</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١١.</span> تخلي الشركة مسؤوليتها عن أي ضرر أو عطل يظهر على الجهاز بعد فتحه (خلال عملية الفحص)، إذا تبين وجود تلاعب مسبق في الجهاز أو صيانة غير أصلية.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٢.</span> لا يتم تسليم الجهاز إلا بعد دفع كامل قيمة الإصلاح.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٣.</span> العميل مسؤول عن الجهاز بعد الانتهاء من العمل، وفي حالة عدم الحضور لاستلام الجهاز عن ٣٠ يوم من تاريخ الإبلاغ يتم التخلص من الجهاز بالطريقة التي تراها الشركة مناسبة دون الرجوع للعميل، ولا يحق للعميل المطالبة بالجهاز ولا بأي تعويضات مهما كانت الأسباب.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٤.</span> تسوية الشركة أجرا مقداره (٣٥) دينار على أي تقرير صادر من الشركة بناء على طلب العميل لأي جهة كانت.</div>
              </div>
              <div style='font-size:15px; direction:rtl; text-align:right; margin-top:10px;'>
                <div><span style='font-weight:bold; margin-left:8px;'>١٥.</span> تُملأ المعلومات الشخصية المطلوبة التالية (الاسم والعنوان ورقم الهاتف وعنوان البريد الإلكتروني) أمراً ضرورياً لتلبية طلب الخدمة، ولا يلتزم مقدم الخدمة برفع الجهاز لخدمة رفع المعلومات من الطرف الخارجي لأغراض عمليات التدقيق وضمان الجودة، ويعتبر ذلك كخدمة إضافية للعميل، ويتم من خلال التوقيع أدناه التأكيد على هذا الأمر والإقرار بأن مقدم الخدمة غير مسؤول عن استلام استلام العملاء.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٦.</span> يحق للعميل استرداد أي رسوم تم استيفائها من قبل الشركة للمكونات خلال أي عودة المشكلة للأجهزة التي خضعت لإجراءات الـ software أو التنظيف أو أي إجراءات أخرى لم يتم حلها بالكامل حينها أو لم تخضع لأي إجراءات من خلال الإجراءات المعتمدة من قبل الشركة.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>١٧.</span> تُقر الموافقة النهائية من قبل العميل على الرسوم المدفوعة مقابل إجراءات محددة ومعلن عنها وفق نظام التسعير الخاص بالشركة بموجب الفاتورة ولا يمكن الاعتراض على الاعتراض عليها مستقبلاً.</div>
              </div>
              <h3>ثانياً: شروط خاصة متعلقة بأجهزة (iPhone, iPad, Apple Watch):</h3>
              <div style='font-size:15px; direction:rtl; text-align:right;'>
                <div><span style='font-weight:bold; margin-left:8px;'>١.</span> تستوفي الشركة أجرا مقداره (٢٥) دينار بدل فحص الأجهزة المكفولة (Software) إذا تطلبت حل المشكلة ذلك ولم يخضع الجهاز لأي إجراء أو فحص أو قطع.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٢.</span> تستوفي الشركة أجرا مقداره (٢٥) دينار بدل فحص للأجهزة غير المكفولة ولا تعتبر جزء من أجور القطع.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٣.</span> تستوفي الشركة أجرا مقداره (٢٥) دينار بدل فحص للأجهزة المكفولة في حال تبين سبب عطله سوء استخدام أو رفض العميل استكمال إجراءات الصيانة بعد إبلاغه بالإجراءات والفحص خلال المدة المحددة للفحص (سبع يوم وغاية ثلاث أيام) وتسقط هذه الرسوم في حال الفتحة.</div>
                <div id="customer-signature-section-iPhone" style="margin-top:12px;"></div>
              </div>
              <h3>ثالثاً: شروط خاصة متعلقة بأجهزة (MacBook, IMAC, MAC Mini):</h3>
              <div style='font-size:15px; direction:rtl; text-align:right;'>
                <div><span style='font-weight:bold; margin-left:8px;'>١.</span> تستوفي الشركة أجرا مقداره (٢٥) دينار غير مستردة بدل فحص للأجهزة التي تكون الكفالة غير مشمولة بالأجور للقطع أو أجور الصيانة.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٢.</span> تستوفي الشركة أجرا مقداره (٢٥) دينار بدل فحص للأجهزة المكفولة في حال تبين سبب عطله سوء الاستخدام أو رفض العميل استكمال إجراءات الصيانة بعد إبلاغه بالإجراءات والفحص خلال المدة المحددة للفحص (سبع يوم وغاية ثلاث أيام) وتسقط هذه الرسوم في حال الفتحة.</div>
                <div id="customer-signature-section-mac" style="margin-top:12px;"></div>
              </div>
              <h3>رابعاً: شروط خاصة متعلقة بأجهزة (AirPods, EarPods, Beats, Apple Pencil):</h3>
              <div style='font-size:15px; direction:rtl; text-align:right;'>
                <div><span style='font-weight:bold; margin-left:8px;'>١.</span> تستوفي الشركة أجرا مقداره (١٥) دينار غير مستردة بدل فحص للأجهزة التي تكون الكفالة غير مشمولة بالأجور للقطع أو أجور الصيانة.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٢.</span> تستوفي الشركة أجرا مقداره (١٥) دينار بدل فحص للأجهزة المكفولة في حال رفض العميل استكمال إجراءات الصيانة بعد إبلاغه بالإجراءات والفحص خلال المدة المحددة للفحص.</div>
                <div><span style='font-weight:bold; margin-left:8px;'>٣.</span> تستوفي الشركة أجرا مقداره (١٥) دينار بدل فحص للأجهزة المكفولة في حال تبين عدم وجود مشكلة فيها (NTF) بعد الفحص أو سوء استخدام.</div>
                
              </div>
              <hr/>
            
              <p style='font-size:15px;'>يرجى مراجعة الشروط والتوقيع أدناه.</p>
              <div style='display:flex; justify-content:space-between; align-items:flex-end; margin-top:32px;'>
              <img src="/applelogo.png" alt="Apple Logo" style="height:40px;" />
                <div style='text-align:left; font-size:15px;'>
                  <span style='font-weight:bold; color:#222;'>3</span><span style='font-weight:bold; color:#999;'>6</span><span style='font-weight:bold; color:#1ccad4;'>5</span><span style='font-weight:bold;'> Solutions</span><br/>
                  Amman, Jordan<br/>
                  Mecca Street, Building No. 221<br/>
                  <span style='font-weight:bold;'>Mob:</span> 00962 79 6818189<br/>
                  <span style='font-weight:bold;'>Email:</span> help@365solutionsjo.com
                </div>
              </div>
              <div style="display:flex; justify-content:space-around; align-items:center; margin-top:24px;">
              <div style='font-size:15px;'>
      
                <strong>Customer Name:</strong> ${formData.customerName}<br/>
                <strong>Device Type:</strong> ${formData.machineType}<br/>
                <strong>Serial Number:</strong> ${formData.serialNum}<br/>
                <strong>Warranty Status:</strong> ${formData.warrantyStatus}<br/>
                <div>
                <strong>Customer Signature</strong>
                <div id="customer-signature-section"></div>
                </div>
                
              </div>
              <div style='font-size:15px;'>

                <strong>Ticket#:</strong> ${formData.location}${formData.ticketNum}<br/>
                <strong>Date:</strong> ${formData.date}<br/>
                <strong>Ticket created by:</strong> ${technician.name}<br/>
                <div>
                <strong>Technician Signature</strong>
                <div id="technician-signature-section"></div>
                </div>
                
              </div>
              </div>
            </div>
          `}
        onSign={handleCompleteContract}
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
        onClose={() => setShowEmailVerifyModal(false)}
        email={pendingEmail}
        onSendCode={handleSendVerificationCode}
        onVerify={handleVerifyCode}
        loading={emailVerificationLoading}
        error={emailVerificationError}
        verificationExpired={verificationExpired}
        onUseFallback={handleUseFallbackEmail}
      />
    </div>
  );
};

// Utility function to generate a random 6-digit code
function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default NewTicket;
