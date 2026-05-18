import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../context/userContext";
import { API_ENDPOINTS } from "../config/api";
import "./AppointmentsCalendar.css";
import "./AppointmentsPage.css";

// ─── Date helpers ────────────────────────────────────────────────────────────

const formatDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const combineDateAndTime = (date, timeInput) => {
  if (!date || Number.isNaN(date.getTime()) || !timeInput) return date;
  const withTime = new Date(date);

  const coerceFromTimestampLike = (value) => {
    if (value && typeof value.toDate === "function") return value.toDate();
    if (value && typeof value === "object" && typeof value.seconds === "number")
      return new Date(value.seconds * 1000);
    return null;
  };

  if (typeof timeInput === "number") {
    withTime.setHours(timeInput, 0, 0, 0);
    return withTime;
  }

  const ts = coerceFromTimestampLike(timeInput);
  if (ts && !Number.isNaN(ts.getTime())) return ts;

  if (typeof timeInput !== "string") return withTime;
  const trimmed = timeInput.trim();
  if (!trimmed) return withTime;

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso;

  const timeMatch = trimmed.match(
    /^([0-9]{1,2})(?::([0-9]{2}))?(?::([0-9]{2}))?\s*(am|pm)?$/i,
  );
  if (!timeMatch) return withTime;

  let hours = Number.parseInt(timeMatch[1], 10);
  const minutes = Number.parseInt(timeMatch[2], 10) || 0;
  const meridiem = timeMatch[4]?.toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  else if (meridiem === "am" && hours === 12) hours = 0;
  if (Number.isNaN(hours)) return withTime;
  withTime.setHours(hours, minutes, 0, 0);
  return withTime;
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const r = value.toDate();
    return Number.isNaN(r.getTime()) ? null : r;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const r = new Date(value.seconds * 1000);
    return Number.isNaN(r.getTime()) ? null : r;
  }
  if (typeof value === "number") {
    const r = new Date(value);
    return Number.isNaN(r.getTime()) ? null : r;
  }
  if (typeof value === "string") {
    const r = new Date(value);
    return Number.isNaN(r.getTime()) ? null : r;
  }
  return null;
};

// ─── Appointment data helpers ─────────────────────────────────────────────────

const getInnerAppointmentPayload = (appointment) => {
  if (
    appointment &&
    typeof appointment === "object" &&
    appointment.appointment &&
    typeof appointment.appointment === "object"
  ) {
    return appointment.appointment;
  }
  return null;
};

const getAppointmentTimeCandidate = (appointment) => {
  const nested = getInnerAppointmentPayload(appointment);
  return (
    appointment?.time ||
    appointment?.startTime ||
    appointment?.appointmentTime ||
    appointment?.slot ||
    appointment?.start ||
    nested?.time ||
    nested?.startTime ||
    nested?.appointmentTime ||
    nested?.slot ||
    nested?.start
  );
};

const parseAppointmentDate = (appointment) => {
  if (!appointment || typeof appointment !== "object") return null;
  const nested = getInnerAppointmentPayload(appointment);
  const candidateFields = [
    appointment.appointmentDate,
    appointment.date,
    appointment.startDate,
    appointment.datetime,
    appointment.start,
    nested?.appointmentDate,
    nested?.date,
    nested?.startDate,
    nested?.datetime,
    nested?.start,
  ];
  for (const field of candidateFields) {
    if (!field) continue;
    if (typeof field.toDate === "function") {
      const d = field.toDate();
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof field === "object" && typeof field.seconds === "number") {
      const d = new Date(field.seconds * 1000);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof field === "string") {
      const d = new Date(field);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
};

const deriveAppointmentSummary = (appointment) => {
  const nested = getInnerAppointmentPayload(appointment);
  return (
    appointment?.title ||
    appointment?.subject ||
    appointment?.customerName ||
    appointment?.name ||
    appointment?.device ||
    nested?.title ||
    nested?.subject ||
    nested?.name ||
    nested?.device ||
    "Appointment"
  );
};

const deriveAppointmentTimeLabel = (appointment, fallbackDate) => {
  const timeField = getAppointmentTimeCandidate(appointment);
  if (timeField && typeof timeField === "string") {
    const iso = new Date(timeField);
    if (!Number.isNaN(iso.getTime()) && timeField.includes("T")) {
      return iso.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return timeField;
  }
  if (timeField && typeof timeField.toDate === "function") {
    return timeField
      .toDate()
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (fallbackDate && !Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
};

const resolveAppointmentDetails = (appointment) => {
  if (!appointment) {
    return {
      summary: "Appointment",
      scheduledDate: null,
      timeLabel: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      location: "",
      status: "",
      device: "",
      description: "",
      services: [],
      createdAt: null,
    };
  }

  const nested = getInnerAppointmentPayload(appointment) || {};
  const getFirstValue = (...candidates) => {
    for (const c of candidates) {
      if (Array.isArray(c) && c.length > 0) return c;
      if (c !== undefined && c !== null && c !== "") return c;
    }
    return undefined;
  };

  const scheduledDate = parseAppointmentDate(appointment);
  const timeLabel = deriveAppointmentTimeLabel(appointment, scheduledDate);
  const summary = deriveAppointmentSummary(appointment);
  const customer =
    appointment.customer || nested.customer || nested.customerInfo || {};

  return {
    summary,
    scheduledDate,
    timeLabel,
    customerName: getFirstValue(
      customer.name,
      appointment.customerName,
      nested.customerName,
    ),
    customerEmail: getFirstValue(
      customer.email,
      appointment.customerEmail,
      nested.customerEmail,
      appointment.email,
    ),
    customerPhone: getFirstValue(
      customer.phone,
      appointment.customerPhone,
      nested.customerPhone,
      appointment.phone,
    ),
    location: getFirstValue(
      appointment.location,
      nested.location,
      appointment.branch,
      nested.branch,
      appointment.city,
      nested.city,
      customer.preferredLocation,
    ),
    status: getFirstValue(
      appointment.status,
      nested.status,
      appointment.appointmentStatus,
      nested.appointmentStatus,
      appointment.progress,
      nested.progress,
    ),
    device: getFirstValue(
      appointment.device,
      nested.device,
      appointment.machine,
      nested.machine,
      appointment.machineType,
      nested.machineType,
    ),
    description: getFirstValue(
      appointment.description,
      nested.description,
      appointment.notes,
      nested.notes,
      appointment.symptom,
      nested.symptom,
      appointment.problemDescription,
      nested.problemDescription,
    ),
    services:
      getFirstValue(
        Array.isArray(appointment.services) ? appointment.services : null,
        Array.isArray(nested.services) ? nested.services : null,
      ) || [],
    createdAt: normalizeDateValue(
      appointment.createdAt ||
        appointment.created_at ||
        nested.createdAt ||
        nested.created_at,
    ),
  };
};

// ─── Availability filter ──────────────────────────────────────────────────────

const AVAILABLE_STATUS_KEYWORDS = new Set([
  "available",
  "open",
  "free",
  "unassigned",
  "pending",
]);

const UNAVAILABLE_STATUS_KEYWORDS = new Set([
  "booked",
  "reserved",
  "assigned",
  "closed",
  "completed",
  "cancelled",
  "canceled",
  "taken",
  "confirmed",
  "unavailable",
  "accepted",
  "approved",
  "rejected",
  "declined",
  "denied",
]);

const TRUTHY_TEXT_VALUES = new Set(["true", "yes", "available", "open"]);
const FALSY_TEXT_VALUES = new Set([
  "false",
  "no",
  "booked",
  "reserved",
  "closed",
  "taken",
]);

const parseStringFlag = (value) => {
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    if (TRUTHY_TEXT_VALUES.has(n)) return true;
    if (FALSY_TEXT_VALUES.has(n)) return false;
  }
  return null;
};

const isAppointmentAvailable = (appointment) => {
  if (!appointment || typeof appointment !== "object") return false;
  if (
    appointment.isAvailable === false ||
    appointment.available === false ||
    appointment.slotAvailable === false
  )
    return false;

  const booleanCandidates = [
    appointment.isAvailable,
    appointment.available,
    appointment.is_open,
    appointment.is_open_slot,
    appointment.slotAvailable,
    appointment.availability,
  ];
  for (const c of booleanCandidates) {
    if (typeof c === "boolean") return c;
    const p = parseStringFlag(c);
    if (p !== null) return p;
  }

  const statusCandidates = [
    appointment.status,
    appointment.appointmentStatus,
    appointment.slotStatus,
    appointment.state,
    appointment.stage,
    appointment.progress,
  ];
  for (const rawStatus of statusCandidates) {
    if (typeof rawStatus !== "string") continue;
    const normalized = rawStatus.trim().toLowerCase();
    if (UNAVAILABLE_STATUS_KEYWORDS.has(normalized)) return false;
    if (AVAILABLE_STATUS_KEYWORDS.has(normalized)) return true;
  }

  return true;
};

const isProcessedToday = (appointment) => {
  const status = (
    appointment?.status ||
    appointment?.appointmentStatus ||
    ""
  ).trim().toLowerCase();
  if (status !== "accepted" && status !== "rejected") return false;
  const apptDate = parseAppointmentDate(appointment);
  if (!apptDate) return false;
  return formatDateKey(apptDate) === formatDateKey(new Date());
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildCalendarMatrix = (anchorDate) => {
  const firstOfMonth = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1,
  );
  const startDate = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks = [];
  for (let wi = 0; wi < 6; wi++) {
    const days = [];
    for (let di = 0; di < 7; di++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + wi * 7 + di);
      days.push(current);
    }
    weeks.push(days);
  }
  return weeks;
};

// ─── AppointmentDetailsPanel ──────────────────────────────────────────────────

const AppointmentDetailsPanel = ({
  appointment,
  onClose,
  onAccept,
  onReject,
  actionState = { isProcessing: false, action: null, error: "", success: "" },
}) => {
  if (!appointment) return null;

  const details = resolveAppointmentDetails(appointment);
  const formattedScheduledDate = details.scheduledDate
    ? details.scheduledDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Date pending";

  const formattedCreatedAt = details.createdAt
    ? details.createdAt.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const hasActions = Boolean(onAccept || onReject);
  const isProcessing = Boolean(actionState?.isProcessing);
  const isAccepting =
    isProcessing && actionState?.action === "accept" && Boolean(onAccept);
  const isRejecting =
    isProcessing && actionState?.action === "reject" && Boolean(onReject);

  return (
    <aside className="appointment-details">
      <div className="appointment-details__header">
        <div>
          <p className="appointment-details__eyebrow">Selected appointment</p>
          <h3>{details.summary}</h3>
          <p className="appointment-details__time">
            {formattedScheduledDate}
            {details.timeLabel ? ` · ${details.timeLabel}` : ""}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="appointment-details__close"
            onClick={onClose}
          >
            Clear
          </button>
        )}
      </div>

      <div className="appointment-details__section appointment-details__grid">
        <div>
          <span className="appointment-details__label">Location</span>
          <p className="appointment-details__value">
            {details.location || "—"}
          </p>
        </div>
        <div>
          <span className="appointment-details__label">Status</span>
          <p className="appointment-details__value">{details.status || "—"}</p>
        </div>
        <div>
          <span className="appointment-details__label">Device</span>
          <p className="appointment-details__value">{details.device || "—"}</p>
        </div>
        <div>
          <span className="appointment-details__label">Services</span>
          {details.services.length > 0 ? (
            <ul className="appointment-details__tags">
              {details.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          ) : (
            <p className="appointment-details__value">—</p>
          )}
        </div>
      </div>

      <div className="appointment-details__section appointment-details__grid">
        <div>
          <span className="appointment-details__label">Customer</span>
          <p className="appointment-details__value">
            {details.customerName || "—"}
          </p>
        </div>
        <div>
          <span className="appointment-details__label">Phone</span>
          <p className="appointment-details__value">
            {details.customerPhone || "—"}
          </p>
        </div>
        <div>
          <span className="appointment-details__label">Email</span>
          <p className="appointment-details__value">
            {details.customerEmail || "—"}
          </p>
        </div>
        <div>
          <span className="appointment-details__label">Created</span>
          <p className="appointment-details__value">{formattedCreatedAt}</p>
        </div>
      </div>

      {details.description && (
        <div className="appointment-details__section">
          <span className="appointment-details__label">Notes</span>
          <p className="appointment-details__description">
            {details.description}
          </p>
        </div>
      )}

      <div className="appointment-details__section appointment-details__meta">
        <span>ID</span>
        <code>{appointment.id}</code>
      </div>

      {hasActions && (
        <div className="appointment-details__actions">
          {onAccept && (
            <button
              type="button"
              className="appointment-details__button appointment-details__button--accept"
              onClick={onAccept}
              disabled={isProcessing}
            >
              {isAccepting ? "Accepting…" : "Accept appointment"}
            </button>
          )}
          {onReject && (
            <button
              type="button"
              className="appointment-details__button appointment-details__button--reject"
              onClick={onReject}
              disabled={isProcessing}
            >
              {isRejecting ? "Rejecting…" : "Reject appointment"}
            </button>
          )}
        </div>
      )}

      {(actionState?.error || actionState?.success) && (
        <div
          className={`appointment-details__status ${
            actionState.error
              ? "appointment-details__status--error"
              : "appointment-details__status--success"
          }`}
        >
          {actionState.error || actionState.success}
        </div>
      )}
    </aside>
  );
};

// ─── AppointmentsPage ─────────────────────────────────────────────────────────

const AppointmentsPage = () => {
  const { technician } = useUser();
  const currentTechnicianName =
    technician?.name ||
    technician?.fullName ||
    technician?.displayName ||
    technician?.email ||
    "365 Solutions Team";

  const [appointments, setAppointments] = useState([]);
  const [processedToday, setProcessedToday] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({
    isProcessing: false,
    action: null,
    error: "",
    success: "",
  });

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    now.setDate(1);
    return now;
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(collection(db, "appointments"));
      const all = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setAppointments(all.filter(isAppointmentAvailable));
      setProcessedToday(all.filter(isProcessedToday));
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError("Failed to load appointments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Deselect if the appointment was removed
  useEffect(() => {
    if (
      selectedAppointment &&
      !appointments.some((a) => a.id === selectedAppointment.id)
    ) {
      setSelectedAppointment(null);
      setIsDetailsVisible(false);
      resetActionState();
    }
  }, [appointments, selectedAppointment]);

  // ── Action state ───────────────────────────────────────────────────────────

  const resetActionState = useCallback(() => {
    setActionState({
      isProcessing: false,
      action: null,
      error: "",
      success: "",
    });
  }, []);

  // ── Email ──────────────────────────────────────────────────────────────────

  const sendDecisionEmail = useCallback(
    async (appointment, decision) => {
      const details = resolveAppointmentDetails(appointment);
      const recipient = details.customerEmail?.trim();
      if (!recipient) {
        return "No customer email on file. Please notify the customer manually.";
      }

      const friendlyName = details.customerName || "valued customer";
      const scheduledLabel = details.scheduledDate
        ? details.scheduledDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "a pending date";
      const timeLabel = details.timeLabel ? ` at ${details.timeLabel}` : "";
      const locationLabel = details.location
        ? ` at our ${details.location} location`
        : " at our service center";

      const subject =
        decision === "accept"
          ? `Appointment confirmed – ${details.summary}`
          : `Appointment update – ${details.summary}`;

      const introCopy =
        decision === "accept"
          ? `We're happy to confirm your appointment on ${scheduledLabel}${timeLabel}${locationLabel}.`
          : `We're sorry to inform you that we can't accommodate your appointment on ${scheduledLabel}${timeLabel}.`;

      const followUpCopy =
        decision === "accept"
          ? "We'll be ready for your visit. If you need to reschedule, please call or reply to this email."
          : "Please reply to this email or call us so we can help you reschedule at a convenient time.";

      const servicesMarkup =
        details.services.length > 0
          ? `<li><strong>Services:</strong> ${details.services.join(", ")}</li>`
          : "";

      const descriptionMarkup = details.description
        ? `<p><strong>Notes:</strong> ${details.description}</p>`
        : "";

      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <p>Hi ${friendlyName},</p>
          <p>${introCopy}</p>
          <p>${followUpCopy}</p>
          <p><strong>Appointment details:</strong></p>
          <ul>
            <li><strong>Subject:</strong> ${details.summary}</li>
            <li><strong>Date:</strong> ${scheduledLabel}${timeLabel || ""}</li>
            <li><strong>Location:</strong> ${details.location || "365 Solutions"}</li>
            <li><strong>Device:</strong> ${details.device || "—"}</li>
            ${servicesMarkup}
          </ul>
          ${descriptionMarkup}
          <p>If you have any questions, just reply to this email or call us.</p>
          <p>Best regards,<br/>${currentTechnicianName}<br/>365 Solutions Team</p>
        </div>
      `;

      const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, subject, html }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to send customer email.";
        try {
          const payload = await response.json();
          if (payload?.error) {
            errorMessage =
              typeof payload.error === "string"
                ? payload.error
                : payload.error.message || errorMessage;
          }
        } catch (e) {
          console.error("Failed to parse email error response", e);
        }
        throw new Error(errorMessage);
      }

      return `Email sent to ${recipient}.`;
    },
    [currentTechnicianName],
  );

  // ── Decision handler ───────────────────────────────────────────────────────

  const handleDecision = useCallback(
    async (appointment, decision) => {
      if (!appointment?.id) return;
      setActionState({
        isProcessing: true,
        action: decision,
        error: "",
        success: "",
      });

      try {
        const emailMessage = await sendDecisionEmail(appointment, decision);
        const newStatus = decision === "accept" ? "accepted" : "rejected";
        await updateDoc(doc(db, "appointments", appointment.id), {
          status: newStatus,
          decidedAt: serverTimestamp(),
          decidedBy: currentTechnicianName,
        });
        const updatedAppointment = { ...appointment, status: newStatus, decidedBy: currentTechnicianName };
        setAppointments((prev) => prev.filter((a) => a.id !== appointment.id));
        setProcessedToday((prev) => [
          updatedAppointment,
          ...prev.filter((a) => a.id !== appointment.id),
        ]);
        const outcomeMessage =
          decision === "accept"
            ? "Appointment accepted."
            : "Appointment rejected.";
        setActionState({
          isProcessing: false,
          action: null,
          error: "",
          success: `${outcomeMessage} ${emailMessage || ""}`.trim(),
        });
      } catch (err) {
        console.error("Failed to process appointment decision", err);
        setActionState({
          isProcessing: false,
          action: null,
          error:
            err?.message ||
            "Something went wrong while handling the appointment.",
          success: "",
        });
      }
    },
    [sendDecisionEmail],
  );

  const handleAccept = useCallback(
    (appointment) => handleDecision(appointment, "accept"),
    [handleDecision],
  );

  const handleReject = useCallback(
    (appointment) => handleDecision(appointment, "reject"),
    [handleDecision],
  );

  // ── Calendar ───────────────────────────────────────────────────────────────

  const appointmentsByDate = useMemo(() => {
    const grouped = appointments.reduce((acc, appointment) => {
      const baseDate = parseAppointmentDate(appointment);
      if (!baseDate) return acc;
      const dateWithTime = combineDateAndTime(
        baseDate,
        getAppointmentTimeCandidate(appointment),
      );
      const key = formatDateKey(baseDate);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: appointment.id,
        summary: deriveAppointmentSummary(appointment),
        timeLabel: deriveAppointmentTimeLabel(appointment, dateWithTime),
        sortKey: dateWithTime
          ? dateWithTime.getTime()
          : Number.MAX_SAFE_INTEGER,
        raw: appointment,
      });
      return acc;
    }, {});
    Object.values(grouped).forEach((list) =>
      list.sort((a, b) => a.sortKey - b.sortKey),
    );
    return grouped;
  }, [appointments]);

  const calendarMatrix = useMemo(
    () => buildCalendarMatrix(viewDate),
    [viewDate],
  );

  const handlePrevMonth = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setIsDetailsVisible(true);
    resetActionState();
  };

  const handleCloseDetails = () => {
    setIsDetailsVisible(false);
    setSelectedAppointment(null);
    resetActionState();
  };

  const monthLabel = viewDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="appt-page">
      <div className="appt-page__header">
        <h1 className="appt-page__title">Appointments</h1>
        <div className="appt-page__meta">
          {!loading && !error && (
            <span className="appt-page__count">
              {appointments.length === 0
                ? "No pending appointments"
                : `${appointments.length} pending appointment${appointments.length === 1 ? "" : "s"}`}
              {processedToday.length > 0 && (
                <span className="appt-page__count-processed">
                  {" · "}{processedToday.length} processed today
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            className="appt-page__refresh"
            onClick={fetchAppointments}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="appt-page__error">
          <span>{error}</span>
          <button type="button" onClick={fetchAppointments}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="appt-page__loading">Loading appointments…</div>
      )}

      {!loading && !error && (
        <div
          className={`appt-page__body ${isDetailsVisible ? "appt-page__body--with-details" : ""}`}
        >
          {/* Calendar */}
          <div className="appt-page__calendar-wrap">
            <div className="appointments-calendar__controls appt-page__calendar-controls">
              <button
                type="button"
                className="appointments-calendar__nav"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                ◀
              </button>
              <span>{monthLabel}</span>
              <button
                type="button"
                className="appointments-calendar__nav"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                ▶
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="appointments-calendar__status appointments-calendar__status--empty">
                No appointments found.
              </div>
            ) : (
              <div className="appointments-calendar">
                <div className="appointments-week appointments-week--labels">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="appointments-day appointments-day--label"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                {calendarMatrix.map((week, weekIndex) => (
                  <div
                    className="appointments-week"
                    key={`week-${weekIndex}`}
                  >
                    {week.map((date) => {
                      const key = formatDateKey(date);
                      const isCurrentMonth =
                        date.getMonth() === viewDate.getMonth();
                      const dayAppointments = appointmentsByDate[key] || [];
                      return (
                        <div
                          key={key}
                          className={`appointments-day ${
                            isCurrentMonth ? "" : "appointments-day--outside"
                          }`}
                        >
                          <div className="appointments-day__number">
                            {date.getDate()}
                          </div>
                          <div className="appointments-day__list">
                            {dayAppointments.map((item, idx) => {
                              const isActive =
                                selectedAppointment?.id === item.id;
                              return (
                                <div
                                  key={item.id || `${key}-${idx}`}
                                  role="button"
                                  tabIndex={0}
                                  className={`appointments-day__item ${
                                    isActive
                                      ? "appointments-day__item--active"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleAppointmentClick(item.raw)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleAppointmentClick(item.raw);
                                    }
                                  }}
                                >
                                  {item.timeLabel && (
                                    <span className="appointments-day__time">
                                      {item.timeLabel}
                                    </span>
                                  )}
                                  <span className="appointments-day__title">
                                    {item.summary}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details panel */}
          {isDetailsVisible && selectedAppointment && (
            <AppointmentDetailsPanel
              appointment={selectedAppointment}
              onClose={handleCloseDetails}
              onAccept={() => handleAccept(selectedAppointment)}
              onReject={() => handleReject(selectedAppointment)}
              actionState={actionState}
            />
          )}
        </div>
      )}

      {/* Processed Today section */}
      {!loading && processedToday.length > 0 && (
        <div className="appt-page__processed">
          <h2 className="appt-page__processed-title">Processed Today</h2>
          <div className="appt-page__processed-list">
            {processedToday.map((appt) => {
              const details = resolveAppointmentDetails(appt);
              const isAccepted = (appt.status || "").toLowerCase() === "accepted";
              const scheduledLabel = details.scheduledDate
                ? details.scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";
              return (
                <div key={appt.id} className="appt-page__processed-item">
                  <span
                    className={`appt-page__processed-badge ${
                      isAccepted
                        ? "appt-page__processed-badge--accepted"
                        : "appt-page__processed-badge--rejected"
                    }`}
                  >
                    {isAccepted ? "✓ Accepted" : "✕ Rejected"}
                  </span>
                  <span className="appt-page__processed-name">
                    {details.customerName || details.summary}
                  </span>
                  {details.device && (
                    <span className="appt-page__processed-device">{details.device}</span>
                  )}
                  {scheduledLabel && (
                    <span className="appt-page__processed-time">{scheduledLabel}</span>
                  )}
                  {appt.decidedBy && (
                    <span className="appt-page__processed-by">by {appt.decidedBy}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
