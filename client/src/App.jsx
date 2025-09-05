import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Tickets from "./pages/Tickets";
import Customers from "./pages/Customers";
import Devices from "./pages/Devices";
import Archived from "./pages/Archived";
import LoginPage from "./pages/LoginPage";
import UserManagement from "./pages/UserManagement";
import Accounting from "./pages/Accounting";

import "./App.css";
import NewTicket from "./pages/NewTicketPage";
import PrivateRoute from "./PrivateRoute";
import ProcessTicketPage from "./pages/ProcessTicketPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRoute from "./routes/AdminRoute";
import SystemAdminRoute from "./routes/SystemAdminRoute";
import DeliveryPage from "./pages/DeliveryPage";
import PartsDeliveryPage from "./pages/PartsDeliveryPage";
import ReceiptPage from "./pages/ReceiptPage";
import ReceivePayment from "./pages/ReceivePayment";

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route
            path="/tickets"
            element={
              <PrivateRoute>
                <Tickets />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <PrivateRoute>
                <Tickets />
              </PrivateRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <PrivateRoute>
                <Customers />
              </PrivateRoute>
            }
          />
          <Route
            path="/devices"
            element={
              <PrivateRoute>
                <Devices />
              </PrivateRoute>
            }
          />
          <Route
            path="/archived"
            element={
              <PrivateRoute>
                <Archived />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <PrivateRoute>
                <NewTicket />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets/:id/process"
            element={
              <PrivateRoute>
                <ProcessTicketPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/user-management"
            element={
              <SystemAdminRoute>
                <UserManagement />
              </SystemAdminRoute>
            }
          />
          <Route
            path="/tickets/:id/deliver"
            element={
              <PrivateRoute>
                <DeliveryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets/:id/part-delivery"
            element={
              <PrivateRoute>
                <PartsDeliveryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets/:id/receipt-page"
            element={
              <PrivateRoute>
                <ReceiptPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <PrivateRoute>
                <Accounting />
              </PrivateRoute>
            }
          />
          <Route
            path="/receive-payment/:ticketId"
            element={
              <PrivateRoute>
                <ReceivePayment />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
