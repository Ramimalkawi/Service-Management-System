import React, { useState } from "react";
import "../pages/ProcessTicketPage.css";

const statusMap = {
  0: "Start",
  1: "VMI Troubleshooting",
  2: "Repair Released from Processing",
  3: "Awaiting Parts",
  4: "Parts Allocated",
  5: "In Repair",
  6: "Ready For Pickup",
  7: "Repair Marked Complete",
};

export default function TicketStatusTimeline({
  states,
  details,
  isEditable,
  onUpdateDetail,
}) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleEditClick = (idx) => {
    setEditingIdx(idx);
    setEditValue(details && details[idx] ? details[idx] : "");
    setShowModal(true);
  };

  const handleModalOk = () => {
    if (editValue !== details[editingIdx]) {
      onUpdateDetail(editingIdx, editValue);
    }
    setShowModal(false);
    setEditingIdx(null);
    setEditValue("");
  };

  const handleModalCancel = () => {
    setShowModal(false);
    setEditingIdx(null);
    setEditValue("");
  };

  return (
    <>
      <ul
        className="status-timeline"
        style={{ marginBottom: 20, width: "300px" }}
      >
        {states.map((statusCode, idx) => {
          const canEdit = isEditable;
          return (
            <li key={idx} className="status-step">
              <span style={{ fontWeight: "bold" }}>
                {statusMap[statusCode] || `Repair Marked Complete`}
              </span>
              <div className="status-detail">
                <div
                  style={{
                    margin: 2,
                    backgroundColor:
                      details && details[idx] ? "#f9f9f9" : "#fff0f0",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border:
                      details && details[idx]
                        ? "1px solid #eee"
                        : "1px solid #e57373",
                    cursor: canEdit ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onClick={() => {
                    if (canEdit) {
                      handleEditClick(idx);
                    }
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {details && details[idx] ? (
                      typeof details[idx] === "string" ? (
                        details[idx]
                      ) : (
                        JSON.stringify(details[idx], null, 2)
                      )
                    ) : (
                      <em>No detail available</em>
                    )}
                  </span>
                  {canEdit && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ marginLeft: 4, opacity: 0.7 }}
                    >
                      <path
                        d="M14.85 2.85a1.2 1.2 0 0 1 1.7 1.7l-9.2 9.2-2.1.4.4-2.1 9.2-9.2Zm2.12-2.12a3.2 3.2 0 0 0-4.53 0l-9.2 9.2A2 2 0 0 0 2 11.13l-.7 3.7a1 1 0 0 0 1.17 1.17l3.7-.7a2 2 0 0 0 1.13-.53l9.2-9.2a3.2 3.2 0 0 0 0-4.53Z"
                        fill="#1ccad4"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={handleModalCancel}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <label style={{ fontWeight: "bold" }}>
              Edit Detail for:{" "}
              {statusMap[states[editingIdx]] || "Unknown Status"}
            </label>
            <textarea
              type="text"
              value={editValue}
              autoFocus
              rows={4}
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid #1ccad4",
                fontSize: 16,
                resize: "vertical",
              }}
              onChange={(e) => setEditValue(e.target.value)}
            />

            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                style={{
                  padding: "6px 18px",
                  background: "#1ccad4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
                onClick={handleModalOk}
              >
                OK
              </button>
              <button
                style={{
                  padding: "6px 18px",
                  background: "#eee",
                  color: "#333",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
                onClick={handleModalCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
