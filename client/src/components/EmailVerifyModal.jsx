import React, { useState } from "react";
import Modal from "react-modal";

const EmailVerifyModal = ({
  isOpen,
  onClose,
  email,
  onSendCode,
  onVerify,
  loading,
  error,
}) => {
  const [inputEmail, setInputEmail] = useState(email || "");
  const [codeSent, setCodeSent] = useState(false);
  const [inputCode, setInputCode] = useState("");

  React.useEffect(() => {
    setInputEmail(email || "");
    setCodeSent(false);
    setInputCode("");
  }, [email, isOpen]);

  const handleSendCode = async () => {
    await onSendCode(inputEmail);
    setCodeSent(true);
  };

  const handleVerify = () => {
    onVerify(inputCode);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Verify Customer Email"
      ariaHideApp={false}
      style={{
        content: {
          maxWidth: 400,
          margin: "auto",
          padding: 24,
          borderRadius: 8,
          textAlign: "center",
        },
      }}
    >
      <h2>Verify Customer Email</h2>
      <p>Please confirm the customer's email address before proceeding.</p>
      <input
        type="email"
        value={inputEmail}
        onChange={(e) => setInputEmail(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 16,
          borderRadius: 4,
          border: "1px solid #ccc",
        }}
        placeholder="Enter customer email"
        disabled={codeSent}
      />
      {!codeSent ? (
        <button
          onClick={handleSendCode}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            width: "100%",
          }}
          disabled={
            !inputEmail ||
            !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inputEmail) ||
            loading
          }
        >
          {loading ? "Sending..." : "Send Verification Code"}
        </button>
      ) : (
        <>
          <input
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              margin: "16px 0",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
            placeholder="Enter 6-digit code"
            maxLength={6}
          />
          <button
            onClick={handleVerify}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              width: "100%",
            }}
            disabled={inputCode.length !== 6 || loading}
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </>
      )}
      {error && <div style={{ color: "#e53935", marginTop: 12 }}>{error}</div>}
      <button
        onClick={onClose}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          borderRadius: 4,
          border: "none",
          background: "#eee",
        }}
      >
        Cancel
      </button>
    </Modal>
  );
};

export default EmailVerifyModal;
