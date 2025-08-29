import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import "./DeliveryModal.css";
import PartsDeliveryModal from "./PartsDeliveryModal";

const DeliveryModal = ({ isOpen, onClose, ticket }) => {
  const sigCanvas = useRef(null);
  const printRef = useRef();
  const [isSigned, setIsSigned] = useState(false);
  const [showPartsModal, setShowPartsModal] = useState(false);

  if (!isOpen || !ticket) return null;

  const today = new Date().toLocaleDateString("en-GB");

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

        await updateDoc(doc(db, "tickets", ticket.id), {
          deliveryNoteURL: filePath,
        });

        onClose();
      }, 200); // slight delay ensures rendering is complete
    } catch (err) {
      console.error("Error saving delivery note:", err);
      alert("Failed to save PDF.");
    } finally {
      // ✅ Always remove the class afterward
      printRef.current?.classList.remove("no-print-mode");
      setIsSigned(false);
      if (ticket.partDeliveryNote) {
        setShowPartsModal(true);
      } else {
        onClose(); // Close if no parts to sign
      }
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
    setIsSigned(false);
  };

  return (
    <div className="delivery-modal-overlay">
      <div className="delivery-modal" ref={printRef}>
        <button className="modal-close-button" onClick={onClose}>
          ×
        </button>
        <div style={{ display: "flex" }}>
          <div className="modal-contents">
            <img src="/logo.png" alt="Company Logo" className="logo" />
            <h2 className="modal-title">إقرار استلام جهاز</h2>
            <h2>OKKKKKKK</h2>
            <p className="arabic-text">
              أقر أنا <strong>{ticket.customerName}</strong> بأني قد استلمت جهاز{" "}
              <strong>{ticket.machineType}</strong>
              <br />
              والذي تم تسليمه للشركة بتاريخ <strong>{ticket.date}</strong> ويحمل
              رقم تسلسلي <strong>{ticket.serialNum}</strong>
              <br />
              ويحمل استلام برقم <strong>{ticket.ticketNum}</strong> لأغراض
              الصيانة وقد تم عمل الصيانة اللازمة من قبلهم
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
                    penColor="black"
                    minWidth={0.5} // Minimum stroke width
                    maxWidth={1.5} // Maximum stroke width
                    canvasProps={{
                      width: 100,
                      height: 100,
                      className: "sig-canvas",
                    }}
                    ref={sigCanvas}
                    onEnd={() => setIsSigned(!sigCanvas.current.isEmpty())}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>التاريخ:</label>
                <span>{today}</span>
              </div>
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
            <div className="button-row">
              <button onClick={clearSignature} className="clear-button">
                Clear
              </button>
              <button
                onClick={handleSavePDF}
                className="save-button"
                disabled={!isSigned}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      <PartsDeliveryModal
        isOpen={showPartsModal}
        onClose={() => {
          setShowPartsModal(false);
          onClose(); // fully close flow
        }}
        ticket={ticket}
      />
    </div>
  );
};

export default DeliveryModal;
