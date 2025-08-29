import React, { useRef } from "react";
import Modal from "react-modal";
import SignatureCanvas from "react-signature-canvas";
import "./SignatureModal.css";

Modal.setAppElement("#root"); // or your app’s root element

const SignatureModal = ({ isOpen, onClose, onAccept }) => {
  const sigCanvas = useRef();

  const handleClear = () => {
    sigCanvas.current.clear();
  };

  const handleAccept = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature.");
      return;
    }

    // Convert signature to image blob
    // const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
    const dataURL = sigCanvas.current.getCanvas().toDataURL("image/png");
    // Convert to Blob
    const blob = await (await fetch(dataURL)).blob();

    onAccept(blob); // pass the signature blob to parent
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="signature-modal"
      overlayClassName="modal-overlay"
    >
      <h2>Terms & Conditions</h2>
      <p>Please sign below to agree before creating your ticket:</p>

      <div className="signature-box">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{ width: 500, height: 200, className: "sig-canvas" }}
        />
      </div>

      <div className="modal-buttons">
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleAccept}>Accept & Continue</button>
      </div>
    </Modal>
  );
};

export default SignatureModal;
