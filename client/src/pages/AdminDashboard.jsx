// AdminDashboard.jsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../context/userContext";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const AdminDashboard = () => {
  // Range download state
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [isDownloadingRange, setIsDownloadingRange] = useState(false);
  const storage = getStorage();
  const fetchAndAddFileToZip = async (zip, folder, fileName, filePath) => {
    if (!filePath) return;
    try {
      const fileRef = ref(storage, filePath);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const blob = await response.blob();
      zip.folder(folder).file(fileName, blob);
    } catch (err) {
      console.error(`Failed to fetch ${fileName}:`, err);
    }
  };

  // Download tickets in range as separate ZIPs
  const handleDownloadRange = async () => {
    if (!rangeStart || !rangeEnd) {
      alert("Please enter both start and end ticket numbers.");
      return;
    }
    setIsDownloadingRange(true);
    try {
      // Query tickets in range
      const startNum = parseInt(rangeStart);
      const endNum = parseInt(rangeEnd);
      if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
        alert("Invalid range.");
        setIsDownloadingRange(false);
        return;
      }
      const ticketsRef = collection(db, "tickets");
      const q = query(
        ticketsRef,
        where("ticketNum", ">=", startNum),
        where("ticketNum", "<=", endNum)
      );
      const snapshot = await getDocs(q);
      const tickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (tickets.length === 0) {
        alert("No tickets found in this range.");
        setIsDownloadingRange(false);
        return;
      }
      for (const ticket of tickets) {
        const zip = new JSZip();
        zip.file("ticket-details.json", JSON.stringify(ticket, null, 2));
        await Promise.all([
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "contract.pdf",
            ticket.contractURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "delivery-note.pdf",
            ticket.deliveryNoteURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "device-delivery-note.pdf",
            ticket.deviceDeliveryNoteURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "parts-delivery-note.pdf",
            ticket.partsDeliveryNoteURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "no-responsibility-note.pdf",
            ticket.noResponsibilityURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "technical-report.pdf",
            ticket.techReportURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "invoice.pdf",
            ticket.invoiceURL
          ),
          fetchAndAddFileToZip(
            zip,
            "signed-documents",
            "price-quotation.pdf",
            ticket.priceQuotationURL
          ),
        ]);
        if (ticket.mediaURLs && ticket.mediaURLs.length > 0) {
          await Promise.all(
            ticket.mediaURLs.map(async (path, idx) => {
              const extMatch = path.match(/\.([a-zA-Z0-9]+)$/);
              const ext = extMatch ? extMatch[1] : "bin";
              await fetchAndAddFileToZip(
                zip,
                "media",
                `media_${idx + 1}.${ext}`,
                path
              );
            })
          );
        }
        await zip.generateAsync({ type: "blob" }).then((content) => {
          saveAs(content, `ticket_${ticket.ticketNum || ticket.id}.zip`);
        });
      }
    } catch (err) {
      alert("Failed to download ticket ZIPs. Please try again.");
    }
    setIsDownloadingRange(false);
  };
  const { technician } = useUser();
  const navigate = useNavigate();
  const [pendingTickets, setPendingTickets] = useState([]);
  const [stats, setStats] = useState({
    totalTickets: 0,
    pendingApproval: 0,
    completedToday: 0,
    activeUsers: 0,
  });

  const isSystemAdmin =
    technician?.name === "System Admin" ||
    technician?.permission === "SystemAdmin";

  useEffect(() => {
    fetchPendingTickets();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get total tickets
      const ticketsSnapshot = await getDocs(collection(db, "tickets"));
      const totalTickets = ticketsSnapshot.size;

      // Get pending approvals
      const pendingQuery = query(
        collection(db, "tickets"),
        where("approvalRequired", "==", true)
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingApproval = pendingSnapshot.size;

      // Get completed today (status 7)
      const today = new Date().toDateString();
      const allTickets = ticketsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const completedToday = allTickets.filter((ticket) => {
        const lastUpdate =
          ticket.details && ticket.details.length > 0
            ? ticket.details[ticket.details.length - 1]
            : null;
        return (
          lastUpdate &&
          lastUpdate.includes("Closed") &&
          new Date(lastUpdate.split(" - ")[0]).toDateString() === today
        );
      }).length;

      // Get active users
      const usersSnapshot = await getDocs(collection(db, "technicions"));
      const activeUsers = usersSnapshot.size;

      setStats({
        totalTickets,
        pendingApproval,
        completedToday,
        activeUsers,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchPendingTickets = async () => {
    const q = query(
      collection(db, "tickets"),
      where("approvalRequired", "==", true)
    );
    const snapshot = await getDocs(q);
    const tickets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setPendingTickets(tickets);
  };

  const handleApprove = async (id) => {
    const ticketRef = doc(db, "tickets", id);
    await updateDoc(ticketRef, { waitingApproval: false });
    setPendingTickets((prev) => prev.filter((ticket) => ticket.id !== id));
    // Refresh stats
    fetchStats();
  };

  const handleDisapprove = async (id) => {
    const ticketRef = doc(db, "tickets", id);
    // You can handle disapproval more robustly (e.g., mark with a flag or remove status)
    await updateDoc(ticketRef, { waitingApproval: false });
    setPendingTickets((prev) => prev.filter((ticket) => ticket.id !== id));
    // Refresh stats
    fetchStats();
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>🛠️ Admin Dashboard</h1>
        <p>Welcome, {technician?.name}</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-info">
            <h3>{stats.totalTickets}</h3>
            <p>Total Tickets</p>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pendingApproval}</h3>
            <p>Pending Approval</p>
          </div>
        </div>
        <div className="stat-card completed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.completedToday}</h3>
            <p>Completed Today</p>
          </div>
        </div>
        <div className="stat-card users">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{stats.activeUsers}</h3>
            <p>Active Users</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>⚡ Quick Actions</h2>
        <div className="action-buttons">
          <button
            className="action-btn primary"
            onClick={() => navigate("/tickets")}
          >
            📋 View All Tickets
          </button>
          <button
            className="action-btn secondary"
            onClick={() => navigate("/tickets/new")}
          >
            ➕ Create New Ticket
          </button>
          {isSystemAdmin && (
            <button
              className="action-btn admin"
              onClick={() => navigate("/user-management")}
            >
              👥 Manage Users
            </button>
          )}
          <button
            className="action-btn info"
            onClick={() => navigate("/archived")}
          >
            📚 View Archived
          </button>
        </div>
        {/* Ticket Range Download UI */}
        <div
          className="range-download-box"
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <h3>⬇️ Download Ticket Range as ZIPs</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label>
              From Ticket #
              <input
                type="number"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                style={{ marginLeft: 6, width: 100 }}
                min={0}
              />
            </label>
            <label>
              To Ticket #
              <input
                type="number"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={{ marginLeft: 6, width: 100 }}
                min={0}
              />
            </label>
            <button
              className="action-btn"
              onClick={handleDownloadRange}
              disabled={isDownloadingRange}
            >
              {isDownloadingRange ? "Downloading..." : "Download Range"}
            </button>
          </div>
          <small style={{ color: "#888" }}>
            Each ticket will be downloaded as a separate ZIP file.
          </small>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="pending-section">
        <h2>🔍 Pending Ticket Approvals</h2>
        {pendingTickets.length === 0 ? (
          <div className="no-pending">
            <p>✅ No tickets awaiting approval.</p>
          </div>
        ) : (
          <div className="pending-list">
            {pendingTickets.map((ticket) => (
              <div key={ticket.id} className="pending-ticket">
                <div className="ticket-info">
                  <h3>
                    #{ticket.location}
                    {ticket.ticketNum}
                  </h3>
                  <p>
                    <strong>Customer:</strong> {ticket.customerName}
                  </p>
                  <p>
                    <strong>Device:</strong> {ticket.machineType}
                  </p>
                  <p>
                    <strong>Issue:</strong> {ticket.symptom}
                  </p>
                  <p>
                    <strong>Date:</strong> {ticket.date}
                  </p>
                </div>
                <div className="ticket-actions">
                  <button
                    className="approve-btn"
                    onClick={() => handleApprove(ticket.id)}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="disapprove-btn"
                    onClick={() => handleDisapprove(ticket.id)}
                  >
                    ❌ Disapprove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
