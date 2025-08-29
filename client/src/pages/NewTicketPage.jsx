import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { API_ENDPOINTS } from "../config/api";

import { useNavigate } from "react-router-dom";
import SignatureModal from "../components/SignatureModal"; // adjust path as needed
// Use public URL instead of import for PDF
const contractPdfFile = `${window.location.origin}/Amman_new_contract.pdf`;
// Fallback test PDF for debugging
const testPdfUrl =
  "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";

import "./NewTicket.css";
import SignaturePdfModal from "../components/SignaturePdfModal";
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
  });

  const [loading, setLoading] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [customDeviceType, setCustomDeviceType] = useState("");
  const [showCustomDeviceInput, setShowCustomDeviceInput] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatestTicketNum = async () => {
      const ticketsRef = collection(db, "tickets");
      console.log("ref", ticketsRef);
      const q = query(ticketsRef, orderBy("ticketNum", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      const latestNum = querySnapshot.empty
        ? 1000
        : querySnapshot.docs[0].data().ticketNum + 1;
      console.log("TECH in new", technician.name);

      setFormData((prev) => ({
        ...prev,
        ticketNum: latestNum,
      }));
    };

    fetchLatestTicketNum();
  }, []);

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
    setShowSignatureModal(true);
  };

  const handleCompleteContract = async (contractURL) => {
    setSignatureBlob(signatureBlob);
    console.log("The URL", contractURL);
    try {
      // Upload signature
      const ticketNum = formData.ticketNum;
      const storage = getStorage();
      const contractRef = ref(storage, `contracts/${ticketNum}.png`);
      await uploadBytes(contractRef, signatureBlob);

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
        date: formattedDate,
        contractURL,
      });

      // Send customer notification email
      await sendCustomerNotificationEmail(contractURL, formattedDate);

      alert("Ticket created successfully!");
      navigate("/tickets");
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Failed to create ticket.");
    }
  };

  const sendCustomerNotificationEmail = async (contractURL, ticketDate) => {
    try {
      // const contractDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/solutions-system-1e0f5.appspot.com/o/${encodeURIComponent(
      //   contractURL
      // )}?alt=media`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
            .header { background-color: #1ccad4; color: white; padding: 20px; text-align: center; }
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
                <li>Email: ${
                  formData.location === "M"
                    ? "help@365solutionsjo.com"
                    : "irbid@365solutionsjo.com"
                }</li>
                <li>Phone: ${
                  formData.location === "M"
                    ? "+962-6-XXX-XXXX"
                    : "+962-2-XXX-XXXX"
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
    <div className="ticket-container">
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

          <button
            className="submit-button"
            onClick={(e) => {
              e.preventDefault();
              setShowSignatureModal(true);
            }}
          >
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
        customerData={formData}
        ticketNum={formData.ticketNum}
        location={formData.location}
        onComplete={handleCompleteContract}
        pdfFile={contractPdfFile}
      />
    </div>
  );
};

export default NewTicket;
