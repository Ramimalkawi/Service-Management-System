import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";
import { useUser } from "../context/userContext";
import logoImage from "../assets/logo_new.png";
import "./PartsDeliveryPage.css";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

const PriceQuotationPage = () => {
  const { id } = useParams();
  const { technician } = useUser();
  const [ticket, setTicket] = useState(null);
  const [quotationData, setQuotationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerSignature, setCustomerSignature] = useState("");
  const [technicianSignature, setTechnicianSignature] = useState("");
  const [showSavedCustomerSignature, setShowSavedCustomerSignature] =
    useState(false);
  const [savedCustomerSignatureUrl, setSavedCustomerSignatureUrl] =
    useState("");
  const [showSignatureImage, setShowSignatureImage] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [renderSignaturesAsImages, setRenderSignaturesAsImages] =
    useState(false);
  const [pdfSaved, setPdfSaved] = useState(false);
  const sigCanvas1 = useRef(null);
  const sigCanvas2 = useRef(null);
  const pageRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const ticketRef = doc(db, "tickets", id);
      const ticketSnap = await getDoc(ticketRef);
      if (ticketSnap.exists()) {
        const data = ticketSnap.data();
        setTicket(data);
        if (data.priceQuotationRef) {
          const quotationRef = doc(
            db,
            "priceQuotationsData",
            data.priceQuotationRef
          );
          const quotationSnap = await getDoc(quotationRef);
          if (quotationSnap.exists()) {
            setQuotationData(quotationSnap.data());
          }
        }
        if (data.customerSignatureURL) {
          setSavedCustomerSignatureUrl(data.customerSignatureURL);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const clearSignature = () => {
    // Clear both signature canvases and reset signature states
    if (sigCanvas1.current) sigCanvas1.current.clear();
    if (sigCanvas2.current) sigCanvas2.current.clear();
    setTechnicianSignature("");
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
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        alert("Failed to load signature image.");
      }
    }
  };

  const handleEndSignature = () => {
    setIsSigned(!(sigCanvas2.current && sigCanvas2.current.isEmpty()));
  };

  const handleSave = async () => {
    try {
      const contentEl = pageRef.current;
      if (!contentEl) {
        alert("PDF content not found");
        return;
      }
      setSaving(true);
      contentEl.classList.add("no-print-mode");
      setRenderSignaturesAsImages(true);
      setTimeout(async () => {
        const canvas = await html2canvas(contentEl, { scale: 2 });
        const image = canvas.toDataURL("image/jpeg");
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(image, "JPEG", 0, 0, width, height);
        const pdfBlob = pdf.output("blob");
        const filePath = `priceQuotations/PriceQuotation_${id}.pdf`;
        const storageRef = ref(getStorage(), filePath);
        await uploadBytes(storageRef, pdfBlob);
        const url = await getDownloadURL(storageRef);
        await updateDoc(doc(db, "tickets", id), {
          priceQuotationURL: filePath,
        });
        alert("Price Quotation saved successfully!");
        setSaving(false);
        setRenderSignaturesAsImages(false);
        setPdfSaved(true);
        contentEl.classList.remove("no-print-mode");
      }, 200);
    } catch (error) {
      console.error("Failed to save PDF:", error);
      alert("An error occurred while saving.");
      setSaving(false);
      setRenderSignaturesAsImages(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!ticket) return <p>Ticket not found.</p>;
  if (!ticket.priceQuotationRef)
    return <p>No price quotation available for this ticket.</p>;

  return (
    <div className="parts-page-wrapper">
      {saving && (
        <div className="saving-overlay">
          <div className="spinner-PDF" />
          <p>Saving PDF, please wait...</p>
        </div>
      )}
      <div className="parts-delivery-container" ref={pageRef}>
        <div className="header-section">
          <img src={logoImage} alt="365 Solutions Logo" className="logo" />
          <h2 className="modal-title">Price Quotation</h2>
        </div>
        <div className="info-row">
          <div>
            <p>
              <strong>Customer Name:</strong> {ticket.customerName}
              <br />
              <strong>Device:</strong> {ticket.machineType}
              <br />
              <strong>Ticket #:</strong> {ticket.ticketNum}
            </p>
          </div>
        </div>
        {quotationData && (
          <div
            className="quotation-details"
            style={{
              margin: "24px 0",
              background: "#f9f9f9",
              padding: 16,
              borderRadius: 8,
            }}
          >
            <h3>Quotation Details</h3>
            {quotationData.notesText && (
              <p>
                <strong>Notes:</strong> {quotationData.notesText}
              </p>
            )}
            <table className="parts-table">
              <thead>
                <tr style={{ background: "#eee" }}>
                  <th>Type</th>
                  <th>Part #</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Price (JOD)</th>
                  <th>Total (JOD)</th>
                  <th>Service Type</th>
                </tr>
              </thead>
              <tbody>
                {(quotationData.quotes || []).map((quote, idx) => (
                  <tr key={idx}>
                    <td>{quote.service ? "Service" : "Part"}</td>
                    <td>
                      {quote.partNumber ||
                        (quote.service ? quote.serviceType : "")}
                    </td>
                    <td>{quote.description}</td>
                    <td>{quote.quantity}</td>
                    <td>
                      {quote.price?.toFixed
                        ? quote.price.toFixed(2)
                        : quote.price}{" "}
                      JOD
                    </td>
                    <td>{(quote.price * quote.quantity).toFixed(2)} JOD</td>
                    <td>{quote.service ? quote.serviceType : ""}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  <td colSpan="5" style={{ textAlign: "right" }}>
                    Total:
                  </td>
                  <td colSpan="2">
                    {quotationData.quotes
                      ? quotationData.quotes
                          .reduce((total, q) => total + q.price * q.quantity, 0)
                          .toFixed(2)
                      : "0.00"}{" "}
                    JOD
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="signatures">
          <div className="signature-block">
            <p>
              <strong>Issued by:</strong>{" "}
              {technician?.name || "Unknown Technician"}
            </p>
            <label>Signature:</label>
            <div className="signature-box">
              {renderSignaturesAsImages || pdfSaved ? (
                <img
                  src={technicianSignature}
                  alt="Technician Signature"
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
                  ref={sigCanvas1}
                  onEnd={() =>
                    setTechnicianSignature(
                      sigCanvas1.current.toDataURL("image/png")
                    )
                  }
                  disabled={pdfSaved}
                />
              )}
            </div>
          </div>
          <div className="signature-block">
            <p>
              <strong>Received by:</strong> {ticket.customerName}
            </p>
            <label>Signature:</label>
            <div className="signature-box">
              <div style={{ position: "relative", width: 200, height: 100 }}>
                {renderSignaturesAsImages || pdfSaved ? (
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
                    ref={sigCanvas2}
                    onEnd={() => {
                      setCustomerSignature(
                        sigCanvas2.current.toDataURL("image/png")
                      );
                      handleEndSignature();
                    }}
                    disabled={pdfSaved}
                  />
                )}
              </div>
            </div>
            {!pdfSaved && (
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
        {!pdfSaved && (
          <div className="action-buttons no-print">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={!(isSigned || showSignatureImage) || saving}
            >
              {saving ? "Saving..." : "Save Quotation as PDF"}
            </button>
          </div>
        )}
      </div>
      {/* Next button logic */}
      {ticket && ticket.partDeliveryNote && !ticket.partDeliveryNoteURL && (
        <button
          className="next-arrow-button no-print"
          onClick={() => {
            navigate(`/tickets/${id}/part-delivery`);
          }}
          title="Next: Sign Parts Delivery Note"
        >
          Next
          <FaArrowRight />
        </button>
      )}
    </div>
  );
};

export default PriceQuotationPage;
