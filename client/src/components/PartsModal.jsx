// PartsModal.jsx
import React, { useRef, useState, useEffect } from "react";
import Modal from "react-modal";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "./PartsModal.css";

Modal.setAppElement("#root");

const PartsModal = ({ isOpen, onClose, ticket }) => {
  const [partNumber, setPartNumber] = useState("");
  const [newSN, setNewSN] = useState("");
  const [oldSN, setOldSN] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState(
    "Apple limited warranty"
  );
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [service, setService] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [customServiceType, setCustomServiceType] = useState("");
  const [partsList, setPartsList] = useState([]);
  const [migrationAvailable, setMigrationAvailable] = useState(false);
  const [originalOldData, setOriginalOldData] = useState(null);

  useEffect(() => {
    const fetchDeliveryNote = async () => {
      if (ticket?.partDeliveryNote) {
        console.log("Fetching delivery note:", ticket.partDeliveryNote);
        try {
          const noteRef = doc(
            db,
            "partsDeliveryNotes",
            ticket.partDeliveryNote
          );
          const noteSnap = await getDoc(noteRef);
          if (noteSnap.exists()) {
            const data = noteSnap.data();

            // Check if data has the new parts format
            if (data.parts && data.parts.length > 0) {
              setPartsList(data.parts);
              setMigrationAvailable(false);
            }
            // Check if data has the old array format and migrate it
            else if (
              data.partNumbers ||
              data.partDescriptions ||
              data.newSerialNumber
            ) {
              console.log("Old format detected, migrating data...");
              setOriginalOldData(data); // Store original data for potential re-migration
              setMigrationAvailable(true);

              const migratedParts = migrateOldFormatToParts(data);
              setPartsList(migratedParts);

              // Save the migrated data back to the database
              if (migratedParts.length > 0) {
                await saveMigratedParts(
                  ticket.partDeliveryNote,
                  data,
                  migratedParts
                );
                setMigrationAvailable(false); // Migration completed
              }
            } else {
              setMigrationAvailable(false);
            }

            console.log("Fetched parts delivery note:", data);
          }
        } catch (err) {
          console.error("Failed to fetch delivery note:", err);
        }
      }
    };
    fetchDeliveryNote();
  }, [ticket]);

  // Migration function to convert old array format to new parts format
  const migrateOldFormatToParts = (oldData) => {
    const migratedParts = [];

    // Get the length of arrays to determine how many parts we have
    const partNumbers = oldData.partNumbers || [];
    const descriptions = oldData.partDescriptions || [];
    const newSerialNumbers = oldData.newSerialNumber || [];
    const oldSerialNumbers = oldData.oldSerialNumber || [];
    const warranties = oldData.warrantyStatus || [];
    const quantities = oldData.qtys || [];
    const prices = oldData.prices || [];
    const services = oldData.services || [];

    // Find the maximum length to handle all parts
    const maxLength = Math.max(
      partNumbers.length,
      descriptions.length,
      newSerialNumbers.length,
      oldSerialNumbers.length,
      warranties.length,
      quantities.length,
      prices.length,
      services.length
    );

    // Create parts entries from the old arrays
    for (let i = 0; i < maxLength; i++) {
      const isService = services[i] && services[i].trim() !== "";

      const part = {
        partNumber: isService ? "" : partNumbers[i] || "",
        newSN: isService ? "" : newSerialNumbers[i] || "",
        oldSN: isService ? "" : oldSerialNumbers[i] || "",
        warrantyStatus: isService
          ? ""
          : warranties[i] || "Apple limited warranty",
        description: descriptions[i] || "",
        quantity: quantities[i] || "1",
        price: prices[i] || "0",
      };

      migratedParts.push(part);
    }

    console.log("Migrated parts:", migratedParts);
    return migratedParts;
  };

  // Function to save migrated data back to database
  const saveMigratedParts = async (docId, originalData, migratedParts) => {
    try {
      const docRef = doc(db, "partsDeliveryNotes", docId);

      // Update with new parts format while preserving original fields
      await updateDoc(docRef, {
        ...originalData,
        parts: migratedParts,
        migratedAt: new Date(), // Add timestamp for migration tracking
      });

      console.log("Successfully migrated and saved parts data");
    } catch (error) {
      console.error("Failed to save migrated parts:", error);
    }
  };

  // Manual migration trigger function
  const handleManualMigration = async () => {
    if (!originalOldData || !ticket?.partDeliveryNote) {
      alert("No old data available for migration");
      return;
    }

    try {
      const migratedParts = migrateOldFormatToParts(originalOldData);
      setPartsList(migratedParts);

      if (migratedParts.length > 0) {
        await saveMigratedParts(
          ticket.partDeliveryNote,
          originalOldData,
          migratedParts
        );
        setMigrationAvailable(false);
        alert("Data migration completed successfully!");
      }
    } catch (error) {
      console.error("Manual migration failed:", error);
      alert("Migration failed. Please try again.");
    }
  };

  const handleApply = () => {
    const newPart = {
      partNumber: service ? "" : partNumber,
      newSN: service ? "" : newSN,
      oldSN: service ? "" : oldSN,
      warrantyStatus: service ? "" : warrantyStatus,
      description: service
        ? serviceType === "Other"
          ? customServiceType
          : serviceType
        : description,
      quantity: quantity || "1", // Default to "1" if empty
      price: price || "0", // Default to "0" if empty
    };
    setPartsList([...partsList, newPart]);
    setPartNumber("");
    setNewSN("");
    setOldSN("");
    setWarrantyStatus("Apple limited warranty");
    setDescription("");
    setQuantity("");
    setPrice("");
    setService(false);
    setServiceType(""); // Reset service type
    setCustomServiceType(""); // Reset custom service type
  };

  const handleDeletePart = (indexToDelete) => {
    const updatedParts = partsList.filter(
      (_, index) => index !== indexToDelete
    );
    setPartsList(updatedParts);
  };

  const handleSave = async () => {
    if (!ticket) return;
    try {
      // Create custom document ID: PDN + location + ticketNum + customerName + timestamp
      const timestamp = new Date().getTime();
      const sanitizedCustomerName = ticket.customerName.replace(
        /[^a-zA-Z0-9]/g,
        ""
      ); // Remove special characters
      const customDocId = `PDN${ticket.location}${ticket.ticketNum}${sanitizedCustomerName}${timestamp}`;

      const docRef = doc(db, "partsDeliveryNotes", customDocId);
      await setDoc(docRef, {
        ticketId: ticket.id,
        ticketNum: ticket.ticketNum,
        customerName: ticket.customerName,
        machineType: ticket.machineType,
        serialNumber: ticket.serialNum,
        warrantyStatus: ticket.warrantyStatus,
        technician: ticket.technician || "",
        symptom: ticket.symptom,
        createdAt: new Date(),
        parts: partsList,
      });

      await updateDoc(doc(db, "tickets", ticket.id), {
        partDeliveryNote: customDocId,
      });

      alert("Parts delivery note saved successfully.");
      onClose();
    } catch (err) {
      console.error("Failed to save parts delivery note:", err);
      alert("Failed to save parts delivery note.");
    }
  };

  const today = new Date().toLocaleDateString();

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="right-modal"
      overlayClassName="modal-overlay"
    >
      <button className="modal-close-button" onClick={onClose}>
        ×
      </button>

      <div className="modal-form">
        <label>Part#:</label>
        <input
          type="text"
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          placeholder="Enter Part#"
          disabled={service}
        />

        <label>New SN:</label>
        <input
          type="text"
          value={newSN}
          onChange={(e) => setNewSN(e.target.value)}
          placeholder="Enter New SN"
          disabled={service}
        />

        <label>Old SN:</label>
        <input
          type="text"
          value={oldSN}
          onChange={(e) => setOldSN(e.target.value)}
          placeholder="Enter Old SN"
          disabled={service}
        />

        <label>Warranty Status:</label>
        <select
          value={warrantyStatus}
          onChange={(e) => setWarrantyStatus(e.target.value)}
          disabled={service}
        >
          <option>Apple limited warranty</option>
          <option>Out of warranty</option>
          <option>CS code</option>
          <option>Quality program</option>
        </select>

        <label>Part Description:</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter Description"
          disabled={service}
        />

        <label>Quantity:</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Enter Quantity"
        />

        <label>Price:</label>
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Enter Price"
        />

        <div className="service-section">
          <div className="service-row">
            <label className="service-checkbox">
              <input
                type="checkbox"
                checked={service}
                onChange={(e) => setService(e.target.checked)}
              />
              Service
            </label>

            {service && (
              <div className="service-type-select">
                <label>Service Type:</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="">Select Service Type</option>
                  <option value="Software">Software</option>
                  <option value="Upgrade system">Upgrade system</option>
                  <option value="Transfer data">Transfer data</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Miss use">Miss use</option>
                  <option value="NTF">NTF</option>
                  <option value="Other">Other</option>
                </select>
                {serviceType === "Other" && (
                  <input
                    type="text"
                    value={customServiceType}
                    onChange={(e) => setCustomServiceType(e.target.value)}
                    placeholder="Enter custom service"
                    className="custom-service-input"
                  />
                )}
              </div>
            )}
          </div>

          <button onClick={handleApply} className="apply-button">
            Apply
          </button>
        </div>
      </div>

      <div className="delivery-header">
        <div className="logo-section">
          <img src="/path/to/your/logo.png" alt="Logo" className="logo-img" />
          <h2>Delivery Note</h2>
          <div className="underline"></div>
        </div>
        <div className="delivery-details">
          <div className="left">
            <p>
              <strong>Delivery Date:</strong> {today}
            </p>
            <p>
              <strong>Customer Name:</strong> {ticket?.customerName}
            </p>
            <p>
              <strong>Invoice #:</strong> {ticket?.ticketNum}
            </p>
            <p>
              <strong>Product Type:</strong> {ticket?.machineType}
            </p>
            <p>
              <strong>Repair ID:</strong> {ticket?.id}
            </p>
          </div>
          <div className="right">
            <p>
              <strong>Serial Number:</strong> {ticket?.serialNum}
            </p>
            <p>
              <strong>Device Issue:</strong> {ticket?.symptom}
            </p>
            <p>
              <strong>Warranty Status:</strong> {ticket?.warrantyStatus || ""}
            </p>
            <p>
              <strong>Technician:</strong> {ticket?.technician || ""}
            </p>
            <p>
              <strong>Tech ID:</strong>
            </p>
          </div>
        </div>
      </div>

      <table className="delivery-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th>Part #</th>
            <th>Old Serial #</th>
            <th>New Serial #</th>
            <th>Quantity</th>
            <th>Warranty Status</th>
          </tr>
        </thead>
        <tbody>
          {partsList.map((part, idx) => (
            <tr key={idx}>
              <td>{part.description}</td>
              <td>{part.partNumber}</td>
              <td>{part.oldSN}</td>
              <td>{part.newSN}</td>
              <td>{part.quantity}</td>
              <td>{part.warrantyStatus}</td>
              <td>
                <button
                  className="delete-part-button"
                  onClick={() => handleDeletePart(idx)}
                  title="Delete part"
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="modal-actions">
        {migrationAvailable && (
          <button
            className="migration-button"
            onClick={handleManualMigration}
            title="Migrate old data format to new parts structure"
          >
            🔄 Migrate Old Data
          </button>
        )}
        <button className="save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </Modal>
  );
};

export default PartsModal;
