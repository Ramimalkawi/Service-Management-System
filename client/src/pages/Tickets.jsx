import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  runTransaction,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import TicketCard from "../components/TicketCard";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { useUser } from "../context/userContext";

import { API_ENDPOINTS } from "../config/api";

import "./Tickets.css";
import "./AppointmentsCalendar.css";
import TicketDetail from "../components/TicketDetail";

const TICKETS_PER_PAGE = 50;
const LOCATION_FILTERS = [
  { label: "All", value: "All" },
  { label: "Amman", value: "Amman" },
  { label: "Irbid", value: "Irbid" },
  { label: "Online Customers", value: "Online" },
];

const WARRANTY_OPTIONS = [
  "Apple limited warranty",
  "Out of warranty",
  "Apple care protection",
  "Quality program",
  "Repeate Service",
  "CS code",
];

const TICKET_NUMBER_DOC_ID = "OelkqX6vOsleiRSAHl17";

const formatTicketTimestamp = () =>
  new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

const generate3DigitNumber = () =>
  Math.floor(100 + Math.random() * 900).toString();

const STORAGE_BUCKET =
  storage?.app?.options?.storageBucket ||
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
  "solutionssystemmain.appspot.com";

const sanitizeDeviceType = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.replace(/repair/gi, "").trim();
};

const inferAgreementLocationCode = (agreement) => {
  const rawLocation =
    agreement?.preferredLocation ||
    agreement?.location ||
    agreement?.customer?.preferredLocation ||
    agreement?.deviceInfo?.location ||
    agreement?.deviceInfo?.locationName ||
    "";

  if (!rawLocation) return "";
  const normalized = String(rawLocation).trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "m" || normalized.includes("amman")) return "M";
  if (normalized === "i" || normalized.includes("irbid")) return "I";
  return "";
};

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
    if (value && typeof value.toDate === "function") {
      return value.toDate();
    }
    if (
      value &&
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      return new Date(value.seconds * 1000);
    }
    return null;
  };

  if (typeof timeInput === "number") {
    withTime.setHours(timeInput, 0, 0, 0);
    return withTime;
  }

  const timestampValue = coerceFromTimestampLike(timeInput);
  if (timestampValue && !Number.isNaN(timestampValue.getTime())) {
    return timestampValue;
  }

  if (typeof timeInput !== "string") {
    return withTime;
  }

  const trimmed = timeInput.trim();
  if (!trimmed) return withTime;

  const isoCandidate = new Date(trimmed);
  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate;
  }

  const timeMatch = trimmed.match(
    /^([0-9]{1,2})(?::([0-9]{2}))?(?::([0-9]{2}))?\s*(am|pm)?$/i,
  );
  if (!timeMatch) return withTime;

  let hours = Number.parseInt(timeMatch[1], 10);
  const minutes = Number.parseInt(timeMatch[2], 10) || 0;
  const meridiem = timeMatch[4]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  }

  if (Number.isNaN(hours)) return withTime;

  withTime.setHours(hours, minutes, 0, 0);
  return withTime;
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const result = value.toDate();
    return Number.isNaN(result.getTime()) ? null : result;
  }
  if (value && typeof value === "object" && typeof value.seconds === "number") {
    const result = new Date(value.seconds * 1000);
    return Number.isNaN(result.getTime()) ? null : result;
  }
  if (typeof value === "number") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }
  if (typeof value === "string") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }
  return null;
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
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate;
      }
      if (candidate !== undefined && candidate !== null && candidate !== "") {
        return candidate;
      }
    }
    return undefined;
  };

  const scheduledDate = parseAppointmentDate(appointment);
  const timeLabel = deriveAppointmentTimeLabel(appointment, scheduledDate);
  const summary = deriveAppointmentSummary(appointment);
  const customer =
    appointment.customer || nested.customer || nested.customerInfo || {};
  const customerName = getFirstValue(
    customer.name,
    appointment.customerName,
    nested.customerName,
  );
  const customerEmail = getFirstValue(
    customer.email,
    appointment.customerEmail,
    nested.customerEmail,
    appointment.email,
  );
  const customerPhone = getFirstValue(
    customer.phone,
    appointment.customerPhone,
    nested.customerPhone,
    appointment.phone,
  );
  const location = getFirstValue(
    appointment.location,
    nested.location,
    appointment.branch,
    nested.branch,
    appointment.city,
    nested.city,
    customer.preferredLocation,
  );
  const status = getFirstValue(
    appointment.status,
    nested.status,
    appointment.appointmentStatus,
    nested.appointmentStatus,
    appointment.progress,
    nested.progress,
  );
  const device = getFirstValue(
    appointment.device,
    nested.device,
    appointment.machine,
    nested.machine,
    appointment.machineType,
    nested.machineType,
  );
  const description = getFirstValue(
    appointment.description,
    nested.description,
    appointment.notes,
    nested.notes,
    appointment.symptom,
    nested.symptom,
    appointment.problemDescription,
    nested.problemDescription,
  );
  const services =
    getFirstValue(
      Array.isArray(appointment.services) ? appointment.services : null,
      Array.isArray(nested.services) ? nested.services : null,
    ) || [];
  const createdAt = normalizeDateValue(
    appointment.createdAt ||
      appointment.created_at ||
      nested.createdAt ||
      nested.created_at,
  );

  return {
    summary,
    scheduledDate,
    timeLabel,
    customerName,
    customerEmail,
    customerPhone,
    location,
    status,
    device,
    description,
    services,
    createdAt,
  };
};

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
      const dateObj = field.toDate();
      if (!Number.isNaN(dateObj.getTime())) return dateObj;
    }
    if (typeof field === "object" && typeof field.seconds === "number") {
      const dateObj = new Date(field.seconds * 1000);
      if (!Number.isNaN(dateObj.getTime())) return dateObj;
    }
    if (typeof field === "string") {
      const dateObj = new Date(field);
      if (!Number.isNaN(dateObj.getTime())) return dateObj;
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
    const isoCandidate = new Date(timeField);
    if (!Number.isNaN(isoCandidate.getTime()) && timeField.includes("T")) {
      return isoCandidate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return timeField;
  }
  if (timeField && typeof timeField.toDate === "function") {
    return timeField.toDate().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (fallbackDate && !Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
};

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
    const normalized = value.trim().toLowerCase();
    if (TRUTHY_TEXT_VALUES.has(normalized)) return true;
    if (FALSY_TEXT_VALUES.has(normalized)) return false;
  }
  return null;
};

const isAppointmentAvailable = (appointment) => {
  if (!appointment || typeof appointment !== "object") return false;

  if (
    appointment.isAvailable === false ||
    appointment.available === false ||
    appointment.slotAvailable === false
  ) {
    return false;
  }

  const booleanCandidates = [
    appointment.isAvailable,
    appointment.available,
    appointment.is_open,
    appointment.is_open_slot,
    appointment.slotAvailable,
    appointment.availability,
  ];

  for (const candidate of booleanCandidates) {
    if (typeof candidate === "boolean") return candidate;
    const parsed = parseStringFlag(candidate);
    if (parsed !== null) return parsed;
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
    if (AVAILABLE_STATUS_KEYWORDS.has(normalized)) return true;
    if (UNAVAILABLE_STATUS_KEYWORDS.has(normalized)) return false;
  }

  if (typeof appointment.slotsLeft === "number") {
    return appointment.slotsLeft > 0;
  }

  if (typeof appointment.remainingCapacity === "number") {
    return appointment.remainingCapacity > 0;
  }

  if (typeof appointment.capacity === "number") {
    const booked = Number(
      appointment.bookedCount ??
        appointment.booked ??
        appointment.reservedCount ??
        (Array.isArray(appointment.customers)
          ? appointment.customers.length
          : 0),
    );
    if (!Number.isNaN(booked)) {
      return booked < appointment.capacity;
    }
  }

  return true;
};

const AGREEMENT_URL_PATHS = [
  "url",
  "agreementUrl",
  "agreementURL",
  "agreementPdfUrl",
  "agreementPdfURL",
  "pdfUrl",
  "pdfURL",
  "signedPdfUrl",
  "signedPdfURL",
  "signedAgreementUrl",
  "signedAgreementURL",
  "documentUrl",
  "documentURL",
  "contractUrl",
  "contractURL",
  "links.agreement",
  "links.contract",
  "agreement.url",
  "signedAgreement.url",
  "document.url",
  "file.url",
];

const getNestedValue = (record, path) => {
  if (!record || typeof record !== "object" || !path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return undefined;
  }, record);
};

const buildDownloadUrlFromStoragePath = (rawPath) => {
  if (!rawPath || typeof rawPath !== "string") return null;
  const path = rawPath.replace(/^\/+/, "");
  if (!path) return null;
  if (!STORAGE_BUCKET) return null;
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(
    path,
  )}?alt=media`;
};

const getStoragePathFromCandidate = (rawValue) => {
  if (!rawValue || typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex === -1) return null;
    return withoutScheme.slice(slashIndex + 1);
  }

  if (/^https?:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes("firebasestorage.googleapis.com")) {
        const parts = url.pathname.split("/");
        const oIndex = parts.indexOf("o");
        if (oIndex !== -1 && parts[oIndex + 1]) {
          return decodeURIComponent(parts[oIndex + 1]);
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed.replace(/^\/+/, "");
  }

  if (!trimmed.includes("://")) {
    return trimmed;
  }

  return null;
};

const normalizeAgreementUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^(https?:|data:)/i.test(trimmed)) {
    if (trimmed.startsWith("//")) {
      if (typeof window !== "undefined") {
        return `${window.location.protocol}${trimmed}`;
      }
      return `https:${trimmed}`;
    }
    return trimmed;
  }

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex === -1) return null;
    const bucket = withoutScheme.slice(0, slashIndex);
    const objectPath = withoutScheme.slice(slashIndex + 1);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
      objectPath,
    )}?alt=media`;
  }

  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }

  if (trimmed.startsWith(".")) {
    if (typeof window !== "undefined") {
      return new URL(trimmed, window.location.origin).toString();
    }
    return trimmed;
  }

  return buildDownloadUrlFromStoragePath(trimmed) || trimmed;
};

const resolveAgreementFileInfo = (agreement) => {
  if (!agreement || typeof agreement !== "object") {
    return { downloadUrl: null, storagePath: null };
  }

  const inspectCandidate = (candidate) => {
    if (typeof candidate !== "string" || !candidate.trim()) return null;
    const downloadUrl = normalizeAgreementUrl(candidate);
    const storagePath = getStoragePathFromCandidate(candidate);
    if (!downloadUrl && storagePath) {
      return {
        downloadUrl: buildDownloadUrlFromStoragePath(storagePath),
        storagePath,
      };
    }
    if (downloadUrl || storagePath) {
      return {
        downloadUrl,
        storagePath,
      };
    }
    return null;
  };

  for (const path of AGREEMENT_URL_PATHS) {
    const info = inspectCandidate(getNestedValue(agreement, path));
    if (info) return info;
  }

  if (Array.isArray(agreement.attachments)) {
    for (const attachment of agreement.attachments) {
      if (typeof attachment === "string") {
        const info = inspectCandidate(attachment);
        if (info) return info;
      } else if (
        attachment &&
        typeof attachment === "object" &&
        typeof attachment.url === "string"
      ) {
        const info = inspectCandidate(attachment.url);
        if (info) return info;
      }
    }
  }

  if (
    agreement.storagePaths &&
    typeof agreement.storagePaths.agreement === "string"
  ) {
    const info = inspectCandidate(agreement.storagePaths.agreement);
    if (info) return info;
  }

  return { downloadUrl: null, storagePath: null };
};

const mapOnlineAgreementToTicket = ({
  agreement,
  locationCode,
  ticketNum,
  ticketId,
  contractStoragePath,
  agreementDownloadUrl,
  warrantyStatus,
  technicianName,
}) => {
  const timestamp = formatTicketTimestamp();
  const customer = agreement?.customer || {};
  const deviceInfo = agreement?.deviceInfo || {};
  const services = Array.isArray(agreement?.services)
    ? agreement.services.filter(Boolean)
    : [];
  const derivedCompanyName =
    agreement?.companyName ||
    agreement?.company?.name ||
    customer.company ||
    "";
  const isBusinessCustomer = Boolean(derivedCompanyName.trim());

  const startedBy = technicianName || "Online Intake Portal";
  const baseDetails = [`Accepted on ${timestamp}. Started by ${startedBy}.`];
  if (Array.isArray(agreement?.details)) {
    baseDetails.push(...agreement.details.filter(Boolean));
  }

  const deviceTypeRaw =
    agreement?.device ||
    deviceInfo.device ||
    deviceInfo.selectionDescription ||
    "";
  const sanitizedDeviceType = sanitizeDeviceType(deviceTypeRaw);

  const ticketPayload = {
    ticketNum,
    ticketId,
    location: locationCode,
    customerName:
      customer.name ||
      agreement?.customerName ||
      customer.fullName ||
      "Online customer",
    mobileNumber:
      customer.phone || agreement?.customerPhone || agreement?.phone || "",
    customerAddress: customer.address || "",
    customerCompany: customer.company || "",
    emailAddress:
      customer.email || agreement?.customerEmail || agreement?.email || "",
    customerType: agreement?.customerType || "personal",
    companyName: derivedCompanyName,
    machineType: sanitizedDeviceType,
    deviceDescription:
      agreement?.deviceDescription ||
      deviceInfo.selectionDescription ||
      sanitizedDeviceType ||
      "",
    serialNum:
      deviceInfo.serialOrImei ||
      agreement?.serial ||
      agreement?.serialNum ||
      "",
    deviceIMEI:
      agreement?.deviceIMEI ||
      deviceInfo.serialOrImei ||
      agreement?.serial ||
      "",
    warrantyStatus:
      warrantyStatus || agreement?.warrantyStatus || "Out of warranty",
    symptom:
      deviceInfo.problemDetails ||
      agreement?.issue ||
      agreement?.problem ||
      agreement?.symptom ||
      services.join(", ") ||
      "",
    date: timestamp,
    ticketStates: [0],
    technicions: [startedBy],
    details: baseDetails,
    deviceStuff:
      agreement?.deviceStuff ||
      agreement?.deviceContents ||
      deviceInfo?.accessories ||
      "",
    notes:
      agreement?.notes ||
      agreement?.customerNotes ||
      agreement?.internalNotes ||
      "",
    countryCode: agreement?.countryCode || customer.countryCode || "962",
    services,
    onlineAgreementId: agreement?.id,
    agreementSource: "online",
    createdFromOnlineAgreement: true,
    shouldHaveInvoice: Boolean(agreement?.shouldHaveInvoice),
    hasAnInvoice: false,
    invoiceStatus: "Pending",
    onlineAgreementMetadata: {
      createdAt: agreement?.createdAt || null,
      signedAt: agreement?.signedAt || null,
    },
  };

  if (agreementDownloadUrl) {
    ticketPayload.onlineAgreementPdfURL = agreementDownloadUrl;
  }

  if (contractStoragePath) {
    ticketPayload.contractURL = contractStoragePath;
  }

  if (agreement?.customerAddress || customer.address) {
    ticketPayload.customerAddress =
      agreement?.customerAddress || customer.address || "";
  }

  if (isBusinessCustomer) {
    ticketPayload.customerType = "business";
  }

  if (Array.isArray(deviceInfo.attachments) && deviceInfo.attachments.length) {
    ticketPayload.mediaURLs = deviceInfo.attachments;
  }

  return ticketPayload;
};

const resolveAgreementCustomerDetails = (agreement) => {
  const customer = agreement?.customer || {};
  const nameCandidate =
    customer.name ||
    customer.fullName ||
    agreement?.customerName ||
    agreement?.name ||
    "";
  const emailCandidate =
    customer.email || agreement?.customerEmail || agreement?.email || "";
  const phoneCandidate =
    customer.phone ||
    agreement?.customerPhone ||
    agreement?.phone ||
    customer.mobile ||
    "";

  return {
    name: nameCandidate || "Valued customer",
    email: typeof emailCandidate === "string" ? emailCandidate.trim() : "",
    phone: typeof phoneCandidate === "string" ? phoneCandidate.trim() : "",
  };
};

const describeAgreementDevice = (agreement) => {
  const deviceInfo = agreement?.deviceInfo || {};
  return (
    agreement?.device ||
    deviceInfo.selectionDescription ||
    deviceInfo.device ||
    deviceInfo.model ||
    "your device"
  );
};

const BRANCH_LABELS = {
  M: "Amman service center",
  I: "Irbid service center",
};

const sendOnlineAgreementDecisionEmail = async ({
  agreement,
  decision,
  ticketNumber,
  locationCode,
  technicianName,
}) => {
  const { name, email } = resolveAgreementCustomerDetails(agreement);
  if (!email) {
    return {
      success: false,
      message:
        "No customer email on file. Please notify the customer manually.",
    };
  }

  const deviceLabel = describeAgreementDevice(agreement);
  const submittedLabel = formatAgreementDate(agreement);
  const branchLabel =
    BRANCH_LABELS[locationCode] || "365 Solutions service center";

  const subject =
    decision === "accept"
      ? `Ticket ${ticketNumber} created – 365 Solutions`
      : "Update on your 365 Solutions online request";

  const introCopy =
    decision === "accept"
      ? `We're happy to let you know that your online request has been converted into ticket <strong>${ticketNumber}</strong> at our ${branchLabel}.`
      : "Thank you for submitting your online request. After reviewing the information we could not proceed with it at this time.";

  const followUpCopy =
    decision === "accept"
      ? "Our team will keep you posted about progress. If you need to share more details just reply to this email."
      : "Please reply to this email or call us so we can help you schedule a visit or gather more information.";

  const ticketLine =
    decision === "accept" && ticketNumber
      ? `<li><strong>Ticket:</strong> ${ticketNumber}</li>`
      : "";
  const trackingParagraph =
    decision === "accept" && ticketNumber
      ? `<p>You can track your service anytime at <a href="https://www.365solutionsjo.com" target="_blank" rel="noopener noreferrer">www.365solutionsjo.com</a> using ticket ID <strong>${ticketNumber}</strong>.</p>`
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hi ${name},</p>
      <p>${introCopy}</p>
      <p>${followUpCopy}</p>
      <p><strong>Request summary</strong></p>
      <ul>
        ${ticketLine}
        <li><strong>Device:</strong> ${deviceLabel}</li>
        <li><strong>Submitted:</strong> ${submittedLabel}</li>
      </ul>
      ${trackingParagraph}
      <p>If you have any questions, reply to this email or call us at +962 79 681 8189.</p>
      <p>Best regards,<br/>365 Solutions Team</p>
    </div>
  `;

  try {
    const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const apiMessage =
        payload?.error?.message || payload?.error || response.statusText;
      throw new Error(apiMessage || "Failed to send customer email.");
    }

    return {
      success: true,
      message: `Email sent to ${email}.`,
    };
  } catch (error) {
    console.error("Failed to send online agreement email", error);
    return {
      success: false,
      message: error?.message || "Failed to send customer email.",
    };
  }
};

const parseAgreementDate = (record) => {
  if (!record) return null;

  if (record.signedAt) {
    const signedDate = new Date(record.signedAt);
    if (!Number.isNaN(signedDate.getTime())) {
      return signedDate;
    }
  }

  const createdAt = record.createdAt;
  if (createdAt) {
    if (typeof createdAt.toDate === "function") {
      const createdDate = createdAt.toDate();
      if (!Number.isNaN(createdDate.getTime())) {
        return createdDate;
      }
    } else if (createdAt.seconds) {
      const secondsDate = new Date(createdAt.seconds * 1000);
      if (!Number.isNaN(secondsDate.getTime())) {
        return secondsDate;
      }
    } else {
      const fallbackDate = new Date(createdAt);
      if (!Number.isNaN(fallbackDate.getTime())) {
        return fallbackDate;
      }
    }
  }

  return null;
};

const formatAgreementDate = (record) => {
  const date = record?.agreementDate || parseAgreementDate(record);
  if (!date) return "Pending signature";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const OnlineAgreementCard = ({
  agreement,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}) => {
  const customerName =
    agreement.customer?.name || agreement.customerName || "Unnamed customer";
  const customerMeta =
    agreement.customer?.email ||
    agreement.customer?.phone ||
    agreement.customerEmail ||
    "";
  const deviceName =
    agreement.device ||
    agreement.deviceInfo?.selectionDescription ||
    agreement.deviceInfo?.device ||
    "—";
  const issue =
    agreement.deviceInfo?.problemDetails ||
    agreement.deviceInfo?.selectionDescription ||
    "—";
  const locationName =
    agreement.deviceInfo?.locationName || agreement.deviceInfo?.location || "—";
  const serial = agreement.deviceInfo?.serialOrImei;
  const services = Array.isArray(agreement.services)
    ? agreement.services.filter(Boolean)
    : [];
  const customerAddress =
    agreement.customer?.address || agreement.customerAddress || "";
  const customerPhone =
    agreement.customer?.phone ||
    agreement.customer?.mobile ||
    agreement.customerPhone ||
    agreement.phone ||
    "";
  const companyName =
    agreement.customer?.company ||
    agreement.companyName ||
    agreement.company?.name ||
    "";
  const customerType = companyName ? "business" : "personal";
  const { downloadUrl: agreementUrl } = resolveAgreementFileInfo(agreement);
  const isPdfAvailable = Boolean(agreementUrl);
  const CardWrapper = isPdfAvailable ? "a" : "div";
  const [selectedLocation, setSelectedLocation] = useState(
    inferAgreementLocationCode(agreement),
  );
  const normalizedInitialWarranty =
    typeof agreement.warrantyStatus === "string"
      ? agreement.warrantyStatus.trim()
      : "";
  const warrantyOptions =
    normalizedInitialWarranty &&
    !WARRANTY_OPTIONS.includes(normalizedInitialWarranty)
      ? [normalizedInitialWarranty, ...WARRANTY_OPTIONS]
      : WARRANTY_OPTIONS;
  const [selectedWarranty, setSelectedWarranty] = useState(
    normalizedInitialWarranty,
  );

  const cardProps = isPdfAvailable
    ? {
        href: agreementUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `Open agreement for ${customerName}`,
      }
    : {
        role: "group",
        tabIndex: -1,
        "aria-label": `Agreement for ${customerName} is pending`,
        "aria-disabled": true,
      };

  const handleAccept = () => {
    if (!selectedLocation || !selectedWarranty || !onAccept) return;
    onAccept(agreement, selectedLocation, selectedWarranty);
  };

  const handleReject = () => {
    if (!onReject) return;
    onReject(agreement);
  };

  return (
    <div
      className={`online-agreement-card ${
        isPdfAvailable ? "" : "online-agreement-card--disabled"
      }`}
    >
      <CardWrapper className="online-agreement-card__body" {...cardProps}>
        <div className="online-agreement-card__header">
          <div>
            <strong>{customerName}</strong>
            {customerMeta && (
              <div className="online-agreement-card__sub">{customerMeta}</div>
            )}
          </div>
          <span className="online-agreement-card__date">
            {formatAgreementDate(agreement)}
          </span>
        </div>

        <div className="online-agreement-card__row">
          <span>Device:</span>
          <strong>{deviceName}</strong>
        </div>
        <div className="online-agreement-card__row">
          <span>Issue:</span>
          <strong>{issue}</strong>
        </div>
        <div className="online-agreement-card__row">
          <span>Preferred location:</span>
          <strong>{locationName}</strong>
        </div>
        {customerPhone && (
          <div className="online-agreement-card__row">
            <span>Phone:</span>
            <strong>{customerPhone}</strong>
          </div>
        )}
        {customerAddress && (
          <div className="online-agreement-card__row">
            <span>Address:</span>
            <strong>{customerAddress}</strong>
          </div>
        )}
        {companyName && (
          <div className="online-agreement-card__row">
            <span>Company:</span>
            <strong>{companyName}</strong>
          </div>
        )}
        {serial && (
          <div className="online-agreement-card__row">
            <span>Serial / IMEI:</span>
            <strong>{serial}</strong>
          </div>
        )}

        {services.length > 0 && (
          <div className="online-agreement-card__services">
            {services.map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>
        )}

        <div className="online-agreement-card__actions">
          <span className="online-agreement-card__link">
            {isPdfAvailable ? "View Agreement PDF" : "Agreement pending"}
          </span>
        </div>
      </CardWrapper>

      <div className="online-agreement-card__workflow">
        <div className="online-agreement-card__location">
          <label htmlFor={`online-agreement-location-${agreement.id}`}>
            Service location
          </label>
          <select
            id={`online-agreement-location-${agreement.id}`}
            className="online-agreement-card__select"
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
            disabled={isAccepting || isRejecting}
          >
            <option value="">Select location</option>
            <option value="M">Amman</option>
            <option value="I">Irbid</option>
          </select>
        </div>
        <div className="online-agreement-card__warranty">
          <label htmlFor={`online-agreement-warranty-${agreement.id}`}>
            Warranty status
          </label>
          <select
            id={`online-agreement-warranty-${agreement.id}`}
            className="online-agreement-card__select"
            value={selectedWarranty}
            onChange={(event) => setSelectedWarranty(event.target.value)}
            disabled={isAccepting || isRejecting}
          >
            <option value="">Select warranty status</option>
            {warrantyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="online-agreement-card__buttons">
          <button
            type="button"
            className="online-agreement-card__button online-agreement-card__button--accept"
            onClick={handleAccept}
            disabled={
              !selectedLocation ||
              !selectedWarranty ||
              isAccepting ||
              isRejecting ||
              !onAccept
            }
          >
            {isAccepting ? "Accepting..." : "Accept"}
          </button>
          <button
            type="button"
            className="online-agreement-card__button online-agreement-card__button--reject"
            onClick={handleReject}
            disabled={isAccepting || isRejecting || !onReject}
          >
            {isRejecting ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + weekIndex * 7 + dayIndex);
      days.push(current);
    }
    weeks.push(days);
  }
  return weeks;
};

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

const AppointmentsCalendar = ({
  isOpen,
  onClose,
  appointments,
  loading,
  error,
  onRetry,
  onAcceptAppointment,
  onRejectAppointment,
  actionState,
  onResetActionState,
}) => {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    now.setDate(1);
    return now;
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const reset = new Date();
      reset.setDate(1);
      setViewDate(reset);
      setSelectedAppointment(null);
      setIsDetailsVisible(false);
      onResetActionState?.();
    }
  }, [isOpen, onResetActionState]);

  useEffect(() => {
    if (
      selectedAppointment &&
      !appointments.some((appt) => appt.id === selectedAppointment.id)
    ) {
      setSelectedAppointment(null);
      setIsDetailsVisible(false);
      onResetActionState?.();
    }
  }, [appointments, onResetActionState, selectedAppointment]);

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
  };

  const handleAppointmentKeyDown = (event, appointment) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleAppointmentClick(appointment);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsVisible(false);
    setSelectedAppointment(null);
    onResetActionState?.();
  };

  if (!isOpen) return null;

  const monthLabel = viewDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="appointments-overlay" role="dialog" aria-modal="true">
      <div className="appointments-modal">
        <div className="appointments-modal__header">
          <h2>Appointments</h2>
          <button
            type="button"
            className="appointments-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="appointments-calendar__controls">
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

        {loading ? (
          <div className="appointments-calendar__status">
            Loading appointments…
          </div>
        ) : error ? (
          <div className="appointments-calendar__status appointments-calendar__status--error">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : (
          <div
            className={`appointments-body ${
              isDetailsVisible ? "appointments-body--with-details" : ""
            }`}
          >
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
                <div className="appointments-week" key={`week-${weekIndex}`}>
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
                          {dayAppointments.map((appointmentItem, idx) => {
                            const isActive =
                              selectedAppointment?.id === appointmentItem.id;
                            return (
                              <div
                                key={appointmentItem.id || `${key}-${idx}`}
                                role="button"
                                tabIndex={0}
                                className={`appointments-day__item ${
                                  isActive
                                    ? "appointments-day__item--active"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleAppointmentClick(appointmentItem.raw)
                                }
                                onKeyDown={(event) =>
                                  handleAppointmentKeyDown(
                                    event,
                                    appointmentItem.raw,
                                  )
                                }
                              >
                                {appointmentItem.timeLabel && (
                                  <span className="appointments-day__time">
                                    {appointmentItem.timeLabel}
                                  </span>
                                )}
                                <span className="appointments-day__title">
                                  {appointmentItem.summary}
                                </span>
                              </div>
                            );
                          })}
                          {dayAppointments.length === 0 && (
                            <span className="appointments-day__empty">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {isDetailsVisible && selectedAppointment && (
              <AppointmentDetailsPanel
                appointment={selectedAppointment}
                onClose={handleCloseDetails}
                onAccept={
                  onAcceptAppointment
                    ? () => onAcceptAppointment(selectedAppointment)
                    : undefined
                }
                onReject={
                  onRejectAppointment
                    ? () => onRejectAppointment(selectedAppointment)
                    : undefined
                }
                actionState={actionState}
              />
            )}
          </div>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="appointments-calendar__status appointments-calendar__status--empty">
            No appointments found.
          </div>
        )}
      </div>
    </div>
  );
};

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [onlineTickets, setOnlineTickets] = useState([]);
  const [filteredOnlineTickets, setFilteredOnlineTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineLoading, setOnlineLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState("All");
  const [showAppointmentsCalendar, setShowAppointmentsCalendar] =
    useState(false);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [appointmentActionState, setAppointmentActionState] = useState({
    isProcessing: false,
    action: null,
    error: "",
    success: "",
  });
  const hasRequestedAppointmentsRef = useRef(false);
  const [acceptingAgreementId, setAcceptingAgreementId] = useState(null);
  const [rejectingAgreementId, setRejectingAgreementId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Search state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all"); // all, ticketNumber, date, machineType, customerName

  const navigate = useNavigate();
  const { id: selectedTicketId } = useParams();
  const { technician } = useUser();
  const currentTechnicianName =
    technician?.name ||
    technician?.fullName ||
    technician?.displayName ||
    technician?.email ||
    "Online Intake Portal";

  const isOnlineView = locationFilter === "Online";
  const activeTickets = isOnlineView ? filteredOnlineTickets : filteredTickets;
  const selectedTicket = isOnlineView
    ? undefined
    : activeTickets.find((t) => t.id === selectedTicketId);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartNum, setExportStartNum] = useState("");
  const [exportEndNum, setExportEndNum] = useState("");
  const [exportMode, setExportMode] = useState("ticketNumber"); // "ticketNumber" or "date"
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const exportRef = useRef();

  const hasOnlineTickets = onlineTickets.length > 0;
  const hasAppointments = appointments.length > 0;
  const showAdminAlert = hasOnlineTickets || hasAppointments;
  const pendingSummaryParts = [];
  if (hasOnlineTickets) {
    pendingSummaryParts.push(
      `${onlineTickets.length} online ${
        onlineTickets.length === 1 ? "ticket" : "tickets"
      }`,
    );
  }
  if (hasAppointments) {
    pendingSummaryParts.push(
      `${appointments.length} appointment${
        appointments.length === 1 ? "" : "s"
      }`,
    );
  }
  const pendingSummaryVerb = pendingSummaryParts.length === 1 ? "is" : "are";
  const pendingSummaryText = pendingSummaryParts.join(" and ");

  useEffect(() => {
    const ticketsRef = collection(db, "tickets");
    const unsubscribe = onSnapshot(
      ticketsRef,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        const sorted = data.sort((a, b) => b.ticketNum - a.ticketNum);
        setTickets(sorted);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching tickets:", err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setOnlineLoading(true);
    const onlineRef = collection(db, "onlineTickets");
    const unsubscribe = onSnapshot(
      onlineRef,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const record = docSnap.data();
          const agreementDate = parseAgreementDate(record);
          return {
            id: docSnap.id,
            ...record,
            agreementDate,
          };
        });
        data.sort((a, b) => {
          const timeA = a.agreementDate?.getTime?.() || 0;
          const timeB = b.agreementDate?.getTime?.() || 0;
          return timeB - timeA;
        });
        setOnlineTickets(data);
        setOnlineLoading(false);
      },
      (err) => {
        console.error("Error fetching online tickets:", err);
        setOnlineLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (locationFilter === "Online") {
      let filtered = onlineTickets;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((agreement) => {
          const searchableValues = [
            agreement.customerName,
            agreement.customer?.name,
            agreement.customer?.email,
            agreement.customer?.phone,
            agreement.customer?.company,
            agreement.device,
            agreement.deviceInfo?.problemDetails,
            agreement.deviceInfo?.selectionDescription,
            agreement.deviceInfo?.serialOrImei,
            agreement.deviceInfo?.locationName,
            agreement.deviceInfo?.location,
            Array.isArray(agreement.services)
              ? agreement.services.join(" ")
              : undefined,
          ]
            .filter((value) => typeof value === "string")
            .map((value) => value.toLowerCase());

          return searchableValues.some((value) => value.includes(query));
        });
      }

      setFilteredOnlineTickets(filtered);
      setCurrentPage(1);
      return;
    }

    let filtered = tickets;

    if (locationFilter === "Amman") {
      filtered = filtered.filter((ticket) => ticket.location === "M");
    } else if (locationFilter === "Irbid") {
      filtered = filtered.filter((ticket) => ticket.location === "I");
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      filtered = filtered.filter((ticket) => {
        switch (searchType) {
          case "ticketNumber": {
            const ticketNumber = `${ticket.location}${ticket.ticketNum}`;
            return ticketNumber.toLowerCase().includes(query);
          }
          case "date":
            return ticket.date && ticket.date.toLowerCase().includes(query);
          case "machineType":
            return (
              ticket.machineType &&
              ticket.machineType.toLowerCase().includes(query)
            );
          case "customerName":
            return (
              ticket.customerName &&
              ticket.customerName.toLowerCase().includes(query)
            );
          case "all":
          default: {
            const ticketNum = `${ticket.location}${ticket.ticketNum}`;
            return (
              ticketNum.toLowerCase().includes(query) ||
              (ticket.date && ticket.date.toLowerCase().includes(query)) ||
              (ticket.machineType &&
                ticket.machineType.toLowerCase().includes(query)) ||
              (ticket.customerName &&
                ticket.customerName.toLowerCase().includes(query)) ||
              (ticket.symptom &&
                ticket.symptom.toLowerCase().includes(query)) ||
              (ticket.emailAddress &&
                ticket.emailAddress.toLowerCase().includes(query)) ||
              (ticket.mobileNumber &&
                ticket.mobileNumber.toLowerCase().includes(query))
            );
          }
        }
      });
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [locationFilter, tickets, onlineTickets, searchQuery, searchType]);

  const totalPages = Math.ceil(activeTickets.length / TICKETS_PER_PAGE);
  const currentTickets = activeTickets.slice(
    (currentPage - 1) * TICKETS_PER_PAGE,
    currentPage * TICKETS_PER_PAGE,
  );

  const handleCardClick = (ticket) => {
    navigate(`/tickets/${ticket.id}`);
  };

  const handleNewTicket = () => {
    navigate("/tickets/new"); // or whatever route you use for creating tickets
  };

  const handleExportExcel = () => {
    setShowExportModal(true);
  };

  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError("");
    try {
      const snapshot = await getDocs(collection(db, "appointments"));
      const data = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter(isAppointmentAvailable);

      setAppointments(data);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setAppointmentsError("Failed to load appointments. Please try again.");
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!showAppointmentsCalendar) {
      hasRequestedAppointmentsRef.current = false;
    }
  }, [showAppointmentsCalendar]);

  useEffect(() => {
    if (
      showAppointmentsCalendar &&
      !appointmentsLoading &&
      appointments.length === 0 &&
      !appointmentsError &&
      !hasRequestedAppointmentsRef.current
    ) {
      hasRequestedAppointmentsRef.current = true;
      fetchAppointments();
    }
  }, [
    showAppointmentsCalendar,
    appointmentsLoading,
    appointments.length,
    appointmentsError,
    fetchAppointments,
  ]);

  const handleToggleAppointments = () => {
    setShowAppointmentsCalendar((prev) => !prev);
  };

  const resetAppointmentActionState = useCallback(() => {
    setAppointmentActionState({
      isProcessing: false,
      action: null,
      error: "",
      success: "",
    });
  }, []);

  const sendAppointmentDecisionEmail = useCallback(
    async (appointment, decision) => {
      const details = resolveAppointmentDetails(appointment);
      const recipient = details.customerEmail?.trim();
      if (!recipient) {
        return (
          "No customer email on file." +
          " The status was updated, but please notify the customer manually."
        );
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
        body: JSON.stringify({
          to: recipient,
          subject,
          html,
        }),
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
        } catch (err) {
          console.error("Failed to parse email error response", err);
        }
        throw new Error(errorMessage);
      }

      return `Email sent to ${recipient}.`;
    },
    [currentTechnicianName],
  );

  const handleAppointmentDecision = useCallback(
    async (appointment, decision) => {
      if (!appointment?.id) return;
      setAppointmentActionState({
        isProcessing: true,
        action: decision,
        error: "",
        success: "",
      });

      try {
        const emailMessage = await sendAppointmentDecisionEmail(
          appointment,
          decision,
        );
        const docRef = doc(db, "appointments", appointment.id);
        await deleteDoc(docRef);
        setAppointments((prev) =>
          prev.filter((item) => item.id !== appointment.id),
        );
        const outcomeMessage =
          decision === "accept"
            ? "Appointment accepted and removed."
            : "Appointment rejected and removed.";
        setAppointmentActionState({
          isProcessing: false,
          action: null,
          error: "",
          success: `${outcomeMessage} ${emailMessage || ""}`.trim(),
        });
      } catch (error) {
        console.error("Failed to process appointment decision", error);
        setAppointmentActionState({
          isProcessing: false,
          action: null,
          error:
            error?.message ||
            "Something went wrong while handling the appointment.",
          success: "",
        });
      }
    },
    [currentTechnicianName, sendAppointmentDecisionEmail],
  );

  const handleAcceptAppointment = useCallback(
    (appointment) => {
      handleAppointmentDecision(appointment, "accept");
    },
    [handleAppointmentDecision],
  );

  const handleRejectAppointment = useCallback(
    (appointment) => {
      handleAppointmentDecision(appointment, "reject");
    },
    [handleAppointmentDecision],
  );

  const removeAgreementFromLists = (agreementId) => {
    if (!agreementId) return;
    setOnlineTickets((prev) => prev.filter((item) => item.id !== agreementId));
    setFilteredOnlineTickets((prev) =>
      prev.filter((item) => item.id !== agreementId),
    );
  };

  const fetchNextTicketNumber = async () => {
    const ticketNumDocRef = doc(db, "ticketnumber", TICKET_NUMBER_DOC_ID);
    let nextNumber = null;
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ticketNumDocRef);
      if (!snapshot.exists()) {
        nextNumber = 1000;
        transaction.set(ticketNumDocRef, { number: nextNumber });
      } else {
        const current = snapshot.data().number || 1000;
        nextNumber = current + 1;
        transaction.update(ticketNumDocRef, { number: nextNumber });
      }
    });
    return nextNumber;
  };

  const handleAcceptAgreement = async (
    agreement,
    locationCode,
    warrantyStatus,
  ) => {
    if (!agreement?.id) {
      alert("Agreement is missing an identifier.");
      return;
    }
    if (!locationCode) {
      alert("Please select a location before accepting the agreement.");
      return;
    }
    if (!warrantyStatus) {
      alert("Please select a warranty status before accepting the agreement.");
      return;
    }

    const normalizedLocation = locationCode.toUpperCase();
    if (!["M", "I"].includes(normalizedLocation)) {
      alert("Please select a valid location (Amman or Irbid).");
      return;
    }
    const normalizedWarranty = warrantyStatus.trim();
    if (!normalizedWarranty) {
      alert("Please select a warranty status before accepting the agreement.");
      return;
    }

    setAcceptingAgreementId(agreement.id);
    try {
      const ticketNum = await fetchNextTicketNumber();
      const ticketId = `${normalizedLocation}${ticketNum}${generate3DigitNumber()}`;
      const ticketNumberLabel = `${normalizedLocation}${ticketNum}`;
      const { downloadUrl, storagePath } = resolveAgreementFileInfo(agreement);
      const ticketPayload = mapOnlineAgreementToTicket({
        agreement,
        locationCode: normalizedLocation,
        ticketNum,
        ticketId,
        contractStoragePath: storagePath,
        agreementDownloadUrl: downloadUrl,
        warrantyStatus: normalizedWarranty,
        technicianName: currentTechnicianName,
      });

      await setDoc(doc(db, "tickets", ticketId), ticketPayload);
      await deleteDoc(doc(db, "onlineTickets", agreement.id));
      removeAgreementFromLists(agreement.id);
      const emailResult = await sendOnlineAgreementDecisionEmail({
        agreement,
        decision: "accept",
        ticketNumber: ticketId,
        locationCode: normalizedLocation,
        technicianName: currentTechnicianName,
      });
      alert(
        `Ticket ${ticketNumberLabel} created successfully for ${ticketPayload.customerName}.${
          emailResult.message ? `\n${emailResult.message}` : ""
        }`,
      );
    } catch (err) {
      console.error("Failed to accept online agreement:", err);
      alert("Failed to accept online agreement. Please try again.");
    } finally {
      setAcceptingAgreementId(null);
    }
  };

  const handleRejectAgreement = async (agreement) => {
    if (!agreement?.id) return;
    const confirmed = window.confirm(
      `Reject and delete the online agreement for ${agreement.customerName || agreement.customer?.name || "this customer"}?`,
    );
    if (!confirmed) return;

    setRejectingAgreementId(agreement.id);
    try {
      await deleteDoc(doc(db, "onlineTickets", agreement.id));
      removeAgreementFromLists(agreement.id);
      const emailResult = await sendOnlineAgreementDecisionEmail({
        agreement,
        decision: "reject",
        locationCode: inferAgreementLocationCode(agreement),
        technicianName: currentTechnicianName,
      });
      const rejectionNote = emailResult.message
        ? ` ${emailResult.message}`
        : "";
      alert(`Agreement rejected.${rejectionNote}`);
    } catch (err) {
      console.error("Failed to reject online agreement:", err);
      alert("Failed to delete online agreement. Please try again.");
    } finally {
      setRejectingAgreementId(null);
    }
  };

  // Helper to parse DD/MM/YYYY or YYYY-MM-DD to Date (UTC, no time)
  function parseTicketDate(dateStr) {
    if (!dateStr) return null;
    // Remove time if present (e.g., '15/10/2025, 08:37:31 PM' => '15/10/2025')
    const dateOnly = dateStr.split(",")[0].trim();
    if (dateOnly.includes("/")) {
      // DD/MM/YYYY
      const [day, month, year] = dateOnly.split("/");
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    } else if (dateOnly.includes("-")) {
      // YYYY-MM-DD
      const [year, month, day] = dateOnly.split("-");
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
    return null;
  }

  // Helper to compare only the date part (ignore time)
  function isDateInRange(ticketDate, fromDate, toDate) {
    if (!ticketDate || !fromDate || !toDate) return false;
    // All should be Date objects at UTC midnight
    return ticketDate >= fromDate && ticketDate <= toDate;
  }

  const handleConfirmExport = () => {
    let ticketsToExport = [];
    if (exportMode === "ticketNumber") {
      // Find indices for start and end ticketNum
      const startIdx = filteredTickets.findIndex(
        (t) => String(t.ticketNum) === exportStartNum,
      );
      const endIdx = filteredTickets.findIndex(
        (t) => String(t.ticketNum) === exportEndNum,
      );
      if (startIdx === -1 || endIdx === -1) {
        alert("Start or end ticket number not found in the filtered list.");
        return;
      }
      // Ensure startIdx <= endIdx
      const from = Math.min(startIdx, endIdx);
      const to = Math.max(startIdx, endIdx);
      ticketsToExport = filteredTickets.slice(from, to + 1);
    } else if (exportMode === "date") {
      if (!exportStartDate || !exportEndDate) {
        alert("Please select both start and end dates.");
        return;
      }
      const fromDate = parseTicketDate(exportStartDate);
      const toDate = parseTicketDate(exportEndDate);
      ticketsToExport = filteredTickets.filter((t, idx) => {
        const ticketDate = parseTicketDate(t.date);
        if (idx < 5) {
          console.log("Ticket:", t);
          console.log("Ticket date string:", t.date, "Parsed:", ticketDate);
          console.log(
            "Export range:",
            exportStartDate,
            exportEndDate,
            "Parsed:",
            fromDate,
            toDate,
          );
          console.log("In range:", isDateInRange(ticketDate, fromDate, toDate));
        }
        return isDateInRange(ticketDate, fromDate, toDate);
      });
      if (ticketsToExport.length === 0) {
        alert("No tickets found in the selected date range.");
        return;
      }
    }

    // Prepare data for Excel
    (async () => {
      const data = await Promise.all(
        ticketsToExport.map(async (t) => {
          const parts = await getPartsForTicket(t);
          return {
            TicketID: t.id,
            TicketNumber: `${t.location}${t.ticketNum}`,
            Date: t.date,
            CustomerName: t.customerName,
            OpenedBy:
              Array.isArray(t.technicions) && t.technicions.length > 0
                ? t.technicions[0]
                : "",
            Email: t.emailAddress,
            Mobile: t.mobileNumber,
            MachineType: t.machineType,
            DeviceDescription: t.deviceDescription,
            SerialNum: t.serialNum,
            WarrantyStatus: t.warrantyStatus,
            Symptom: t.symptom,
            RepairID: t.caseID,
            Notes: t.notes,
            Invoice:
              t.hasAnInvoice === true || t.shouldHaveInvoice ? "Yes" : "No",
            PartNumber1: parts[0]?.PartNumber || "",
            NewSerialNumber1: parts[0]?.newSerialNum || "",
            OldSerialNumber1: parts[0]?.oldSerialNumber || "",
            AmountPaid1: parts[0]?.price * parts[0]?.quantity || "",
            PartDescription1: parts[0]?.Description || "",
            PartNumber2: parts[1]?.PartNumber || "",
            NewSerialNumber2: parts[1]?.newSerialNum || "",
            OldSerialNumber2: parts[1]?.oldSerialNumber || "",
            AmountPaid2: parts[1]?.price * parts[1]?.quantity || "",
            PartDescription2: parts[1]?.Description || "",
            PartNumber3: parts[2]?.PartNumber || "",
            NewSerialNumber3: parts[2]?.newSerialNum || "",
            OldSerialNumber3: parts[2]?.oldSerialNumber || "",
            AmountPaid3: parts[2]?.price * parts[2]?.quantity || "",
            PartDescription3: parts[2]?.Description || "",
          };
        }),
      );
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tickets");
      let fileLabel =
        exportMode === "ticketNumber"
          ? `${exportStartNum}_to_${exportEndNum}`
          : `${exportStartDate}_to_${exportEndDate}`;
      XLSX.writeFile(wb, `tickets_export_${fileLabel}.xlsx`);
      setShowExportModal(false);
    })();

    // (removed duplicate XLSX export logic; all export is handled inside the async IIFE above)
  };

  const getPartsForTicket = async (ticket) => {
    if (!ticket.shouldHaveInvoice || !ticket.partDeliveryNote) return [];
    // Fetch the document, not a collection
    const docRef = doc(db, "partsDeliveryNotes", ticket.partDeliveryNote);
    const snap = await import("firebase/firestore").then(({ getDoc }) =>
      getDoc(docRef),
    );
    if (!snap.exists()) return [];
    const docData = snap.data();

    // If parts array exists, use it; else fallback to legacy arrays
    if (Array.isArray(docData.parts) && docData.parts.length > 0) {
      return docData.parts.map((part) => ({
        ...part,
        newSerialNum: part.newSN,
        PartNumber: part.partNumber,
        Description: part.description,
        oldSerialNumber: part.oldSN,
        price: part.price,
        quantity: part.quantity,
      }));
    } else if (
      Array.isArray(docData.partNumbers) &&
      Array.isArray(docData.prices) &&
      Array.isArray(docData.partDescriptions)
    ) {
      // Legacy format: reconstruct part objects from parallel arrays
      const count = Math.max(
        docData.partNumbers.length,
        docData.prices.length,
        docData.partDescriptions.length,
      );
      return Array.from({ length: count }).map((_, i) => ({
        PartNumber: docData.partNumbers[i] || "",
        Description:
          docData.partDescriptions[i] === ">"
            ? "service"
            : docData.partDescriptions[i],
        price: docData.prices[i] || "",
        quantity: (docData.qtys && docData.qtys[i]) || "",
        warrantyStatus:
          (docData.warrantyStatus && docData.warrantyStatus[i]) || "",
        newSerialNum:
          (docData.newSerialNumber && docData.newSerialNumber[i]) || "",
        oldSN: (docData.oldSerialNumber && docData.oldSerialNumber[i]) || "",
        service: (docData.services && docData.services[i]) || "",
      }));
    } else {
      return [];
    }
  };

  // Remove ticket from state after deletion
  const handleDeleteTicketFromList = (deletedId) => {
    setTickets((prev) => prev.filter((t) => t.id !== deletedId));
    setFilteredTickets((prev) => prev.filter((t) => t.id !== deletedId));
    navigate("/tickets");
  };

  const isLoading = isOnlineView ? onlineLoading : loading;
  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      {showAdminAlert && (
        <div className="tickets-admin-alert">
          <div className="tickets-admin-alert__message">
            Attention: There {pendingSummaryVerb} {pendingSummaryText} waiting
            for review.
          </div>
          <div className="tickets-admin-alert__actions">
            {hasOnlineTickets && (
              <button
                type="button"
                onClick={() => setLocationFilter("Online")}
                className="tickets-admin-alert__button"
              >
                Review Online Tickets
              </button>
            )}
            {hasAppointments && (
              <button
                type="button"
                onClick={() => setShowAppointmentsCalendar(true)}
                className="tickets-admin-alert__button secondary"
              >
                View Appointments
              </button>
            )}
          </div>
        </div>
      )}
      <div className="tickets-header">
        <div className="tickets-header-content">
          <div className="left-section">
            <div className="tickets-new">
              <h1>🎫 Tickets</h1>
              <button className="new-ticket-button" onClick={handleNewTicket}>
                + New Ticket
              </button>
            </div>
            <div className="search-controls">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="search-type-select"
              >
                <option value="all">All Fields</option>
                <option value="ticketNumber">Ticket Number</option>
                <option value="date">Date</option>
                <option value="machineType">Machine Type</option>
                <option value="customerName">Customer Name</option>
              </select>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="clear-search-button"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="filter-menu">
              {LOCATION_FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setLocationFilter(value)}
                  style={{
                    marginRight: "10px",
                    padding: "8px 16px",
                    backgroundColor:
                      locationFilter === value ? "#1ccad4" : "#f0f0f0",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className="appointments-view-button"
                onClick={handleToggleAppointments}
                type="button"
              >
                Appointments
              </button>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                ◀
              </button>
              <span style={{ margin: "0 10px" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                ▶
              </button>
              <button
                className="export-excel-button"
                onClick={handleExportExcel}
                style={{
                  marginLeft: "16px",
                  background: "#1ccad4",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Export to Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Results Counter */}
      {searchQuery && (
        <div className="search-results-info">
          Found {activeTickets.length} ticket
          {activeTickets.length !== 1 ? "s" : ""}
          {searchType !== "all" &&
            ` in ${searchType.replace(/([A-Z])/g, " $1").toLowerCase()}`}
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}

      {/* Main container */}

      {/* <div className="tickets-container">
        <div className={`tickets-list ${selectedTicket ? "shrink" : ""}`}>
          {currentTickets.length === 0 ? (
            <p>No tickets found.</p>
          ) : (
            currentTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={ticket.id === selectedTicketId}
                onClick={() => handleCardClick(ticket)}
              />
            ))
          )}
        </div>

        {selectedTicket && <TicketDetail ticket={selectedTicket} />}
      </div> */}

      <div className="tickets-page-wrapper">
        <div
          className={`ticket-list-panel ${
            selectedTicket && !isOnlineView ? "shrink" : "full-width"
          }`}
        >
          {currentTickets.length === 0 ? (
            <p>No {isOnlineView ? "online agreements" : "tickets"} found.</p>
          ) : isOnlineView ? (
            currentTickets.map((agreement) => (
              <OnlineAgreementCard
                key={agreement.id}
                agreement={agreement}
                onAccept={handleAcceptAgreement}
                onReject={handleRejectAgreement}
                isAccepting={acceptingAgreementId === agreement.id}
                isRejecting={rejectingAgreementId === agreement.id}
              />
            ))
          ) : (
            currentTickets.map((ticket) => (
              <div key={ticket.id}>
                <TicketCard
                  ticket={ticket}
                  isSelected={ticket.id === selectedTicketId}
                  onClick={() => handleCardClick(ticket)}
                />
                {/* On small screens, show TicketDetail below the selected card */}
                {selectedTicket && ticket.id === selectedTicketId && (
                  <div className="ticket-detail-mobile">
                    <TicketDetail
                      ticket={selectedTicket}
                      onClose={() => {
                        navigate("/tickets");
                      }}
                      onDelete={handleDeleteTicketFromList}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!isOnlineView && selectedTicket && (
          <div className="ticket-detail-fixed-style">
            <TicketDetail
              ticket={selectedTicket}
              onClose={() => {
                navigate("/tickets");
              }}
              onDelete={handleDeleteTicketFromList}
            />
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="modal-overlay" ref={exportRef}>
          <div className="modal-content">
            <h3>Export Tickets to Excel</h3>
            <label>
              Export Mode:
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value)}
                style={{ marginLeft: "8px", width: "180px" }}
              >
                <option value="ticketNumber">By Ticket Number</option>
                <option value="date">By Date</option>
              </select>
            </label>
            <br />
            {exportMode === "ticketNumber" ? (
              <>
                <label>
                  Start Ticket Number:
                  <input
                    type="text"
                    value={exportStartNum}
                    onChange={(e) => setExportStartNum(e.target.value)}
                    style={{ marginLeft: "8px", width: "120px" }}
                    placeholder="e.g. 111097"
                  />
                </label>
                <br />
                <label>
                  End Ticket Number:
                  <input
                    type="text"
                    value={exportEndNum}
                    onChange={(e) => setExportEndNum(e.target.value)}
                    style={{ marginLeft: "8px", width: "120px" }}
                    placeholder="e.g. 111101"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Start Date:
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    style={{ marginLeft: "8px", width: "160px" }}
                  />
                </label>
                <br />
                <label>
                  End Date:
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    style={{ marginLeft: "8px", width: "160px" }}
                  />
                </label>
              </>
            )}
            <br />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button
                onClick={handleConfirmExport}
                style={{
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Export
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: "#ccc",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ marginTop: "12px", color: "#888" }}>
              Number of tickets to export:{" "}
              {(() => {
                if (exportMode === "ticketNumber") {
                  const startIdx = filteredTickets.findIndex(
                    (t) => String(t.ticketNum) === exportStartNum,
                  );
                  const endIdx = filteredTickets.findIndex(
                    (t) => String(t.ticketNum) === exportEndNum,
                  );
                  if (startIdx === -1 || endIdx === -1) return 0;
                  return Math.abs(endIdx - startIdx) + 1;
                } else if (exportMode === "date") {
                  if (!exportStartDate || !exportEndDate) return 0;
                  const fromDate = parseTicketDate(exportStartDate);
                  const toDate = parseTicketDate(exportEndDate);
                  return filteredTickets.filter((t) => {
                    const ticketDate = parseTicketDate(t.date);
                    return isDateInRange(ticketDate, fromDate, toDate);
                  }).length;
                }
                return 0;
              })()}
            </p>
          </div>
        </div>
      )}

      <AppointmentsCalendar
        isOpen={showAppointmentsCalendar}
        onClose={handleToggleAppointments}
        appointments={appointments}
        loading={appointmentsLoading}
        error={appointmentsError}
        onRetry={fetchAppointments}
        onAcceptAppointment={handleAcceptAppointment}
        onRejectAppointment={handleRejectAppointment}
        actionState={appointmentActionState}
        onResetActionState={resetAppointmentActionState}
      />
    </div>
  );
};

export default Tickets;
