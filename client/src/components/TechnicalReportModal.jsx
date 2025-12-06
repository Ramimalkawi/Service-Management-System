import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { db, storage } from "../firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import "./TechnicalReportModal.css";
import { useUser } from "../context/userContext";

const TechnicalReportModal = ({ isOpen, onClose, ticket }) => {
  const { technician } = useUser();
  const [troubleshoot, setTroubleshoot] = useState("");
  const [inspection, setInspection] = useState("");
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const reportRef = useRef();

  const isIrbidLocation = ticket?.location
    ? ticket.location.toString().toUpperCase().startsWith("I")
    : false;
  const footerAddress = isIrbidLocation
    ? "365 Solutions, Wasfi Al-Tal Street, Irbid, Jordan"
    : "365 Solutions Mecca Street Bldg 221 Amman, Jordan";
  const footerMobile = isIrbidLocation
    ? "+962 79 666 8831"
    : "+962 79 681 8189";
  const footerEmail = isIrbidLocation
    ? "irbid@365solutionsjo.com"
    : "help@365solutionsjo.com";

  if (!isOpen || !ticket) return null;

  const handleSavePDF = async () => {
    setSaving(true);
    setIsPrintMode(true);
    // Wait for the DOM to update
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      // Generate PDF from the report content
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      const pdfBlob = pdf.output("blob");

      // Upload PDF to Firebase Storage
      const fileName = `techReports/${ticket.id}_techReport_${Date.now()}.pdf`;
      const fileRef = storageRef(storage, fileName);
      await uploadBytes(fileRef, pdfBlob);
      const downloadURL = await getDownloadURL(fileRef);

      // Save URL to Firestore ticket document
      const ticketDocRef = doc(db, "tickets", ticket.id);
      await updateDoc(ticketDocRef, { techReportURL: downloadURL });

      alert("Technical report PDF saved and uploaded successfully.");
      setSaving(false);
      setIsPrintMode(false);
      onClose();
    } catch (err) {
      setSaving(false);
      setIsPrintMode(false);
      alert("Failed to save PDF: " + err.message);
    }
  };

  return (
    <div className="technical-report-modal-overlay">
      <div className="technical-report-modal">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
        <div ref={reportRef}>
          <div className="report-header">
            <div className="report-header-left">
              <img
                src="/logo-and-apple.png"
                alt="Apple ASP"
                className="apple-logo"
              />
            </div>
            <div className="report-header-right">
              <h2 className="report-title">Technical Report</h2>
            </div>
          </div>
          <hr />
          <div className="report-info-grid">
            <div>
              <strong>Report Issuing Date:</strong>{" "}
              {new Date().toLocaleDateString("en-GB")}
            </div>
            <div>
              <strong>Time:</strong>{" "}
              {new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div>
              <strong>Technician Name:</strong> {technician.name || ""}
            </div>
            <div>
              <strong>Customer Name:</strong> {ticket.customerName || ""}
            </div>
            <div>
              <strong>Technician ID:</strong> {technician.techID || ""}
            </div>
          </div>
          <div className="report-details">
            <div>
              <strong>Device Type:</strong> {ticket.machineType}
            </div>
            <div>
              <strong>Description:</strong> {ticket.deviceDescription}
            </div>
            <div>
              <strong>Device SN:</strong> {ticket.serialNum}
            </div>
            <div>
              <strong>Warranty status:</strong>{" "}
              <input
                type="checkbox"
                checked={ticket.warrantyStatus === "Apple limited warranty"}
                readOnly
              />{" "}
              Apple limited warranty{" "}
              <input
                type="checkbox"
                checked={ticket.warrantyStatus === "Out of warranty"}
                readOnly
              />{" "}
              Out of warranty
            </div>
            <div>
              <strong>Ticket Number:</strong> {ticket.location}
              {ticket.ticketNum}
            </div>
            <div>
              <strong>Symptom:</strong> {ticket.symptom}
            </div>
          </div>
          <div className="report-section report-row">
            <strong>Troubleshoot</strong>
            {isPrintMode ? (
              <div
                style={{
                  border: "1px solid #ccc",
                  minHeight: 60,
                  padding: 8,
                  marginTop: 4,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  background: "#fafafa",
                }}
              >
                {troubleshoot}
              </div>
            ) : (
              <textarea
                className="report-textarea"
                value={troubleshoot}
                onChange={(e) => setTroubleshoot(e.target.value)}
                placeholder="Enter troubleshoot details..."
                rows={3}
              />
            )}
          </div>
          <div className="report-section report-row">
            <strong>Inspection</strong>
            {isPrintMode ? (
              <div
                style={{
                  border: "1px solid #ccc",
                  minHeight: 60,
                  padding: 8,
                  marginTop: 4,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  background: "#fafafa",
                }}
              >
                {inspection}
              </div>
            ) : (
              <textarea
                className="report-textarea"
                value={inspection}
                onChange={(e) => setInspection(e.target.value)}
                placeholder="Enter inspection details..."
                rows={3}
              />
            )}
          </div>
          <table className="parts-table">
            <thead>
              <tr>
                <th>parts Needed for repair</th>
                <th>Part Number</th>
                <th>Description</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td></td>
                <td>
                  <input
                    className="parts-input"
                    type="text"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="Enter part number"
                  />
                </td>
                <td>
                  <input
                    className="parts-input"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description"
                  />
                </td>
                <td>
                  <input
                    className="parts-input"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter price"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="arabic-notes">
            <ol>
              <li>هذا التقرير صالح لمدة ٤٨ ساعة من تاريخ إصداره</li>
              <li>
                أي تعديل على التقرير بالشطب أو الإضافة يصبح التقرير لاغياً
              </li>
              <li>
                في حال استلام العميل التقرير والجهاز وخروجه من مركز الصيانة فإن
                المسؤولية تقع على صاحب الجهاز في حال حدوث أي ضرر أو أي عطب في
                الجهاز فيما بعد (الأعطال المستقبلية)
              </li>
              <li>لا يعتمد التقرير ما لم يختم بالختم الرسمي للشركة</li>
            </ol>
          </div>
          <div className="report-footer">
            {footerAddress}
            <br />
            Mob: {footerMobile} Email: {footerEmail}
          </div>
        </div>
        <button
          className="save-pdf-btn"
          onClick={handleSavePDF}
          disabled={saving}
          style={{
            marginTop: 24,
            width: "100%",
            padding: "12px",
            fontSize: "1.1rem",
            background: "#1ccad4",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save PDF"}
        </button>
      </div>
    </div>
  );
};

export default TechnicalReportModal;
