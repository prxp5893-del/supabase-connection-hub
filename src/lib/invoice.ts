import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Sale, Settings } from "./types";
import { fmtDateTime, inr } from "./format";

export const mrpTotal = (sale: Sale) =>
  sale.items.reduce((s, i) => s + Math.max(i.mrp || 0, i.price) * i.qty, 0);

export const savedAmt = (sale: Sale) =>
  Math.max(0, Math.round((mrpTotal(sale) - sale.total) * 100) / 100);

export const mrpDiscount = (sale: Sale) =>
  Math.round(sale.items.reduce((s, i) => s + Math.max(0, (i.mrp || 0) - i.price) * i.qty, 0) * 100) / 100;

export function buildInvoicePdf(sale: Sale, s: Settings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const GREEN: [number, number, number] = [22, 128, 61];
  const LIGHT: [number, number, number] = [244, 249, 244];
  const GREY: [number, number, number] = [90, 90, 90];

  // Page border
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, W - 16, 281);

  // Header band with shop name
  doc.setFillColor(...GREEN);
  doc.rect(8, 8, W - 16, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(s.shopName, 15, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("TAX INVOICE", W - 15, 24, { align: "right" });

  // Shop contact details (left) + invoice details (right)
  doc.setTextColor(...GREY);
  doc.setFontSize(9);
  let hy = 42;
  if (s.address) {
    const addrLines = doc.splitTextToSize(s.address, 100) as string[];
    doc.text(addrLines, 15, hy);
    hy += addrLines.length * 4.5;
  }
  if (s.mobile) {
    doc.text(`Phone: ${s.mobile}`, 15, hy);
    hy += 4.5;
  }
  if (s.gstin) {
    doc.text(`GSTIN: ${s.gstin}`, 15, hy);
    hy += 4.5;
  }

  const metaRows: [string, string][] = [
    ["Invoice No.", sale.invoiceNo],
    ["Date", fmtDateTime(sale.date)],
    ["Cashier", sale.cashier],
  ];
  const metaX = 132;
  const metaY0 = 40;
  doc.setDrawColor(200, 210, 200);
  doc.setFillColor(...LIGHT);
  doc.rect(metaX - 2, metaY0 - 5, W - 15 - metaX + 2, metaRows.length * 6 + 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  metaRows.forEach(([k, v], i) => {
    doc.setTextColor(...GREY);
    doc.text(k, metaX + 2, metaY0 + i * 6);
    doc.setTextColor(30, 30, 30);
    doc.text(v, W - 17, metaY0 + i * 6, { align: "right" });
  });

  // Bill To
  const billToY = Math.max(hy + 4, metaY0 + metaRows.length * 6 + 3);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("BILL TO", 15, billToY);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(sale.customerName || "Walk-in Customer", 15, billToY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (sale.customerMobile) doc.text(`Mobile: ${sale.customerMobile}`, 15, billToY + 10);

  // Items table
  autoTable(doc, {
    startY: billToY + 16,
    head: [["#", "Item", "HSN", "Qty", "MRP", "Rate", "Disc", "Discount", "GST%", "Amount"]],
    body: sale.items.map((i, idx) => {
      const save = i.mrp > i.price ? (i.mrp - i.price) * i.qty : 0;
      return [
        idx + 1,
        i.name,
        i.hsn,
        `${i.qty} ${i.unit}`,
        (i.mrp || i.price).toFixed(2),
        i.price.toFixed(2),
        i.discount.toFixed(2),
        save > 0 ? save.toFixed(2) : "-",
        i.gst,
        i.total.toFixed(2),
      ];
    }),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: [220, 228, 220] as [number, number, number] },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "center", cellWidth: 12 },
      9: { halign: "right", fontStyle: "bold" },
    },
  });

  // Totals block (right side)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 6;
  const rows: [string, string, boolean?][] = [
    ["Total MRP", inr(mrpTotal(sale))],
    ["Subtotal", inr(sale.subtotal)],
    ["Discount (MRP − our price)", "-" + inr(mrpDiscount(sale))],
    ["Item Discount", "-" + inr(sale.itemDiscount)],
    ["Bill Discount", "-" + inr(sale.billDiscount)],
    ["Taxable Value", inr(sale.taxable)],
    ["CGST", inr(sale.cgst)],
    ["SGST", inr(sale.sgst)],
    ["IGST", inr(sale.igst)],
    ["Round Off", inr(sale.roundOff)],
    ["GRAND TOTAL", inr(sale.total), true],
    ["Payment", sale.paymentMethod],
  ];
  const boxX = 118;
  const boxW = W - 15 - boxX;
  doc.setFillColor(...LIGHT);
  doc.rect(boxX, y - 4, boxW, rows.length * 5.5 + 8, "F");
  doc.setFontSize(9);
  for (const [k, v, strong] of rows) {
    if (strong) {
      doc.setFillColor(...GREEN);
      doc.rect(boxX, y - 4, boxW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(k, boxX + 2, y + 0.5);
      doc.text(v, boxX + boxW - 2, y + 0.5, { align: "right" });
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      continue;
    }
    doc.setTextColor(...GREY);
    doc.text(k, boxX + 2, y);
    doc.setTextColor(30, 30, 30);
    doc.text(v, boxX + boxW - 2, y, { align: "right" });
    y += 5.5;
  }

  // Savings banner
  let bannerY = y + 6;
  if (savedAmt(sale) > 0) {
    const text = `You saved ${inr(savedAmt(sale))} on this bill!`;
    doc.setFillColor(...GREEN);
    doc.rect(15, bannerY, W - 30, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, W / 2, bannerY + 6, { align: "center" });
    bannerY += 14;
  }

  // Amount in words (Indian numbering)
  const words = numberToIndianWords(Math.round(sale.total));
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Amount in words:", 15, bannerY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`Rupees ${words} only`, 15, bannerY + 6.5);

  // Footer
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(15, 272, W - 15, 272);
  doc.setTextColor(...GREY);
  doc.setFontSize(8);
  doc.text(s.footerNote, W / 2, 277, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(`For ${s.shopName}`, W - 15, 277, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("This is a computer generated invoice.", W / 2, 282, { align: "center" });
  return doc;
}

function numberToIndianWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? (ones[x] ?? "") : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string =>
    (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? " " : ""}` : "") + (x % 100 ? two(x % 100) : "");
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

export function downloadInvoice(sale: Sale, s: Settings) {
  buildInvoicePdf(sale, s).save(`${sale.invoiceNo}.pdf`);
}

export function printA4(sale: Sale, s: Settings) {
  const doc = buildInvoicePdf(sale, s);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

export function thermalHtml(sale: Sale, s: Settings) {
  const w = s.thermalWidth === 58 ? 220 : 300;
  const line = "--------------------------------";
  return `<html><head><title>${sale.invoiceNo}</title><style>
  body{font-family:'Courier New',monospace;font-size:12px;width:${w}px;margin:0 auto;padding:8px;color:#000}
  .c{text-align:center}.r{text-align:right}.b{font-weight:700}
  table{width:100%;border-collapse:collapse}td{font-size:11px;padding:1px 0}
  </style></head><body>
  <div class="c b" style="font-size:15px">${s.shopName}</div>
  <div class="c">${s.address}</div>
  <div class="c">Ph: ${s.mobile}</div>
  <div class="c">GSTIN: ${s.gstin}</div>
  <div>${line}</div>
  <div>Invoice: ${sale.invoiceNo}</div>
  <div>Date: ${fmtDateTime(sale.date)}</div>
  <div>Cashier: ${sale.cashier}</div>
  <div>Customer: ${sale.customerName}</div>
  <div>${line}</div>
  <table>
    <tr class="b"><td>Item</td><td class="r">Qty</td><td class="r">MRP</td><td class="r">Rate</td><td class="r">Amt</td></tr>
    ${sale.items
      .map((i) => {
        const save = i.mrp > i.price ? (i.mrp - i.price) * i.qty : 0;
        return `<tr><td colspan="5">${i.name}</td></tr><tr><td></td><td class="r">${i.qty} ${i.unit}</td><td class="r">${(i.mrp || i.price).toFixed(2)}</td><td class="r">${i.price.toFixed(2)}</td><td class="r">${i.total.toFixed(2)}</td></tr>${save > 0 ? `<tr><td colspan="5" style="font-size:10px">* Discount ${save.toFixed(2)}</td></tr>` : ""}`;
      })
      .join("")}
  </table>
  <div>${line}</div>
  <table>
    <tr><td>Total MRP</td><td class="r">${mrpTotal(sale).toFixed(2)}</td></tr>
    <tr><td>Subtotal</td><td class="r">${sale.subtotal.toFixed(2)}</td></tr>
    <tr><td>Discount (MRP-our price)</td><td class="r">-${mrpDiscount(sale).toFixed(2)}</td></tr>
    <tr><td>Discount</td><td class="r">-${(sale.itemDiscount + sale.billDiscount).toFixed(2)}</td></tr>
    <tr><td>CGST</td><td class="r">${sale.cgst.toFixed(2)}</td></tr>
    <tr><td>SGST</td><td class="r">${sale.sgst.toFixed(2)}</td></tr>
    <tr><td>Round Off</td><td class="r">${sale.roundOff.toFixed(2)}</td></tr>
    <tr class="b"><td>TOTAL</td><td class="r">${sale.total.toFixed(2)}</td></tr>
    <tr><td>Paid (${sale.paymentMethod})</td><td class="r">${sale.received.toFixed(2)}</td></tr>
    <tr><td>Change</td><td class="r">${sale.change.toFixed(2)}</td></tr>
  </table>
  <div>${line}</div>
  ${savedAmt(sale) > 0 ? `<div class="c b" style="font-size:13px">*** YOU SAVED Rs ${savedAmt(sale).toFixed(2)} ***</div><div>${line}</div>` : ""}
  <div class="c">${s.footerNote}</div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;
}

export function printThermal(sale: Sale, s: Settings) {
  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) return;
  win.document.write(thermalHtml(sale, s));
  win.document.close();
}

export function whatsappShare(sale: Sale, s: Settings) {
  const text = [
    `*${s.shopName}*`,
    `Invoice: ${sale.invoiceNo}`,
    `Date: ${fmtDateTime(sale.date)}`,
    "",
    ...sale.items.map((i) => `${i.name} x${i.qty} = ${inr(i.total)}`),
    "",
    `Total: ${inr(sale.total)}`,
    `Paid via ${sale.paymentMethod}`,
    "",
    s.footerNote,
  ].join("\n");
  const phone = (sale.customerMobile ?? "").replace(/\D/g, "");
  const url = `https://wa.me/${phone ? "91" + phone.slice(-10) : ""}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
