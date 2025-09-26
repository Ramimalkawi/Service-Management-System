import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import SignatureCanvas from "react-signature-canvas";
import Modal from "react-modal";
import "./CustomerContractModal.css";

Modal.setAppElement("#root");

const CustomerContractModal = ({
  isOpen,
  onClose,
  customerData,
  onSign,
  contractHtml,
}) => {
  const sigCanvas = useRef();
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleClear = () => {
    sigCanvas.current.clear();
    setHasDrawn(false);
  };

  const handleAccept = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature.");
      return;
    }
    setSaving(true);
    const signature = sigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      // Upload signature image to Firebase Storage
      const storage = getStorage();
      const signatureRef = ref(
        storage,
        `customerSignatures/${customerData.ticketNum}_${customerData.customerName}.png`
      );
      // Convert dataURL to Blob
      const response = await fetch(signature);
      const signatureBlob = await response.blob();
      await uploadBytes(signatureRef, signatureBlob);
      const signatureUrl = await getDownloadURL(signatureRef);

      // Create a temporary container for rendering
      const tempDiv = document.createElement("div");
      tempDiv.style.width = "800px";
      tempDiv.style.background = "#fff";
      tempDiv.style.padding = "24px";
      tempDiv.style.direction = "rtl";
      tempDiv.style.textAlign = "right";
      tempDiv.innerHTML = contractHtml;

      // Inject signature image into both placeholders
      const injectSignature = (sectionId) => {
        const section = tempDiv.querySelector(sectionId);
        if (section) {
          const img = document.createElement("img");
          img.src = signature;
          img.alt = "Customer Signature";
          img.style.maxWidth = "150px";
          img.style.height = "50px";
          img.style.display = "block";
          img.style.margin = "8px 0 0 auto";
          img.style.float = "left";
          section.appendChild(img);
        }
      };
      injectSignature("#customer-signature-section");
      injectSignature("#customer-signature-section-mac");
      injectSignature("#customer-signature-section-iPhone");
      injectSignature("#customer-signature-section-info"); // In case there's a fourth section in future
      setTimeout(() => {
        tempDiv.querySelectorAll("ol").forEach((ol) => {
          ol.style.direction = "rtl";
          ol.style.textAlign = "right";
        });
        tempDiv.querySelectorAll("li").forEach((li) => {
          li.style.direction = "rtl";
          li.style.textAlign = "right";
        });
      }, 0);
      document.body.appendChild(tempDiv);

      // Render contract HTML to canvas
      const contractCanvas = await html2canvas(tempDiv, {
        scale: 2,
        windowWidth: 800,
        windowHeight: tempDiv.scrollHeight,
      });
      document.body.removeChild(tempDiv);

      //   // PDF page size
      //   const pdfWidth = 800;
      //   const pdfHeight = 1200;
      //   const imgHeight = contractCanvas.height;
      //   const imgData = contractCanvas.toDataURL("image/png");

      // PDF page size
      const pdfWidth = 800;
      const pdfHeight = 1200;
      const imgData = contractCanvas.toDataURL("image/png");

      // Create PDF
      const pdf = new jsPDF({
        orientation: "p",
        unit: "px",
        format: [pdfWidth, pdfHeight],
      });

      // Scale the image to fit exactly one page
      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        pdfWidth,
        pdfHeight,
        undefined,
        "FAST"
      );

      //   let remainingHeight = imgHeight;
      //   let position = 0;
      //   let pageNum = 1;

      //   // Add contract image in pages
      //   while (remainingHeight > 0) {
      //     pdf.addImage(
      //       imgData,
      //       "PNG",
      //       0,
      //       0,
      //       pdfWidth,
      //       Math.min(pdfHeight, remainingHeight),
      //       undefined,
      //       "FAST",
      //       position
      //     );
      //     remainingHeight -= pdfHeight;
      //     position += pdfHeight;
      //     if (remainingHeight > 0) pdf.addPage([pdfWidth, pdfHeight], "p");
      //     pageNum++;
      //   }

      //   // Add signature at the end of the last page
      //   pdf.setPage(pageNum - 1);
      //   pdf.addImage(signature, "PNG", 250, pdfHeight - 120, 300, 100);

      // Save PDF to blob
      const pdfBlob = pdf.output("blob");

      // Upload PDF to Firebase Storage
      const contractRef = ref(
        storage,
        `contracts/${customerData.ticketNum}_${customerData.customerName}_contract.pdf`
      );
      await uploadBytes(contractRef, pdfBlob);
      const contractUrl = await getDownloadURL(contractRef);

      await onSign(contractUrl, signatureUrl); // Pass contract PDF URL and signature URL to parent
    } catch (err) {
      alert("Failed to generate or upload contract PDF or signature.");
      console.error(err);
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="customer-contract-modal"
      overlayClassName="customer-contract-overlay"
    >
      <div className="contract-content">
        {/* Render contract HTML content */}
        <div
          className="contract-html-content"
          dangerouslySetInnerHTML={{ __html: contractHtml }}
        />
        <div className="contract-signature-section">
          <div className="contract-signature-box">
            <SignatureCanvas
              ref={sigCanvas}
              penColor="#222"
              canvasProps={{
                width: 300,
                height: 100,
                className: "contract-signature-canvas",
              }}
              onBegin={() => setHasDrawn(true)}
            />
            <div className="contract-sign-label">Signature / التوقيع</div>
            <button
              className="contract-clear-btn"
              type="button"
              onClick={handleClear}
              style={{ marginTop: 8 }}
            >
              Clear
            </button>
          </div>
          <div className="contract-sign-info">
            <div>Full Name: {customerData.customerName}</div>
            <div>Date: {new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>
        <button
          className="contract-sign-btn"
          onClick={handleAccept}
          disabled={!hasDrawn || saving}
        >
          {saving ? "Saving..." : "Accept & Save"}
        </button>
      </div>
    </Modal>
  );
};

export default CustomerContractModal;
