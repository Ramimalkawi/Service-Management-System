import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";
import logoImage from "../assets/logo-and-apple.png";
import "./PartsDeliveryPage.css";
import { waitForImagesToLoad } from "../utils/pdfCapture";

const BRANCH_NAMES = {
  M: "Amman",
  I: "Irbid",
};

const BRANCH_CONTACT = {
  M: {
    addressLine1: "Mecca Street , Building No. 221",
    addressLine2: "Amman, Jordan",
    phone: "+962 (79) 6818189",
    email: "help@365solutionsjo.com",
  },
  I: {
    addressLine1: "Wasfi Al-Tal Street",
    addressLine2: "Irbid, Jordan",
    phone: "+962 (79) 6688831",
    email: "irbid@365solutionsjo.com",
  },
};

const buildServiceLocation = (locationCode) => {
  const branchName = BRANCH_NAMES[locationCode] || locationCode || "";
  return ["365 Solutions", "Jordan", branchName].filter(Boolean).join(", ");
};

const getBranchContact = (locationCode) =>
  BRANCH_CONTACT[locationCode] || BRANCH_CONTACT.M;

const ReleaseOfLiabilityPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfSaved, setPdfSaved] = useState(false);
  const [renderSignatureAsImage, setRenderSignatureAsImage] = useState(false);
  const [customerSignature, setCustomerSignature] = useState("");
  const [showSignatureImage, setShowSignatureImage] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [fullName, setFullName] = useState("");
  const [place, setPlace] = useState("");
  const [model, setModel] = useState("");
  const sigCanvas = useRef(null);
  const pageRef = useRef(null);

  const today = new Date().toLocaleDateString("en-GB");

  useEffect(() => {
    const fetchData = async () => {
      const ticketRef = doc(db, "tickets", id);
      const ticketSnap = await getDoc(ticketRef);
      if (ticketSnap.exists()) {
        const data = ticketSnap.data();
        setTicket(data);
        setFullName(data.customerName || "");
        setPlace(buildServiceLocation(data.location));
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const clearSignature = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
    setCustomerSignature("");
    setIsSigned(false);
    setShowSignatureImage(false);
    setSignatureDataUrl("");
  };

  const showSignatureFromStorage = async () => {
    if (ticket?.customerSignatureURL) {
      try {
        const response = await fetch(ticket.customerSignatureURL);
        const blob = await response.blob();
        const reader = new window.FileReader();
        reader.onloadend = () => {
          setSignatureDataUrl(reader.result);
          setShowSignatureImage(true);
          setIsSigned(true);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to load signature image:", err);
        alert("Failed to load signature image.");
      }
    }
  };

  const handleEndSignature = () => {
    if (!sigCanvas.current) return;
    const empty = sigCanvas.current.isEmpty();
    setIsSigned(!empty);
    if (!empty) {
      setCustomerSignature(sigCanvas.current.toDataURL("image/png"));
    }
  };

  const handleSave = async () => {
    try {
      const contentEl = pageRef.current;
      if (!contentEl) {
        alert("PDF content not found");
        return;
      }
      if (!fullName.trim()) {
        alert("Please enter the customer's full name before saving.");
        return;
      }
      setSaving(true);
      contentEl.classList.add("no-print-mode");
      setRenderSignatureAsImage(true);

      setTimeout(async () => {
        await waitForImagesToLoad(contentEl);
        const canvas = await html2canvas(contentEl, { scale: 2 });
        const image = canvas.toDataURL("image/jpeg");
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(image, "JPEG", 0, 0, width, height);
        const pdfBlob = pdf.output("blob");
        const filePath = `releaseOfLiability/Release_${id}.pdf`;
        const storageRef = ref(getStorage(), filePath);

        try {
          await uploadBytes(storageRef, pdfBlob);
          await getDownloadURL(storageRef);
          await updateDoc(doc(db, "tickets", id), {
            releaseOfLiabilityURL: filePath,
            releaseOfLiabilitySignedAt: new Date().toISOString(),
          });
          alert("Release of Liability saved successfully!");
          setPdfSaved(true);
        } catch (error) {
          console.error("Failed to save PDF:", error);
          alert("An error occurred while saving.");
        } finally {
          setSaving(false);
          setRenderSignatureAsImage(false);
          contentEl.classList.remove("no-print-mode");
        }
      }, 200);
    } catch (error) {
      console.error("Failed to save PDF:", error);
      alert("An error occurred while saving.");
      setSaving(false);
      setRenderSignatureAsImage(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!ticket) return <p>Ticket not found.</p>;

  const alreadySigned = Boolean(ticket.releaseOfLiabilityURL) && !pdfSaved;
  const branchContact = getBranchContact(ticket.location);

  return (
    <div className="parts-page-wrapper">
      {saving && (
        <div className="saving-overlay">
          <div className="spinner-PDF" />
          <p>Saving PDF, please wait...</p>
        </div>
      )}
      <div className="parts-delivery-container" ref={pageRef}>
        <div className="release-liability-header">
          <img
            src={logoImage}
            alt="365 Solutions Logo"
            className="release-liability-logo"
          />
          <div className="release-liability-contact">
            {branchContact.addressLine1}
            <br />
            {branchContact.addressLine2}
            <br />
            Mob: {branchContact.phone}
            <br />
            Email:{" "}
            <span style={{ color: "#1ccad4" }}>{branchContact.email}</span>
          </div>
        </div>
        <hr />
        <h2 className="modal-title">
          Release of Liability for Devices Purchased Abroad
        </h2>

        <div className="info-row">
          <div>
            <p>
              <strong>Customer Name:</strong> {ticket.customerName}
              <br />
              <strong>Device (Foreign Device):</strong> {ticket.machineType}
              <br />
              <strong>Model: </strong>
              {pdfSaved || alreadySigned ? (
                <span>{model || "-"}</span>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Enter device model"
                  className="no-print-border"
                  style={{
                    border: "none",
                    borderBottom: "1px solid #999",
                    fontSize: "15px",
                    marginLeft: 4,
                    width: "60%",
                    minWidth: 160,
                    boxSizing: "border-box",
                  }}
                />
              )}
            </p>
          </div>
          <div>
            <p>
              <strong>Serial Number:</strong> {ticket.serialNum || "-"}
              <br />
              <strong>Service Location Information:</strong>{" "}
              {buildServiceLocation(ticket.location) || "-"}
              <br />
              <strong>Ticket #:</strong> {ticket.location}
              {ticket.ticketNum}
            </p>
          </div>
        </div>

        <div className="notes-section">
          <p>
            Customer is hereby advised that any device purchased abroad and
            brought in for service (such device, a "Foreign Device") may be
            replaced with a device with specs and frequency configuration
            compliant with local regulations and technical requirements,
            which may differ from those of the Foreign Device. By replacing a
            Foreign Device with a local device, Customer understands that
            said replacement model may or may not work, or may present
            limitations, in Foreign Device's country/region of purchase; this
            may result in the replacement device's functional limitations
            with wireless service providers in country/region of purchase,
            caused by the variation in specs and frequency configurations.
          </p>
          <p>
            Upon agreeing to replace the Foreign Device with a local one,
            Customer releases the Service Location, Apple and its
            subsidiaries from any claim or liability related to any device
            malfunction in the country/region in which the Foreign Device was
            purchased, and Customer further accepts they may not request a
            replacement of the local device as a consequence of that here
            disclaimed, whether locally or in any other country.
          </p>
          <p>
            <strong>
              Customer signs below in acknowledgement and understanding of
              the foregoing.
            </strong>
          </p>
        </div>

        <div className="signatures" style={{ justifyContent: "flex-start" }}>
          <div
            className="signature-block"
            style={{ flex: "0 0 auto", width: 220, textAlign: "left" }}
          >
            <label style={{ display: "block" }}>Signature:</label>
            <div className="signature-box">
              <div style={{ position: "relative", width: 200, height: 100 }}>
                {renderSignatureAsImage || pdfSaved || alreadySigned ? (
                  <img
                    src={
                      showSignatureImage && signatureDataUrl
                        ? signatureDataUrl
                        : customerSignature
                    }
                    alt="Customer Signature"
                    style={{ width: 200, height: 100, objectFit: "contain" }}
                  />
                ) : showSignatureImage && signatureDataUrl ? (
                  <img
                    src={signatureDataUrl}
                    alt="Customer Signature"
                    style={{ width: 200, height: 100, objectFit: "contain" }}
                  />
                ) : (
                  <SignatureCanvas
                    penColor="black"
                    canvasProps={{
                      width: 200,
                      height: 100,
                      className: "sig-canvas",
                      style: {
                        width: "200px",
                        height: "100px",
                        touchAction: "none",
                      },
                    }}
                    ref={sigCanvas}
                    onEnd={handleEndSignature}
                  />
                )}
              </div>
            </div>
            {!pdfSaved && !alreadySigned && (
              <div
                className="no-print"
                style={{ display: "flex", gap: "8px", marginTop: "8px" }}
              >
                <button className="clear-button" onClick={clearSignature}>
                  Clear
                </button>
                <button
                  type="button"
                  onClick={showSignatureFromStorage}
                  disabled={!ticket.customerSignatureURL}
                  className="sign-button"
                >
                  Get Customer Signature
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="info-row" style={{ marginTop: 0 }}>
          <div>
            <p>
              <strong>Full Name: </strong>
              {pdfSaved || alreadySigned ? (
                <span>{fullName}</span>
              ) : (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="no-print-border"
                  style={{
                    border: "none",
                    borderBottom: "1px solid #999",
                    fontSize: "15px",
                    marginLeft: 4,
                    width: "70%",
                    minWidth: 220,
                    boxSizing: "border-box",
                  }}
                />
              )}
            </p>
          </div>
          <div>
            <p>
              <strong>Date: </strong> {today}
              <br />
              <strong>Place: </strong>
              {pdfSaved || alreadySigned ? (
                <span>{place}</span>
              ) : (
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  style={{
                    border: "none",
                    borderBottom: "1px solid #999",
                    fontSize: "15px",
                    marginLeft: 4,
                    width: "70%",
                    minWidth: 220,
                    boxSizing: "border-box",
                  }}
                />
              )}
            </p>
          </div>
        </div>

        {alreadySigned && (
          <p style={{ color: "#2e7d32", fontWeight: "bold" }}>
            ✅ This release has already been signed for this ticket.
          </p>
        )}

        {!pdfSaved && !alreadySigned && (
          <div className="action-buttons no-print">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={!(isSigned || showSignatureImage) || saving}
            >
              {saving ? "Saving..." : "Save Release as PDF"}
            </button>
          </div>
        )}

        {(pdfSaved || alreadySigned) && (
          <div className="action-buttons no-print">
            <button
              className="save-button"
              onClick={() => navigate(`/tickets/${id}`)}
            >
              Back to Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReleaseOfLiabilityPage;
