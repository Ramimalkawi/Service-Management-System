import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";
import "./PartsDeliveryModal.css";

const PartsDeliveryModal = ({ isOpen, onClose, ticket }) => {
  const [isSigned, setIsSigned] = useState(false);
  const [signatureURL, setSignatureURL] = useState(null);
  const sigCanvas = useRef(null);
  const printRef = useRef();
  const modalRef = useRef(null);
  const [partsData, setPartsData] = useState(null);

  useEffect(() => {
    const fetchPartsData = async () => {
      if (!ticket?.partDeliveryNote) return;
      const noteRef = doc(db, "partsDeliveryNotes", ticket.partDeliveryNote);
      const noteSnap = await getDoc(noteRef);
      if (noteSnap.exists()) {
        setPartsData(noteSnap.data());
      }
    };
    fetchPartsData();
  }, [ticket]);

  const clearSignature = () => {
    sigCanvas.current.clear();
    setIsSigned(false);
  };

  const handleEndSignature = () => {
    if (!sigCanvas.current.isEmpty()) {
      setIsSigned(true);
    }
  };

  const handleSave = async () => {
    try {
      setTimeout(async () => {
        const contentEl = modalRef.current;
        if (!contentEl) {
          alert("PDF content not found");
          return;
        }
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
        const filePath = `testDeliveryNotes/DN_${ticket.id}.pdf`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, pdfBlob);
        const url = await getDownloadURL(storageRef);
        await updateDoc(doc(db, "tickets", ticket.id), {
          partsDeliveryNoteURL: filePath,
        });
        alert("Parts Delivery note saved successfully!");
        onClose();
      }, 200);
    } catch (error) {
      console.error("Failed to save PDF:", error);
      alert("An error occurred while saving.");
    }
  };

  if (!isOpen || !partsData) return null;

  return (
    <div className="parts-modal-overlay">
      <div className="parts-modal" ref={modalRef}>
        <h2 className="modal-title">Delivery Note</h2>
        <div className="info-row">
          <div>
            <p>
              <strong>Delivery Date:</strong>{" "}
              {new Date().toLocaleDateString("en-GB")}
              <br />
              <strong>Customer Name:</strong> {ticket.customerName}
            </p>
            <p>
              <strong>Invoice #:</strong> {ticket.ticketNum}
              <br />
              <strong>Product Type:</strong> {ticket.machineType}
              <br />
              <strong>Repair ID:</strong>
            </p>
          </div>
          <div>
            <p>
              <strong>Serial Number:</strong> {ticket.serialNum}
              <br />
              <strong>Device Issue:</strong> {ticket.deviceIssue || "-"}
              <br />
              <strong>Warranty Status:</strong> {ticket.warrantyStatus || "-"}
              <br />
              <strong>Technician:</strong>{" "}
              {ticket.technician || "Unknown Technician"}
              <br />
              <strong>Tech ID:</strong>
            </p>
          </div>
        </div>

        <table className="parts-table">
          <thead>
            <tr>
              <th>Part Description</th>
              <th>Part #</th>
              <th>Old Serial#</th>
              <th>New Serial#</th>
              <th>Quantity</th>
              <th>Warranty Status</th>
            </tr>
          </thead>
          <tbody>
            {partsData.parts?.map((part, index) => (
              <tr key={index}>
                <td>{part.description}</td>
                <td>{part.partNumber}</td>
                <td>{part.oldSerial}</td>
                <td>{part.newSerial}</td>
                <td>{part.quantity}</td>
                <td>{part.warranty}</td>
              </tr>
            ))}
          </tbody>
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
              {ticket.technician || "Unknown Technician"}
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
                ref={sigCanvas}
                onEnd={handleEndSignature}
              />
            </div>
          </div>

          <div className="signature-block">
            <p>
              <strong>Received by:</strong> {ticket.customerName}
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
                ref={sigCanvas}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsDeliveryModal;
