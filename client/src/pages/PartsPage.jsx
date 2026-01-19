import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../components/PartsModal.css";
import { useUser } from "../context/userContext";
import PriceQuotationModal from "../components/PriceQuotationModal";

const PartsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { technician } = useUser();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuotationPrompt, setShowQuotationPrompt] = useState(false);
  const [partNumber, setPartNumber] = useState("");
  const [newSN, setNewSN] = useState("");
  const [oldSN, setOldSN] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState(
    "Apple limited warranty",
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
  const [editIndex, setEditIndex] = useState(null);
  const [isPriceQuotationModalOpen, setIsPriceQuotationModalOpen] =
    useState(false);
  const [pendingQuotationPart, setPendingQuotationPart] = useState(null);

  const fetchTicket = useCallback(async () => {
    try {
      const docRef = doc(db, "tickets", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTicket({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Ticket not found.");
        navigate("/tickets");
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
      alert("Failed to load ticket data.");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    const fetchDeliveryNote = async () => {
      if (!ticket) {
        return;
      }
      if (!ticket.partDeliveryNote) {
        setPartsList([]);
        setMigrationAvailable(false);
        setOriginalOldData(null);
        return;
      }
      try {
        const noteRef = doc(db, "partsDeliveryNotes", ticket.partDeliveryNote);
        const noteSnap = await getDoc(noteRef);
        if (noteSnap.exists()) {
          const data = noteSnap.data();
          if (Array.isArray(data.parts) && data.parts.length > 0) {
            setPartsList(data.parts);
            setMigrationAvailable(false);
          } else if (
            data.partNumbers ||
            data.partDescriptions ||
            data.newSerialNumber
          ) {
            setOriginalOldData(data);
            setMigrationAvailable(true);
            const migratedParts = migrateOldFormatToParts(data);
            setPartsList(migratedParts);
            if (migratedParts.length > 0) {
              await saveMigratedParts(
                ticket.partDeliveryNote,
                data,
                migratedParts,
              );
              setMigrationAvailable(false);
            }
          } else {
            setPartsList([]);
            setMigrationAvailable(false);
          }
        } else {
          setPartsList([]);
          setMigrationAvailable(false);
        }
      } catch (err) {
        console.error("Failed to fetch delivery note:", err);
        alert("Failed to load parts delivery note.");
      }
    };

    fetchDeliveryNote();
  }, [ticket]);

  const migrateOldFormatToParts = (oldData) => {
    const migratedParts = [];
    const partNumbers = oldData.partNumbers || [];
    const descriptions = oldData.partDescriptions || [];
    const newSerialNumbers = oldData.newSerialNumber || [];
    const oldSerialNumbers = oldData.oldSerialNumber || [];
    const warranties = oldData.warrantyStatus || [];
    const quantities = oldData.qtys || [];
    const prices = oldData.prices || [];
    const services = oldData.services || [];

    const maxLength = Math.max(
      partNumbers.length,
      descriptions.length,
      newSerialNumbers.length,
      oldSerialNumbers.length,
      warranties.length,
      quantities.length,
      prices.length,
      services.length,
    );

    for (let i = 0; i < maxLength; i += 1) {
      const isService = services[i] && services[i].trim() !== "";
      migratedParts.push({
        partNumber: isService ? "" : partNumbers[i] || "",
        newSN: isService ? "" : newSerialNumbers[i] || "",
        oldSN: isService ? "" : oldSerialNumbers[i] || "",
        warrantyStatus: isService
          ? ""
          : warranties[i] || "Apple limited warranty",
        description:
          descriptions[i] === ">" ? "Service" : descriptions[i] || "",
        quantity: quantities[i] || "1",
        price: prices[i] || "0",
      });
    }

    return migratedParts;
  };

  const saveMigratedParts = async (docId, originalData, migratedParts) => {
    try {
      const docRef = doc(db, "partsDeliveryNotes", docId);
      await updateDoc(docRef, {
        ...originalData,
        parts: migratedParts,
        migratedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to save migrated parts:", error);
    }
  };

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
          migratedParts,
        );
        setMigrationAvailable(false);
        alert("Data migration completed successfully!");
      }
    } catch (error) {
      console.error("Manual migration failed:", error);
      alert("Migration failed. Please try again.");
    }
  };

  const resetForm = () => {
    setPartNumber("");
    setNewSN("");
    setOldSN("");
    setWarrantyStatus("Apple limited warranty");
    setDescription("");
    setQuantity("");
    setPrice("");
    setService(false);
    setServiceType("");
    setCustomServiceType("");
    setEditIndex(null);
  };

  const handleApply = () => {
    if (price && Number(price) > 0 && (!ticket || !ticket.priceQuotationRef)) {
      setShowQuotationPrompt(true);
      return;
    }

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
      quantity: quantity || "1",
      price: price || "0",
    };

    if (editIndex !== null) {
      setPartsList(
        partsList.map((part, idx) => (idx === editIndex ? newPart : part)),
      );
    } else {
      setPartsList([...partsList, newPart]);
    }

    resetForm();
  };

  const handleEditPart = (idx) => {
    const part = partsList[idx];
    setEditIndex(idx);
    setPartNumber(part.partNumber || "");
    setNewSN(part.newSN || "");
    setOldSN(part.oldSN || "");
    setWarrantyStatus(part.warrantyStatus || "Apple limited warranty");
    setDescription(part.description || "");
    setQuantity(part.quantity || "");
    setPrice(part.price || "");

    const isService =
      !part.partNumber && !part.newSN && !part.oldSN && !part.warrantyStatus;
    setService(isService);
    if (isService) {
      const predefined = [
        "Software",
        "Upgrade system",
        "Transfer data",
        "Cleaning",
        "Miss use",
        "NTF",
      ];
      setServiceType(
        predefined.includes(part.description) ? part.description : "Other",
      );
      setCustomServiceType(
        predefined.includes(part.description) ? "" : part.description || "",
      );
    } else {
      setServiceType("");
      setCustomServiceType("");
    }
  };

  const handleDeletePart = (indexToDelete) => {
    setPartsList(partsList.filter((_, index) => index !== indexToDelete));
    if (editIndex === indexToDelete) {
      resetForm();
    }
  };

  const closePriceQuotationModal = () => {
    setIsPriceQuotationModalOpen(false);
    setPendingQuotationPart(null);
    fetchTicket();
  };

  const handleSave = async () => {
    if (!ticket) {
      return;
    }

    try {
      const timestamp = new Date().getTime();
      const sanitizedCustomerName = (ticket.customerName || "").replace(
        /[^a-zA-Z0-9]/g,
        "",
      );
      const customDocId = `PDN${ticket.location || ""}${ticket.ticketNum || ""}${sanitizedCustomerName}${timestamp}`;

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

      const hasPricedPart = partsList.some((part) => Number(part.price) > 0);
      const allZero = partsList.every((part) => Number(part.price) === 0);

      const ticketUpdates = {
        partDeliveryNote: customDocId,
      };

      if (hasPricedPart) {
        ticketUpdates.shouldHaveInvoice = true;
      } else if (allZero) {
        ticketUpdates.shouldHaveInvoice = false;
      }

      await updateDoc(doc(db, "tickets", ticket.id), ticketUpdates);

      if (hasPricedPart) {
        const formattedDate = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        const invoiceId = `INV${ticket.location || ""}${ticket.ticketNum || ""}`;
        const invoiceRef = doc(db, "modernInvoices", invoiceId);
        const existingInvoice = await getDoc(invoiceRef);

        if (!existingInvoice.exists()) {
          await setDoc(invoiceRef, {
            payments: [],
            customerName: ticket.customerName,
            machineType: ticket.machineType,
            date: formattedDate,
            description: partsList.map((p) => p.description).join(", "),
            emailAddress: ticket.emailAddress || "",
            invoiceStatus: "Pending",
            location: ticket.location || "",
            mobileNumber: ticket.mobileNumber || "",
            parts: partsList,
            ticketNum: Number(ticket.ticketNum),
            ticketId: ticket.id,
          });
          await updateDoc(doc(db, "tickets", ticket.id), {
            invoiceId,
            invoiceStatus: "Pending",
          });
        } else {
          await updateDoc(invoiceRef, {
            parts: partsList,
            description: partsList.map((p) => p.description).join(", "),
          });
          await updateDoc(doc(db, "tickets", ticket.id), {
            invoiceId,
          });
        }
      }

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              ...ticketUpdates,
            }
          : prev,
      );

      alert("Parts delivery note saved successfully.");
      navigate(`/tickets/${ticket.id}/process`);
    } catch (err) {
      console.error("Failed to save parts delivery note:", err);
      alert("Failed to save parts delivery note.");
    }
  };

  const today = new Date().toLocaleDateString();

  if (loading) {
    return <div className="loading">Loading parts...</div>;
  }

  if (!ticket) {
    return <div className="loading">Ticket not found.</div>;
  }

  const pendingPartPayload = {
    partNumber: service ? "" : partNumber,
    description: service
      ? serviceType === "Other"
        ? customServiceType
        : serviceType
      : description,
    quantity: quantity || "1",
    price: price || "0",
  };

  return (
    <div className="parts-page">
      {showQuotationPrompt && (
        <div className="custom-alert-overlay">
          <div className="custom-alert-modal">
            <p style={{ marginBottom: 16 }}>
              <strong>You should create a price quotation.</strong>
              <br />
              A price quotation must be created first.
              <br />
              Do you want to create the price quotation now?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                className="save-button"
                onClick={() => {
                  setShowQuotationPrompt(false);
                  setPendingQuotationPart(pendingPartPayload);
                  setTimeout(() => setIsPriceQuotationModalOpen(true), 200);
                }}
              >
                Create Price Quotation
              </button>
              <button
                className="cancel-edit-button"
                onClick={() => setShowQuotationPrompt(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="parts-page-toolbar">
        <button
          className="back-button"
          onClick={() => navigate(`/tickets/${id}/process`)}
        >
          ← Back to Ticket
        </button>
        <div className="parts-page-title">
          <h2>Parts Management</h2>
          <p>
            Ticket {ticket.location}
            {ticket.ticketNum} · {ticket.customerName}
          </p>
        </div>
        <button
          className="outline-button"
          onClick={() => navigate(`/tickets/${id}/price-quotation`)}
        >
          Price Quotation
        </button>
      </div>

      <div className="parts-page-card">
        <div className="modal-form">
          <div className="modal-form-fields">
            <div>
              <label>Part#:</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="Enter Part#"
                disabled={service}
              />
            </div>
            <div>
              <label>New SN:</label>
              <input
                type="text"
                value={newSN}
                onChange={(e) => setNewSN(e.target.value)}
                placeholder="Enter New SN"
                disabled={service}
              />
            </div>
            <div>
              <label>Old SN:</label>
              <input
                type="text"
                value={oldSN}
                onChange={(e) => setOldSN(e.target.value)}
                placeholder="Enter Old SN"
                disabled={service}
              />
            </div>
            <div>
              <label>Warranty Status:</label>
              <select
                value={warrantyStatus}
                onChange={(e) => setWarrantyStatus(e.target.value)}
                disabled={service}
              >
                <option>Apple limited warranty</option>
                <option>Out of warranty</option>
                <option>Apple care protection</option>
                <option>Quality program</option>
                <option>Repeate Service</option>
                <option>CS code</option>
              </select>
            </div>
            <div>
              <label>Part Description:</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter Description"
                disabled={service}
              />
            </div>
            <div>
              <label>Quantity:</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter Quantity"
              />
            </div>
            <div>
              <label>Price:</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter Price"
              />
            </div>
          </div>

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
              {editIndex !== null ? "Update" : "Apply"}
            </button>
            {editIndex !== null && (
              <button
                onClick={resetForm}
                className="cancel-edit-button"
                style={{ marginLeft: 8 }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="delivery-header2">
          <div className="logo-section">
            <h2>Delivery Note</h2>
            <div className="underline"></div>
          </div>
          <div className="delivery-details2">
            <div className="left">
              <p>
                <strong>Delivery Date:</strong> {today}
              </p>
              <p>
                <strong>Customer Name:</strong> {ticket.customerName}
              </p>
              <p>
                <strong>Invoice #:</strong> {ticket.ticketNum}
              </p>
              <p>
                <strong>Product Type:</strong> {ticket.machineType}
              </p>
              <p>
                <strong>Repair ID:</strong> {ticket.caseID || "-"}
              </p>
            </div>
            <div className="right">
              <p>
                <strong>Serial Number:</strong> {ticket.serialNum}
              </p>
              <p>
                <strong>Device Issue:</strong> {ticket.symptom}
              </p>
              <p>
                <strong>Warranty Status:</strong> {ticket.warrantyStatus || ""}
              </p>
              <p>
                <strong>Technician:</strong> {technician?.name || ""}
              </p>
              <p>
                <strong>Tech ID:</strong> {technician?.techID || ""}
              </p>
            </div>
          </div>
        </div>

        <div className="delivery-table-container">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Part #</th>
                <th>Old Serial #</th>
                <th>New Serial #</th>
                <th>Quantity</th>
                <th>Warranty Status</th>
                <th>Price</th>
                <th>Actions</th>
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
                  <td>{part.price}</td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button
                      className="edit-part-button"
                      onClick={() => handleEditPart(idx)}
                      title="Edit part"
                      style={{ marginRight: 4 }}
                    >
                      ✏️
                    </button>
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
        </div>

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
      </div>

      <PriceQuotationModal
        isOpen={isPriceQuotationModalOpen}
        onClose={closePriceQuotationModal}
        ticket={ticket}
        initialPart={pendingQuotationPart}
      />
    </div>
  );
};

export default PartsPage;
