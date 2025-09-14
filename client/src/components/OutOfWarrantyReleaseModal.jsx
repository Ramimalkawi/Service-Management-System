import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import SignatureCanvas from "react-signature-canvas";
import Modal from "react-modal";
import "./OutOfWarrantyReleaseModal.css";

Modal.setAppElement("#root");

const OutOfWarrantyReleaseModal = ({
  isOpen,
  onClose,
  customerData,
  onSign,
}) => {
  const sigCanvas = useRef();
  const [hasDrawn, setHasDrawn] = useState(false);

  const handleClear = () => {
    sigCanvas.current.clear();
    setHasDrawn(false);
  };

  const [saving, setSaving] = useState(false);
  const releaseRef = useRef();

  const handleAccept = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature.");
      return;
    }
    setSaving(true);
    try {
      // Hide buttons before rendering to canvas
      const releasePaper = releaseRef.current;
      const clearBtn = releasePaper.querySelector(".release-clear-btn");
      const acceptBtn = releasePaper.querySelector(".release-sign-btn");
      if (clearBtn) clearBtn.style.display = "none";
      if (acceptBtn) acceptBtn.style.display = "none";

      // Add padding for margins
      const originalPadding = releasePaper.style.padding;
      releasePaper.style.padding = "40px";

      // Render as image
      const canvas = await html2canvas(releasePaper, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      // Restore buttons and padding
      if (clearBtn) clearBtn.style.display = "";
      if (acceptBtn) acceptBtn.style.display = "";
      releasePaper.style.padding = originalPadding;

      // PDF with margins
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40; // 40pt margin
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      const pdfBlob = pdf.output("blob");

      // Upload PDF to Firebase Storage
      const storage = getStorage();
      const fileName = `noresponsibility/${customerData.ticketNum}_noresponsibility_${Date.now()}.pdf`;
      const fileRef = storageRef(storage, fileName);
      await uploadBytes(fileRef, pdfBlob);
      const downloadURL = await getDownloadURL(fileRef);

      // Pass the PDF URL to parent for ticket creation
      onSign(downloadURL);
      onClose();
    } catch (err) {
      alert("Failed to save PDF: " + err.message);
    }
    setSaving(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="out-of-warranty-modal"
      overlayClassName="out-of-warranty-overlay"
    >
      <div className="release-paper" ref={releaseRef}>
        <div className="release-header">
          <img
            src="/src/assets/logo-and-apple.png"
            alt="365 Solutions Logo"
            className="release-logo"
          />
          <div className="release-contact">
            Mecca Street , Building No. 221
            <br />
            Amman, Jordan
            <br />
            Mob: +962 (79) 6818189
            <br />
            Email:{" "}
            <span style={{ color: "#1ccad4" }}>help@365solutionsjo.com</span>
          </div>
        </div>
        <hr />
        <h2 className="release-title-ar">إخلاء مسؤولية/الأجهزة خارج الكفالة</h2>
        <h3 className="release-title-en">
          Release of Liability / Out-of-Warranty Devices
        </h3>
        <div className="release-ar release-statement-ar">
          أولاً: بيانات العميل والجهاز
        </div>
        <div className="release-section">
          <div className="release-info-block">
            <h4>
              Customer Information
              <br />
              <span className="release-ar">معلومات الزبون</span>
            </h4>
            <div className="release-info-box">
              <div>Customer Name: {customerData.customerName}</div>
              <div>Mobile No: {customerData.mobileNumber}</div>
              <div>E-mail: {customerData.emailAddress}</div>
            </div>
          </div>
          <div className="release-info-block">
            <h4>
              Device Information
              <br />
              <span className="release-ar">معلومات الجهاز</span>
            </h4>
            <div className="release-info-box">
              <div>Device Model: {customerData.machineType}</div>
              <div>Device Desc: {customerData.deviceDescription}</div>
              <div>Serial Number: {customerData.serialNum}</div>
              <div>Complaint: {customerData.symptom}</div>
            </div>
          </div>
        </div>

        <div
          className="release-ar release-statement-ar"
          style={{ marginTop: 8 }}
        >
          ثانياً:
        </div>
        <div className="release-statement">
          <p>
            أوافق أنا {customerData.customerName} صاحب الجهاز الموضحة بياناته في
            الأعلى على استكمال الفحص المتعلقة بالجهاز، وعليه أخلي مسؤولية الشركة
            من أي أضرار قد تظهر على الجهاز لاحقاً نتيجة لفتح الجهاز وتحديداً
            للأجهزة التي قد تعرضت سابقاً للسقوط أو تبديل قطع غير أصلية خارج
            مراكز الصيانة المعتمدة من قبل أو أي سوء استخدام في الأجزاء الداخلية
            للجهاز ولا تتحمل الشركة أي مسؤولية أو أي تبعات قانونية لذلك أو دفع
            أي تعويضات عن ذلك.
          </p>
        </div>
        <div className="release-signature-section">
          <div className="release-signature-box">
            <SignatureCanvas
              ref={sigCanvas}
              penColor="#222"
              canvasProps={{
                width: 220,
                height: 80,
                className: "release-signature-canvas",
              }}
              onBegin={() => setHasDrawn(true)}
            />
            <div className="release-sign-label">Signature / التوقيع</div>
            <button
              className="release-clear-btn"
              type="button"
              onClick={handleClear}
              style={{
                marginTop: 8,
                background: "#eee",
                color: "#222",
                border: "none",
                borderRadius: 6,
                padding: "6px 16px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
          <div className="release-sign-info">
            <div>Full Name: {customerData.customerName}</div>
            <div>Date: {new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>
        <button
          className="release-sign-btn"
          onClick={handleAccept}
          disabled={!hasDrawn || saving}
        >
          {saving ? "Saving..." : "Accept & Save"}
        </button>
      </div>
    </Modal>
  );
};

export default OutOfWarrantyReleaseModal;
