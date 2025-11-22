import React, { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./SignatureRefundModal.css";

const SignatureRefundModal = ({
  invoiceId,
  refundIndex,
  onClose,
  onSignatureSave,
}) => {
  const sigCanvas = useRef({});

  const clear = () => {
    sigCanvas.current.clear();
  };

  const save = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature first.");
      return;
    }

    const signatureImage = sigCanvas.current.getCanvas().toDataURL("image/png");

    const storage = getStorage();
    const storageRef = ref(
      storage,
      `refundSignatures/${invoiceId}_${refundIndex}.png`
    );

    try {
      console.log("storageRef: ", storageRef);
      await uploadString(storageRef, signatureImage, "data_url");
      const downloadURL = await getDownloadURL(storageRef);

      // // Update the refund record in Firestore with the signature URL
      // const invoiceRef = doc(db, "modernInvoices", invoiceId);
      // const invoiceSnap = await getDoc(invoiceRef);
      // if (!invoiceSnap.exists()) {
      //   throw new Error("Invoice not found");
      // }
      // const invoiceData = invoiceSnap.data();
      // const refunds = invoiceData.refunds || [];
      // if (refundIndex < 0 || refundIndex >= refunds.length) {
      //   throw new Error("Invalid refund index");
      // }

      // refunds[refundIndex].signatureUrl = downloadURL;

      // await updateDoc(invoiceRef, { refunds });

      onSignatureSave(downloadURL);
      onClose();
    } catch (error) {
      console.error("Error uploading signature: ", error);
      alert("Failed to save signature. Please try again.");
    }
  };

  return (
    <div className="signature-modal-overlay">
      <div className="signature-modal-content">
        <h3>Customer Signature</h3>
        <div className="signature-pad-container">
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{ className: "signature-canvas" }}
          />
        </div>
        <div className="signature-modal-actions">
          <button onClick={clear} className="btn-clear">
            Clear
          </button>
          <button onClick={save} className="btn-save">
            Save Signature
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureRefundModal;
