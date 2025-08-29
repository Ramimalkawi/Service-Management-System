// SignaturePdfModal.jsx
import React, { useRef, useState, useEffect } from "react";
import Modal from "react-modal";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "./SignaturePdfModal.css";

// Set the worker source to the correct path
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

Modal.setAppElement("#root");

const SignaturePdfModal = ({
  isOpen,
  onClose,
  customerData,
  ticketNum,
  onComplete,
  pdfFile,
}) => {
  const sigCanvas = useRef();
  const [numPages, setNumPages] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error) => {
    console.error("PDF load error:", error);
  };

  const handleAccept = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature.");
      return;
    }

    setIsSaving(true);

    let canvas;
    try {
      canvas = sigCanvas.current.getTrimmedCanvas();
    } catch (e) {
      console.warn("getTrimmedCanvas failed, falling back to getCanvas");
      canvas = sigCanvas.current.getCanvas();
    }

    try {
      const sigBlob = await new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png")
      );
      const sigArrayBuffer = await sigBlob.arrayBuffer();

      // Load the original PDF
      const response = await fetch(pdfFile);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Create a new page for the signature and info
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();

      const sigImage = await pdfDoc.embedPng(sigArrayBuffer);
      page.drawImage(sigImage, {
        x: 50,
        y: height - 250,
        width: 200,
        height: 100,
      });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const leftX = 50;
      const rightX = width / 2 + 10;
      let y = height - 100;
      const lineHeight = 18;

      // Left Column
      page.drawText(`Ticket#:`, {
        x: leftX,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`${customerData.location}${ticketNum}`, {
        x: leftX + 70,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Contact Name:`, { x: leftX, y, size: 12, font });
      page.drawText(`${customerData.customerName}`, {
        x: leftX + 100,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Company Name:`, { x: leftX, y, size: 12, font });
      page.drawText(`${customerData.companyName || ""}`, {
        x: leftX + 100,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Contact Mobile:`, { x: leftX, y, size: 12, font });
      page.drawText(`${customerData.mobileNumber}`, {
        x: leftX + 100,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Contact Email:`, { x: leftX, y, size: 12, font });
      page.drawText(`${customerData.emailAddress}`, {
        x: leftX + 100,
        y,
        size: 12,
        font,
      });

      // Right Column reset
      y = height - 100;
      page.drawText(`Date and time:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.date}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Issued By:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.issuedBy}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Serial Number:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.serialNum}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Device Type:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.machineType}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Description:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.deviceDescription}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Symptom:`, { x: rightX, y, size: 12, font });
      page.drawText(`${customerData.symptom}`, {
        x: rightX + 110,
        y,
        size: 12,
        font,
      });

      const finalPdfBytes = await pdfDoc.save();
      const finalPdfBlob = new Blob([finalPdfBytes], {
        type: "application/octec-stream",
      });

      const storage = getStorage();
      const contractRef = ref(
        storage,
        `testcontracts/Contract${customerData.location}${ticketNum}${customerData.customerName}.pdf`
      );

      const formattedDate = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      await uploadBytes(contractRef, finalPdfBlob);
      const contractURL = `testcontracts/Contract${customerData.location}${ticketNum}${customerData.customerName}.pdf`;

      onComplete(contractURL);
      onClose();
    } catch (error) {
      console.error("Failed to save signed PDF:", error);
      alert("Something went wrong while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="signature-modal"
      overlayClassName="modal-overlay"
    >
      <h2>Terms & Conditions</h2>
      <div className="pdf-preview">
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div>Loading PDF...</div>}
          error={
            <div>Failed to load PDF. Please check console for details.</div>
          }
        >
          {numPages &&
            Array.from(new Array(numPages), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            ))}
        </Document>
        {!numPages && <div>Waiting for PDF to load...</div>}
      </div>

      <div className="signature-box">
        <p>Sign below to agree:</p>
        <div className="signature-wrapper">
          {!hasDrawn && <div className="sig-placeholder">Sign here</div>}
          <SignatureCanvas
            ref={sigCanvas}
            onBegin={() => setHasDrawn(true)}
            penColor="black"
            canvasProps={{
              width: 300,
              height: 100,
              className: "sig-canvas",
            }}
          />
        </div>
      </div>
      <div className="modal-buttons">
        <button
          onClick={() => {
            sigCanvas.current.clear();
            setHasDrawn(false);
          }}
        >
          Clear
        </button>
        <button onClick={handleAccept} disabled={isSaving}>
          {isSaving ? (
            <>
              <span className="spinner" />
              Saving...
            </>
          ) : (
            "Accept & Continue"
          )}
        </button>
      </div>
    </Modal>
  );
};

export default SignaturePdfModal;
