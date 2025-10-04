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
  const customerSigCanvas = useRef();
  const technicianSigCanvas = useRef();
  const [hasDrawnCustomer, setHasDrawnCustomer] = useState(false);
  const [hasDrawnTechnician, setHasDrawnTechnician] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleClearCustomer = () => {
    customerSigCanvas.current.clear();
    setHasDrawnCustomer(false);
  };
  const handleClearTechnician = () => {
    technicianSigCanvas.current.clear();
    setHasDrawnTechnician(false);
  };

  const handleAccept = async () => {
    if (
      customerSigCanvas.current.isEmpty() ||
      technicianSigCanvas.current.isEmpty()
    ) {
      alert("Please provide both signatures.");
      return;
    }
    setSaving(true);
    const customerSignature = customerSigCanvas.current
      .getCanvas()
      .toDataURL("image/png");
    const technicianSignature = technicianSigCanvas.current
      .getCanvas()
      .toDataURL("image/png");

    try {
      // Upload customer signature
      const storage = getStorage();
      const customerSignatureRef = ref(
        storage,
        `customerSignatures/${customerData.ticketNum}_${customerData.customerName}.png`
      );
      const customerResponse = await fetch(customerSignature);
      const customerSignatureBlob = await customerResponse.blob();
      await uploadBytes(customerSignatureRef, customerSignatureBlob);
      const customerSignatureUrl = await getDownloadURL(customerSignatureRef);

      // Upload technician signature
      const technicianSignatureRef = ref(
        storage,
        `technicianSignatures/${customerData.ticketNum}_${customerData.customerName}.png`
      );
      const technicianResponse = await fetch(technicianSignature);
      const technicianSignatureBlob = await technicianResponse.blob();
      await uploadBytes(technicianSignatureRef, technicianSignatureBlob);
      const technicianSignatureUrl = await getDownloadURL(
        technicianSignatureRef
      );

      // Create a temporary container for rendering
      const tempDiv = document.createElement("div");
      tempDiv.style.width = "800px";
      tempDiv.style.background = "#fff";
      tempDiv.style.padding = "24px";
      tempDiv.style.direction = "rtl";
      tempDiv.style.textAlign = "right";
      tempDiv.innerHTML = contractHtml;

      // Inject both signatures
      const injectSignature = (sectionId, signature, label) => {
        const section = tempDiv.querySelector(sectionId);
        if (section) {
          const img = document.createElement("img");
          img.src = signature;
          img.alt = label;
          img.style.maxWidth = "150px";
          img.style.height = "50px";
          img.style.display = "block";
          img.style.margin = "8px 0 0 auto";
          img.style.float = "left";
          section.appendChild(img);
        }
      };
      injectSignature(
        "#customer-signature-section",
        customerSignature,
        "Customer Signature"
      );
      injectSignature(
        "#technician-signature-section",
        technicianSignature,
        "Technician Signature"
      );

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

      // Save PDF to blob
      const pdfBlob = pdf.output("blob");

      // Upload PDF to Firebase Storage
      const contractRef = ref(
        storage,
        `contracts/${customerData.ticketNum}_${customerData.customerName}_contract.pdf`
      );
      await uploadBytes(contractRef, pdfBlob);
      const contractUrl = await getDownloadURL(contractRef);

      await onSign(contractUrl, customerSignatureUrl, technicianSignatureUrl);
    } catch (err) {
      alert("Failed to generate or upload contract PDF or signatures.");
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
        <div
          className="contract-signature-section"
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "32px",
            justifyContent: "center",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div className="contract-signature-box" style={{ flex: 1 }}>
            <SignatureCanvas
              ref={technicianSigCanvas}
              penColor="#222"
              canvasProps={{
                width: 300,
                height: 100,
                className: "contract-signature-canvas",
              }}
              onBegin={() => setHasDrawnTechnician(true)}
            />
            <div className="contract-sign-label">
              Technician Signature / توقيع الفني
            </div>
            <button
              className="contract-clear-btn"
              type="button"
              onClick={handleClearTechnician}
              style={{ marginTop: 8 }}
            >
              Clear
            </button>
          </div>
          <div className="contract-signature-box" style={{ flex: 1 }}>
            <SignatureCanvas
              ref={customerSigCanvas}
              penColor="#222"
              canvasProps={{
                width: 300,
                height: 100,
                className: "contract-signature-canvas",
              }}
              onBegin={() => setHasDrawnCustomer(true)}
            />
            <div className="contract-sign-label">
              Customer Signature / توقيع العميل
            </div>
            <button
              className="contract-clear-btn"
              type="button"
              onClick={handleClearCustomer}
              style={{ marginTop: 8 }}
            >
              Clear
            </button>
          </div>
        </div>
        <div
          className="contract-sign-info"
          style={{ marginBottom: "16px", textAlign: "center" }}
        >
          <div>Full Name: {customerData.customerName}</div>
          <div>Date: {new Date().toLocaleDateString("en-GB")}</div>
        </div>
        <button
          className="contract-sign-btn"
          onClick={handleAccept}
          disabled={!hasDrawnCustomer || !hasDrawnTechnician || saving}
        >
          {saving ? "Saving..." : "Accept & Save"}
        </button>
      </div>
    </Modal>
  );
};

export default CustomerContractModal;
