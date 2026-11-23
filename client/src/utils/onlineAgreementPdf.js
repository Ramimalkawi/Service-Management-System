// Stamps the official ticket number onto a signed online service agreement.
//
// - If the PDF already has the "Service Agreement - Signature Record" page,
//   the temporary "Online request no." value is replaced with the online
//   request number + the official ticket number.
// - If that page is missing, a new Signature Record page is appended with all
//   of the agreement's details, the ticket number and the customer signature.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pdfjs } from "react-pdf";
import { ref, getBytes } from "firebase/storage";

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

const COLORS = {
  title: rgb(0.16, 0.25, 0.55),
  label: rgb(0.45, 0.47, 0.52),
  text: rgb(0.08, 0.08, 0.1),
  muted: rgb(0.45, 0.47, 0.52),
  divider: rgb(0.86, 0.88, 0.92),
  ticket: rgb(0.1, 0.2, 0.55),
  white: rgb(1, 1, 1),
};

const ONL_PATTERN = /ONL-\d{4}-\d+/i;

// ---------------------------------------------------------------- helpers

const pick = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  }
  return "";
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && value.seconds) {
    return new Date(value.seconds * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatAmmanDateTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const formatted = date.toLocaleString("en-GB", {
    timeZone: "Asia/Amman",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatted} (Amman time)`;
};

const readStorageOrUrlBytes = async (storage, { storagePath, url }) => {
  const errors = [];
  if (storage && storagePath) {
    try {
      return await getBytes(ref(storage, storagePath));
    } catch (err) {
      errors.push(err);
    }
  }
  if (url) {
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1] || "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.arrayBuffer();
    } catch (err) {
      errors.push(err);
    }
  }
  throw new Error(
    `Could not download file (${errors.map((e) => e?.message).join("; ") || "no source"})`,
  );
};

const resolveOnlineRequestNumber = (agreement) =>
  pick(
    agreement?.onlineRequestNumber,
    agreement?.requestNumber,
    agreement?.requestNo,
    agreement?.onlineRequestNo,
    agreement?.referenceNumber,
    agreement?.reference,
    agreement?.tempTicketNumber,
    agreement?.temporaryTicketNumber,
  );

const resolveSignatureSource = (agreement) => {
  const candidates = [
    agreement?.signatureDataUrl,
    agreement?.signatureDataURL,
    agreement?.signatureUrl,
    agreement?.signatureURL,
    agreement?.customerSignatureURL,
    agreement?.customerSignatureUrl,
    typeof agreement?.signature === "string" ? agreement.signature : null,
    agreement?.signature?.url,
    agreement?.signature?.dataUrl,
    agreement?.customer?.signature,
    agreement?.customer?.signatureUrl,
    agreement?.storagePaths?.signature,
  ];
  const value = candidates.find((c) => typeof c === "string" && c.trim());
  if (!value) return null;
  const trimmed = value.trim();
  if (/^(https?:|data:)/i.test(trimmed)) return { url: trimmed };
  return { storagePath: trimmed.replace(/^gs:\/\/[^/]+\//, "").replace(/^\/+/, "") };
};

const embedImage = async (pdfDoc, bytes) => {
  const header = new Uint8Array(bytes.slice(0, 4));
  const isPng = header[0] === 0x89 && header[1] === 0x50;
  return isPng ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
};

// Text drawing: Helvetica for Latin text. Anything Helvetica cannot encode
// (e.g. Arabic names) is rendered by the browser on a canvas, which handles
// Arabic shaping and right-to-left order, and embedded as an image.
const CANVAS_FONT_FAMILY = "AgreementAmiri";
let canvasFontPromise = null;
const ensureCanvasFont = () => {
  if (canvasFontPromise) return canvasFontPromise;
  canvasFontPromise = (async () => {
    try {
      if (typeof FontFace === "undefined" || typeof document === "undefined") return;
      const face = new FontFace(CANVAS_FONT_FAMILY, "url(/fonts/Amiri-Regular.ttf)");
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      console.warn("Could not load Amiri font for agreement PDF", err);
    }
  })();
  return canvasFontPromise;
};

const toCssColor = (color) =>
  `rgb(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(
    color.blue * 255,
  )})`;

const createTextDrawer = async (pdfDoc) => {
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fits = (font, text) => {
    try {
      font.encodeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const renderTextImage = async (text, size, color, isBold) => {
    if (typeof document === "undefined") return null;
    await ensureCanvasFont();
    const scale = 4;
    const px = size * scale;
    const fontCss = `${isBold ? "bold " : ""}${px}px ${CANVAS_FONT_FAMILY}, "Geeza Pro", "Segoe UI", Arial, sans-serif`;
    const isRtl = /^[^A-Za-z]*[\u0590-\u08FF]/.test(text);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = fontCss;
    const width = Math.ceil(ctx.measureText(text).width) + 8;
    const height = Math.ceil(px * 1.7);
    const baselineFromTop = px * 1.2;
    canvas.width = width;
    canvas.height = height;
    ctx.font = fontCss;
    ctx.direction = isRtl ? "rtl" : "ltr";
    ctx.textAlign = isRtl ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = toCssColor(color);
    ctx.fillText(text, isRtl ? width - 4 : 4, baselineFromTop);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    const image = await pdfDoc.embedPng(await blob.arrayBuffer());
    return {
      image,
      width: width / scale,
      height: height / scale,
      descent: (height - baselineFromTop) / scale,
      padLeft: 4 / scale,
    };
  };

  /**
   * Draws `text` with its baseline at `y`, wrapping at `maxWidth`.
   * Returns the number of lines used.
   */
  const draw = async (
    page,
    text,
    { x, y, size, color = COLORS.text, isBold = false, maxWidth = Infinity, lineGap = size * 1.3 },
  ) => {
    const font = isBold ? bold : regular;
    const value = String(text ?? "");
    if (fits(font, value)) {
      const lines = wrapText(value, font, size, maxWidth);
      lines.forEach((line, index) => {
        page.drawText(line, { x, y: y - index * lineGap, size, font, color });
      });
      return lines.length;
    }

    const rendered = await renderTextImage(value, size, color, isBold).catch((err) => {
      console.warn("Could not render text as image", err);
      return null;
    });
    if (rendered) {
      const shrink = Math.min(1, maxWidth / rendered.width);
      page.drawImage(rendered.image, {
        x: x - rendered.padLeft * shrink,
        y: y - rendered.descent * shrink,
        width: rendered.width * shrink,
        height: rendered.height * shrink,
      });
      return 1;
    }

    // Last resort (no browser canvas): replace unsupported characters.
    const safe = Array.from(value)
      .map((ch) => (fits(font, ch) ? ch : "?"))
      .join("");
    const lines = wrapText(safe, font, size, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * lineGap, size, font, color });
    });
    return lines.length;
  };

  return { regular, bold, draw };
};

const wrapText = (text, font, size, maxWidth) => {
  const lines = [];
  const paragraphs = String(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break very long single words.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) {
          cut -= 1;
        }
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
};

// ------------------------------------------------- find existing record page

const multiplyMatrix = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

// The online portal renders field values as images (so Arabic text keeps its
// shaping). Collect the bounding boxes of every image drawn on the page.
const collectImageBoxes = async (page) => {
  const { OPS } = pdfjs;
  const operatorList = await page.getOperatorList();
  const boxes = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  operatorList.fnArray.forEach((fn, index) => {
    const args = operatorList.argsArray[index];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = multiplyMatrix(ctm, args);
    else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintJpegXObject
    ) {
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      boxes.push({
        x: Math.min(...xs),
        y: Math.min(...ys),
        right: Math.max(...xs),
        top: Math.max(...ys),
      });
    }
  });
  return boxes;
};

// Returns { onlNumber, record } where `record` describes the Signature Record
// page (null when the PDF doesn't have one).
const inspectAgreementPdf = async (pdfBytes) => {
  // Pass a copy: pdf.js transfers the buffer to its worker, which would leave
  // the original detached (empty) for pdf-lib afterwards.
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });
  const doc = await loadingTask.promise;
  try {
    const pages = [];
    let onlNumber = "";
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => typeof item.str === "string");
      const pageText = items.map((item) => item.str).join(" ");
      if (!onlNumber) onlNumber = (pageText.match(ONL_PATTERN) || [])[0] || "";
      pages.push({ page, pageNumber, items, pageText });
    }
    const recordPage = [...pages].reverse().find((p) => /Signature Record/i.test(p.pageText));
    return { onlNumber, record: recordPage ? await locateRequestRow(recordPage) : null };
  } finally {
    doc.destroy();
  }
};

const locateRequestRow = async ({ page, pageNumber, items }) => {
  const label = items.find((item) => /Online request no/i.test(item.str));
  if (!label) return { pageIndex: pageNumber - 1, row: null };

  const labelY = label.transform[5];
  const labelSize = label.height || Math.abs(label.transform[3]) || 9;
  const labelRight = label.transform[4] + (label.width || 0);
  const labelMid = labelY + labelSize * 0.35;

  // Value drawn as text...
  const valueItems = items.filter(
    (item) =>
      item !== label &&
      item.str.trim() &&
      Math.abs(item.transform[5] - labelY) < 3 &&
      item.transform[4] > labelRight,
  );
  const boxes = valueItems.map((item) => {
    const size = item.height || Math.abs(item.transform[3]) || labelSize;
    return {
      x: item.transform[4],
      right: item.transform[4] + (item.width || 0),
      y: item.transform[5] - size * 0.3,
      top: item.transform[5] + size,
    };
  });
  // ...or as an image on the same row.
  const imageBoxes = (await collectImageBoxes(page)).filter((box) => {
    const height = box.top - box.y;
    return (
      box.x > labelRight &&
      height < labelSize * 3 &&
      box.y - 2 <= labelMid &&
      box.top + 2 >= labelMid
    );
  });
  boxes.push(...imageBoxes);
  if (!boxes.length) return { pageIndex: pageNumber - 1, row: null };

  return {
    pageIndex: pageNumber - 1,
    row: {
      x: Math.min(...boxes.map((b) => b.x)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.min(...boxes.map((b) => b.y)),
      top: Math.max(...boxes.map((b) => b.top)),
      baseline: labelY,
      fontSize: labelSize,
      text: valueItems.map((item) => item.str).join(" "),
    },
  };
};

const stampExistingRecordPage = async (pdfDoc, fonts, found, ticketNumber, onlNumberFromPdf, agreement) => {
  const page = pdfDoc.getPage(found.pageIndex);
  const { width: pageWidth } = page.getSize();

  if (!found.row) {
    // Page exists but the row layout is unknown: add a clear stamp at the top.
    const text = `Official ticket no.: ${ticketNumber}`;
    page.drawText(text, {
      x: pageWidth - 48 - fonts.bold.widthOfTextAtSize(text, 11),
      y: page.getSize().height - 40,
      size: 11,
      font: fonts.bold,
      color: COLORS.ticket,
    });
    return;
  }

  const { row } = found;
  const size = Math.min(Math.max(row.fontSize, 8), 12);
  const onlNumber =
    (row.text.match(ONL_PATTERN) || [])[0] ||
    onlNumberFromPdf ||
    resolveOnlineRequestNumber(agreement) ||
    "";

  // White-out the temporary value (text or image).
  page.drawRectangle({
    x: row.x - 1,
    y: row.bottom - 0.5,
    width: Math.max(row.right, Math.min(row.x + 1, pageWidth)) - row.x + 2,
    height: row.top - row.bottom + 1,
    color: COLORS.white,
  });

  let x = row.x;
  if (onlNumber) {
    const prefix = `${onlNumber}   |   `;
    page.drawText(prefix, {
      x,
      y: row.baseline,
      size,
      font: fonts.regular,
      color: COLORS.text,
    });
    x += fonts.regular.widthOfTextAtSize(prefix, size);
  }
  const label = "Ticket no.: ";
  page.drawText(label, { x, y: row.baseline, size, font: fonts.regular, color: COLORS.text });
  x += fonts.regular.widthOfTextAtSize(label, size);
  page.drawText(ticketNumber, {
    x,
    y: row.baseline,
    size,
    font: fonts.bold,
    color: COLORS.ticket,
  });
};

// ----------------------------------------------------- build missing page

const buildRecordRows = (agreement, ticketNumber, acceptedAt, onlNumber) => {
  const customer = agreement?.customer || {};
  const deviceInfo = agreement?.deviceInfo || {};
  const services = Array.isArray(agreement?.services)
    ? agreement.services.filter(Boolean).join(", ")
    : pick(agreement?.services);
  const emailVerified = Boolean(
    agreement?.emailVerified ?? customer.emailVerified ?? agreement?.otpVerified,
  );

  return {
    emailVerified,
    rows: [
      { label: "Ticket no.", value: ticketNumber, highlight: true },
      {
        label: "Online request no.",
        value: onlNumber || resolveOnlineRequestNumber(agreement) || agreement?.id || "-",
      },
      {
        label: "Signed on",
        value: formatAmmanDateTime(agreement?.signedAt || agreement?.createdAt) || "-",
      },
      { label: "Accepted on", value: formatAmmanDateTime(acceptedAt) },
      {
        label: "Customer name",
        value: pick(customer.name, customer.fullName, agreement?.customerName, agreement?.name),
      },
      {
        label: "Personal ID",
        value: pick(
          customer.personalId,
          customer.nationalId,
          customer.idNumber,
          agreement?.personalId,
          agreement?.nationalId,
          agreement?.idNumber,
        ),
      },
      {
        label: "Phone",
        value: pick(customer.phone, customer.mobile, agreement?.customerPhone, agreement?.phone),
      },
      {
        label: emailVerified ? "Email (verified)" : "Email",
        value: pick(customer.email, agreement?.customerEmail, agreement?.email),
      },
      {
        label: "Company",
        value: pick(customer.company, agreement?.companyName, agreement?.company?.name),
      },
      { label: "Device", value: pick(agreement?.device, deviceInfo.device, deviceInfo.model) },
      {
        label: "Serial / IMEI",
        value: pick(deviceInfo.serialOrImei, agreement?.serial, agreement?.serialNum, agreement?.deviceIMEI),
      },
      { label: "Service(s)", value: services },
      {
        label: "Description",
        value: pick(agreement?.deviceDescription, deviceInfo.selectionDescription, deviceInfo.description),
      },
      {
        label: "Problem details",
        value: pick(deviceInfo.problemDetails, agreement?.issue, agreement?.problem, agreement?.symptom),
      },
      {
        label: "Pickup address",
        value: pick(
          deviceInfo.pickupAddress,
          agreement?.pickupAddress,
          customer.address,
          agreement?.customerAddress,
        ),
      },
      {
        label: "Service option",
        value: pick(
          agreement?.serviceOption,
          deviceInfo.serviceOption,
          agreement?.deliveryOption,
          deviceInfo.deliveryOption,
          deviceInfo.locationName,
          deviceInfo.location,
        ),
      },
    ].map((row) => ({ ...row, value: row.value || "-" })),
  };
};

const appendRecordPage = async ({ pdfDoc, fonts, agreement, ticketNumber, onlNumber, signatureBytes }) => {
  const acceptedAt = new Date();
  const { rows, emailVerified } = buildRecordRows(agreement, ticketNumber, acceptedAt, onlNumber);
  const firstPage = pdfDoc.getPageCount() ? pdfDoc.getPage(0) : null;
  const [pageWidth, pageHeight] = firstPage
    ? [firstPage.getWidth(), firstPage.getHeight()]
    : [612, 792];
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 48;
  const labelWidth = 118;
  const valueX = margin + labelWidth;
  const valueWidth = pageWidth - margin - valueX;
  const valueSize = 9.5;
  const lineGap = 12;
  let y = pageHeight - 60;

  page.drawText("Service Agreement - Signature Record", {
    x: margin,
    y,
    size: 18,
    font: fonts.bold,
    color: COLORS.title,
  });
  y -= 18;
  page.drawText("365 Solutions  |  This page forms part of the signed Terms & Conditions.", {
    x: margin,
    y,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });
  y -= 30;

  for (const row of rows) {
    const rowTop = y;

    page.drawText(row.label, {
      x: margin,
      y: rowTop,
      size: 9.5,
      font: fonts.bold,
      color: COLORS.label,
    });
    const lineCount = await fonts.draw(page, row.value, {
      x: valueX,
      y: rowTop,
      size: valueSize,
      isBold: Boolean(row.highlight),
      color: row.highlight ? COLORS.ticket : COLORS.text,
      maxWidth: valueWidth,
      lineGap,
    });

    y = rowTop - (lineCount - 1) * lineGap - 9;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.6,
      color: COLORS.divider,
    });
    y -= 14;
  }

  y -= 12;
  page.drawText("Customer signature", {
    x: margin,
    y,
    size: 11,
    font: fonts.bold,
    color: COLORS.text,
  });
  y -= 10;

  const boxWidth = 230;
  const boxHeight = 80;
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: COLORS.divider,
    borderWidth: 1,
  });

  if (signatureBytes) {
    try {
      const image = await embedImage(pdfDoc, signatureBytes);
      const scale = Math.min((boxWidth - 16) / image.width, (boxHeight - 12) / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: margin + (boxWidth - w) / 2,
        y: y - boxHeight + (boxHeight - h) / 2,
        width: w,
        height: h,
      });
    } catch (err) {
      console.warn("Could not embed customer signature image", err);
    }
  } else {
    page.drawText("Signature on file (see Terms & Conditions page)", {
      x: margin + 10,
      y: y - boxHeight / 2 - 3,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    });
  }
  y -= boxHeight + 16;

  const customerName = rows.find((row) => row.label === "Customer name")?.value || "";
  if (customerName && customerName !== "-") {
    await fonts.draw(page, customerName, {
      x: margin,
      y,
      size: 11,
      maxWidth: pageWidth - margin * 2,
    });
    y -= 22;
  }

  const signedOn = rows.find((row) => row.label === "Signed on")?.value;
  const email = rows.find((row) => row.label.startsWith("Email"))?.value;
  let footer = signedOn && signedOn !== "-" ? `Signed electronically on ${signedOn}.` : "Signed electronically.";
  if (emailVerified && email && email !== "-") {
    footer += ` The email ${email} was verified with a one-time code before signing.`;
  }
  footer += ` Accepted as ticket ${ticketNumber} on ${formatAmmanDateTime(acceptedAt)}.`;
  await fonts.draw(page, footer, {
    x: margin,
    y,
    size: 7.5,
    color: COLORS.muted,
    maxWidth: pageWidth - margin * 2,
    lineGap: 10,
  });
};

// ------------------------------------------------------------------ public

/**
 * Downloads the signed online agreement, adds the ticket number to its
 * Signature Record page (or appends that page when missing) and returns the
 * new PDF bytes.
 */
export const stampOnlineAgreementWithTicket = async ({
  storage,
  agreement,
  storagePath,
  downloadUrl,
  ticketNumber,
}) => {
  const originalBytes = await readStorageOrUrlBytes(storage, {
    storagePath,
    url: downloadUrl,
  });

  let found = null;
  let onlNumberFromPdf = "";
  try {
    const inspection = await inspectAgreementPdf(originalBytes);
    found = inspection.record;
    onlNumberFromPdf = inspection.onlNumber;
  } catch (err) {
    console.warn("Could not inspect agreement PDF text; a new record page will be added.", err);
  }

  const pdfDoc = await PDFDocument.load(originalBytes);
  const fonts = await createTextDrawer(pdfDoc);

  if (found) {
    await stampExistingRecordPage(pdfDoc, fonts, found, ticketNumber, onlNumberFromPdf, agreement);
  } else {
    let signatureBytes = null;
    const signatureSource = resolveSignatureSource(agreement);
    if (signatureSource) {
      try {
        signatureBytes = await readStorageOrUrlBytes(storage, signatureSource);
      } catch (err) {
        console.warn("Could not download customer signature image", err);
      }
    }
    await appendRecordPage({
      pdfDoc,
      fonts,
      agreement,
      ticketNumber,
      onlNumber: onlNumberFromPdf,
      signatureBytes,
    });
  }

  return {
    bytes: await pdfDoc.save(),
    addedRecordPage: !found,
  };
};
