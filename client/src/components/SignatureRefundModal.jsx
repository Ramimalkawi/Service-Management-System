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
  ticketId,
  refundId,
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
      `refundSignatures/${ticketId}_${refundId}.png`
    );

    try {
      await uploadString(storageRef, signatureImage, "data_url");
      const downloadURL = await getDownloadURL(storageRef);

      const refundRef = doc(db, "tickets", ticketId, "refunds", refundId);
      await updateDoc(refundRef, {
        signatureUrl: downloadURL,
      });

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
