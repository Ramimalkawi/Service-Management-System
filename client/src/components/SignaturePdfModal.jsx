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
  issuedBy,
  ticketNum,
  onComplete,
  pdfFile,
}) => {
  const sigCanvasCustomer = useRef();
  const sigCanvasTechnician = useRef();
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
    // if (sigCanvas.current.isEmpty()) {
    //   alert("Please provide a signature.");
    //   return;
    // }

    setIsSaving(true);

    let canvas;
    try {
      canvas = sigCanvasCustomer.current.getTrimmedCanvas();
    } catch (e) {
      console.warn("getTrimmedCanvas failed, falling back to getCanvas");
      canvas = sigCanvasCustomer.current.getCanvas();
    }

    let canvas2;
    try {
      canvas2 = sigCanvasTechnician.current.getTrimmedCanvas();
    } catch (e) {
      console.warn("getTrimmedCanvas failed, falling back to getCanvas");
      canvas2 = sigCanvasTechnician.current.getCanvas();
    }

    try {
      // Save signature image to Firebase Storage
      const sigBlob = await new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png")
      );

      const sigBlobTechnician = await new Promise((resolve) =>
        canvas2.toBlob((blob) => resolve(blob), "image/png")
      );

      const storage = getStorage();
      const sigRef = ref(
        storage,
        `customersignatures/${customerData.location}${ticketNum}_${customerData.customerName}.png`
      );
      await uploadBytes(sigRef, sigBlob);
      const customerSignatureURL = await getDownloadURL(sigRef);

      // Prepare PDF with signature
      const sigArrayBuffer = await sigBlob.arrayBuffer();
      const sigArrayBufferTechnician = await sigBlobTechnician.arrayBuffer();
      const response = await fetch(pdfFile);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Draw signature on the last page of the original PDF
      const sigImage = await pdfDoc.embedPng(sigArrayBuffer);
      const totalPages = pdfDoc.getPageCount();
      const lastPage = pdfDoc.getPage(totalPages - 1);
      const { width: lastPageWidth, height: lastPageHeight } =
        lastPage.getSize();
      // Place signature at the bottom center of the last page
      const sigWidth = 70;
      const sigHeight = 35;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      lastPage.drawImage(sigImage, {
        x: 300,
        y: 40,
        width: sigWidth,
        height: sigHeight,
      });

      lastPage.drawText(`${customerData.customerName}`, {
        x: 485,
        y: 50,
        size: 8,
        font,
      });

      lastPage.drawImage(sigImage, {
        x: 240,
        y: 50,
        width: sigWidth,
        height: sigHeight,
      });

      lastPage.drawText(`${customerData.customerName}`, {
        x: 45,
        y: 65,
        size: 8,
        font,
      });

      // Create a new page for the signature and info (as before)
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();

      const sigImageTech = await pdfDoc.embedPng(sigArrayBufferTechnician);
      const leftX = 40;
      const rightX = width / 2 + 20;

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
        x: leftX + 100,
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

      y -= lineHeight;
      y -= lineHeight;

      page.drawText(`Customer Signature:`, { x: leftX, y, size: 12, font });
      y -= 5;
      page.drawImage(sigImage, {
        x: leftX + 110,
        y,
        width: sigWidth,
        height: sigHeight,
      });

      // Draw a dotted line under the signature
      const lineY = y - 5; // 5 units below the signature
      const startX = leftX + 110;
      const endX = leftX + 110 + sigWidth;
      const dotSpacing = 3;
      const dotLength = 1;
      for (let x = startX; x < endX; x += dotSpacing) {
        page.drawLine({
          start: { x, y: lineY },
          end: { x: Math.min(x + dotLength, endX), y: lineY },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
      }

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
      page.drawText(`${issuedBy}`, {
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
      y -= lineHeight;
      page.drawText(`Technician Signature:`, { x: rightX, y, size: 12, font });
      y -= 5;
      page.drawImage(sigImageTech, {
        x: rightX + 110,
        y,
        width: sigWidth,
        height: sigHeight,
      });
      // Draw a dotted line under the signature
      const lineYTech = y - 5; // 5 units below the signature
      const startXTech = rightX + 115;
      const endXTech = rightX + 115 + sigWidth;
      for (let x = startXTech; x < endXTech; x += dotSpacing) {
        page.drawLine({
          start: { x, y: lineYTech },
          end: { x: Math.min(x + dotLength, endXTech), y: lineYTech },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
      }

      const finalPdfBytes = await pdfDoc.save();
      const finalPdfBlob = new Blob([finalPdfBytes], {
        type: "application/octec-stream",
      });

      const contractRef = ref(
        storage,
        `testcontracts/Contract${customerData.location}${ticketNum}${customerData.customerName}.pdf`
      );

      await uploadBytes(contractRef, finalPdfBlob);

      const contractURL = await getDownloadURL(contractRef);
      // Pass both contractURL and customerSignatureURL to onComplete
      onComplete(contractURL, customerSignatureURL);
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

      <div className="signature-area">
        <div>
          <p>Customer Signature:</p>
          <div className="signature-wrapper">
            {!hasDrawn && <div className="sig-placeholder">Sign here</div>}
            <SignatureCanvas
              ref={sigCanvasCustomer}
              onBegin={() => setHasDrawn(true)}
              penColor="black"
              canvasProps={{
                width: 300,
                height: 100,

                style: {
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  background: "#fff",
                },
              }}
            />
          </div>
          <div className="modal-buttons">
            <button
              onClick={() => {
                sigCanvasCustomer.current.clear();
                setHasDrawn(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <div>
          <p>Technician Signature:</p>
          <div className="signature-wrapper">
            {!hasDrawn && <div className="sig-placeholder">Sign here</div>}
            <SignatureCanvas
              ref={sigCanvasTechnician}
              penColor="black"
              canvasProps={{
                width: 300,
                height: 100,

                style: {
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  background: "#fff",
                },
              }}
            />
          </div>
          <div className="modal-buttons">
            <button
              onClick={() => {
                sigCanvasTechnician.current.clear();
                setHasDrawn(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <div className="modal-buttons">
        {/* <button
          onClick={() => {
            sigCanvasCustomer.current.clear();
            setHasDrawn(false);
          }}
        >
          Clear
        </button> */}
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
