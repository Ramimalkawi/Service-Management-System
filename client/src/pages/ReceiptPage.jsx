import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";
import { useParams, useNavigate } from "react-router-dom";
import logoImage from "../assets/logo_new.png";
import "./ReceiptPage.css";
import { useUser } from "../context/userContext";

const ReceiptPage = () => {
  const { id } = useParams();
  const { technician } = useUser();
  const [isSigned, setIsSigned] = useState(false);
  const sigCanvas1 = useRef(null);
  const sigCanvas2 = useRef(null);
  const pageRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [partsData, setPartsData] = useState(null);
  const [pricedParts, setPricedParts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const ticketRef = doc(db, "tickets", id);
      const ticketSnap = await getDoc(ticketRef);
      if (ticketSnap.exists()) {
        const data = ticketSnap.data();
        setTicket(data);
        if (data.partDeliveryNote) {
          const noteRef = doc(db, "partsDeliveryNotes", data.partDeliveryNote);
          const noteSnap = await getDoc(noteRef);
          if (noteSnap.exists()) {
            const noteData = noteSnap.data();
            setPartsData(noteData);

            // Filter parts with prices > 0
            const partsWithPrices =
              noteData.parts?.filter(
                (part) => parseFloat(part.price || 0) > 0
              ) || [];
            setPricedParts(partsWithPrices);

            // Calculate total amount
            const total = partsWithPrices.reduce((sum, part) => {
              return (
                sum + parseFloat(part.price || 0) * parseInt(part.quantity || 1)
              );
            }, 0);
            setTotalAmount(total);
          }
        }
      }
    };
    fetchData();
  }, [id]);

  const clearSignature = () => {
    sigCanvas1.current.clear();
    sigCanvas2.current.clear();
    setIsSigned(false);
  };

  const handleEndSignature = () => {
    if (!sigCanvas2.current.isEmpty()) {
      setIsSigned(true);
    }
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
      const canvas = await html2canvas(contentEl, { scale: 2 });
      const image = canvas.toDataURL("image/jpeg");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(image, "JPEG", 0, 0, width, height);
      const pdfBlob = pdf.output("blob");
      const filePath = `receipts/Receipt_${id}.pdf`;
      const storageRef = ref(getStorage(), filePath);

      await uploadBytes(storageRef, pdfBlob);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "tickets", id), {
        invoiceURL: filePath,
      });
      alert("Receipt saved successfully!");
      navigate(`/tickets/`);
    } catch (error) {
      console.error("Failed to save PDF:", error);
      alert("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (!ticket || !partsData || pricedParts.length === 0) {
    return <p>Loading...</p>;
  }

  return (
    <div className="receipt-page-wrapper">
      {saving && (
        <div className="saving-overlay">
          <div className="spinner-PDF" />
          <p>Saving PDF, please wait...</p>
        </div>
      )}

      <div className="receipt-container" ref={pageRef}>
        <div className="header-section">
          <img src={logoImage} alt="365 Solutions Logo" className="logo" />
          <h2 className="modal-title">Receipt</h2>
        </div>
        <div className="info-row">
          <div>
            <p>
              <strong>Date:</strong> {new Date().toLocaleDateString("en-GB")}
              <br />
              <strong>Customer Name:</strong> {ticket.customerName}
            </p>
            <p>
              <strong>Receipt #:</strong> {ticket.location}
              {ticket.ticketNum}
              <br />
              <strong>Product Type:</strong> {ticket.machineType}
            </p>
          </div>
          <div>
            <p>
              <strong>Serial Number:</strong> {ticket.serialNum}
              <br />
              <strong>Device Issue:</strong> {ticket.symptom || "-"}
              <br />
              <strong>Warranty Status:</strong> {ticket.warrantyStatus || "-"}
              <br />
              <strong>Technician:</strong>{" "}
              {technician?.name || "Unknown Technician"}
            </p>
          </div>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Part #</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total Price</th>
            </tr>
          </thead>
          <tbody>
            {pricedParts.map((part, index) => {
              const unitPrice = parseFloat(part.price || 0);
              const quantity = parseInt(part.quantity || 1);
              const totalPrice = unitPrice * quantity;
              return (
                <tr key={index}>
                  <td>{part.description}</td>
                  <td>{part.partNumber}</td>
                  <td>{quantity}</td>
                  <td>{unitPrice.toFixed(2)} JOD</td>
                  <td>{totalPrice.toFixed(2)} JOD</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="4" className="total-label">
                <strong>Total Amount:</strong>
              </td>
              <td className="total-amount">
                <strong>{totalAmount.toFixed(2)} JOD</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="notes-section">
          <p>
            <strong>Service Notes:</strong> {partsData.serviceNotes || "-"}
          </p>
          <ol>
            <li>Warranty for any replaced part is valid for 90 days</li>
            <li>
              Refund for any paid services is within 3 days if the same issue
              occurred again
            </li>
            <li>Receipt should be provided upon refund</li>
          </ol>
        </div>

        <div className="signatures">
          <div className="signature-block">
            <p>
              <strong>Issued by:</strong>{" "}
              {technician?.name || "Unknown Technician"}
            </p>
            <label>Signature:</label>
            <div className="signature-box">
              <SignatureCanvas
                penColor="black"
                canvasProps={{
                  width: 200,
                  height: 100,
                  className: "sig-canvas",
                }}
                ref={sigCanvas1}
              />
            </div>
          </div>

          <div className="signature-block">
            <p>
              <strong>Paid by:</strong> {ticket.customerName}
            </p>
            <label>Signature:</label>
            <div className="signature-box">
              <SignatureCanvas
                penColor="black"
                canvasProps={{
                  width: 200,
                  height: 100,
                  className: "sig-canvas",
                }}
                ref={sigCanvas2}
                onEnd={handleEndSignature}
              />
            </div>
          </div>
        </div>

        <div className="action-buttons no-print">
          <button className="clear-button" onClick={clearSignature}>
            Clear
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={!isSigned}
          >
            Save Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPage;
