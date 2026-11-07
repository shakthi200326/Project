import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function toCellText(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return String(value);
}

function addSection(doc, section, margin, pageWidth) {
  let cursorY = doc.previousSectionY || 100;

  if (cursorY > doc.internal.pageSize.getHeight() - 70) {
    doc.addPage();
    cursorY = 48;
  }

  if (section.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(section.title, margin, cursorY);
    cursorY += 10;
  }

  if (section.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(section.description, pageWidth - margin * 2);
    doc.text(lines, margin, cursorY + 8);
    cursorY += lines.length * 11 + 12;
  }

  if (section.rows?.length) {
    autoTable(doc, {
      startY: cursorY + 6,
      margin: { left: margin, right: margin },
      head: section.headers ? [section.headers.map(toCellText)] : undefined,
      body: section.rows.map((row) => row.map(toCellText)),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didDrawPage: () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(section.title || "Inventory Report", margin, 28);
      },
    });
    doc.previousSectionY = doc.lastAutoTable.finalY;
    return;
  }

  doc.previousSectionY = cursorY + 18;
}

export function createReportPdf({ title, subtitle, fileName, sections = [] }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const date = new Date().toLocaleString();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 35, 60);
  doc.text(toCellText(title), margin, 48, { maxWidth: pageWidth - margin * 2 });

  let cursorY = 68;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    const subtitleLines = doc.splitTextToSize(toCellText(subtitle), pageWidth - margin * 2);
    doc.text(subtitleLines, margin, cursorY);
    cursorY += subtitleLines.length * 13 + 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(`Generated: ${date}`, margin, cursorY);
  doc.previousSectionY = cursorY + 18;

  sections.forEach((section) => addSection(doc, section, margin, pageWidth));

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 18,
      { align: "right" }
    );
  }

  return {
    doc,
    fileName: `${String(fileName || title || "inventory-report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}

export function downloadReportPdf(options) {
  const { doc, fileName } = createReportPdf(options);
  doc.save(fileName);
}

export function openReportPdf(options) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    throw new Error("The PDF preview was blocked. Allow pop-ups and try again.");
  }
  try {
    const { doc } = createReportPdf(options);
    const url = URL.createObjectURL(doc.output("blob"));
    previewWindow.opener = null;
    previewWindow.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
