// Generación de PDFs del cierre de período (Q6b): Reporte Ejecutivo + Anexo de Gastos.
// Reusa jsPDF (^4.2.1, ya en el repo) con render manual, igual que useQuotationBuilder.ts.
import type { ClosurePeriodDetail } from "./useClosurePeriods";

const ACCENT: [number, number, number] = [68, 221, 193];
const GREY: [number, number, number] = [110, 110, 110];
const LOSS_BG: [number, number, number] = [255, 228, 230];
const HEAD_BG: [number, number, number] = [238, 238, 238];

const money = (n: number) => "$ " + Math.round(n || 0).toLocaleString("es-CO");
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

function rangeLabel(detail: ClosurePeriodDetail): string {
  const { period_start, period_end } = detail.period;
  return `${period_start ? period_start : "Inicio"}  →  ${period_end}`;
}

// ── Reporte Ejecutivo (landscape): comparativo por proyecto + utilidad neta ────
export async function generateEjecutivoPdf(detail: ClosurePeriodDetail): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;

  // Encabezado
  doc.setFontSize(20); doc.setTextColor(...ACCENT);
  doc.text("INNOVAR INTERIOR", M, 18);
  doc.setFontSize(11); doc.setTextColor(...GREY);
  doc.text("REPORTE EJECUTIVO — CIERRE DE PERÍODO", M, 25);
  doc.setFontSize(9);
  doc.text(`Período: ${rangeLabel(detail)}`, M, 31);
  doc.text(`Estado: ${detail.period.status.toUpperCase()}`, W - M, 31, { align: "right" });
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.8);
  doc.line(M, 34, W - M, 34);

  // Columnas (right-edge x para alineación a la derecha de los montos)
  const colProj = M;
  const cols = {
    quoted: 138, paid: 170, balance: 202, expenses: 234, profit: 266, margin: W - M,
  };

  const drawHead = (y: number) => {
    doc.setFillColor(...HEAD_BG);
    doc.rect(M, y - 5, W - 2 * M, 7, "F");
    doc.setFontSize(8); doc.setTextColor(20, 20, 20);
    doc.text("PROYECTO", colProj + 1, y);
    doc.text("Cotizado", cols.quoted, y, { align: "right" });
    doc.text("Cobrado", cols.paid, y, { align: "right" });
    doc.text("Saldo", cols.balance, y, { align: "right" });
    doc.text("Gastos", cols.expenses, y, { align: "right" });
    doc.text("Utilidad", cols.profit, y, { align: "right" });
    doc.text("Margen", cols.margin, y, { align: "right" });
  };

  let y = 44;
  drawHead(y);
  y += 8;

  doc.setFontSize(8);
  for (const p of detail.projects) {
    if (y > H - 28) { doc.addPage(); y = 20; drawHead(y); y += 8; }
    const loss = p.profit < 0;
    if (loss) { doc.setFillColor(...LOSS_BG); doc.rect(M, y - 4.5, W - 2 * M, 6.5, "F"); }
    doc.setTextColor(loss ? 150 : 50, loss ? 20 : 50, loss ? 30 : 50);
    const name = p.project_name.length > 46 ? p.project_name.slice(0, 45) + "…" : p.project_name;
    doc.text((loss ? "▼ " : "") + name, colProj + 1, y);
    doc.text(money(p.quoted_value), cols.quoted, y, { align: "right" });
    doc.text(money(p.total_paid), cols.paid, y, { align: "right" });
    doc.text(money(p.balance_due), cols.balance, y, { align: "right" });
    doc.text(money(p.project_expenses), cols.expenses, y, { align: "right" });
    doc.text(money(p.profit), cols.profit, y, { align: "right" });
    doc.text(pct(p.margin_pct), cols.margin, y, { align: "right" });
    y += 6.5;
  }

  // Fila de totales de proyectos
  const tQuoted = detail.projects.reduce((s, p) => s + p.quoted_value, 0);
  const tPaid = detail.projects.reduce((s, p) => s + p.total_paid, 0);
  const tBalance = detail.projects.reduce((s, p) => s + p.balance_due, 0);
  const tExp = detail.projects.reduce((s, p) => s + p.project_expenses, 0);
  const tProfit = detail.period.total_projects_profit;

  if (y > H - 28) { doc.addPage(); y = 20; }
  doc.setDrawColor(200, 200, 200); doc.line(M, y - 3, W - M, y - 3);
  doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
  doc.text("TOTALES PROYECTOS", colProj + 1, y + 1);
  doc.text(money(tQuoted), cols.quoted, y + 1, { align: "right" });
  doc.text(money(tPaid), cols.paid, y + 1, { align: "right" });
  doc.text(money(tBalance), cols.balance, y + 1, { align: "right" });
  doc.text(money(tExp), cols.expenses, y + 1, { align: "right" });
  doc.text(money(tProfit), cols.profit, y + 1, { align: "right" });
  y += 12;

  // Tarjetas resumen finales
  if (y > H - 36) { doc.addPage(); y = 20; }
  const card = (x: number, w: number, label: string, value: string, color: [number, number, number]) => {
    doc.setDrawColor(225, 225, 225); doc.setFillColor(250, 250, 250);
    doc.rect(x, y, w, 20, "FD");
    doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFontSize(12); doc.setTextColor(...color);
    doc.text(value, x + 3, y + 15);
  };
  const cw = (W - 2 * M - 16) / 3;
  card(M, cw, "Utilidad de proyectos", money(detail.period.total_projects_profit), [50, 50, 50]);
  card(M + cw + 8, cw, "Gastos de bodega", "− " + money(detail.period.total_bodega_expenses), [180, 40, 40]);
  card(M + 2 * (cw + 8), cw, "Utilidad neta del período", money(detail.period.net_profit),
    detail.period.net_profit >= 0 ? ACCENT : [180, 40, 40]);
  y += 32;

  // Firmas
  if (y > H - 30) { doc.addPage(); y = 30; }
  doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3);
  const sw = (W - 2 * M - 24) / 3;
  ["Elaboró", "Aprobó", "Gerencia"].forEach((label, i) => {
    const x = M + i * (sw + 12);
    doc.line(x, y, x + sw, y);
    doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(label, x + sw / 2, y + 5, { align: "center" });
  });

  doc.setFontSize(7); doc.setTextColor(180, 180, 180);
  doc.text(
    "Documento generado automáticamente por el sistema Innovar. Cierre de período.",
    M, H - 8
  );
  doc.save(`Cierre_Ejecutivo_${detail.period.period_end}.pdf`);
}

// ── Anexo de Gastos: bodega por categoría + comparativo por proyecto ──────────
export async function generateAnexoPdf(detail: ClosurePeriodDetail): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;

  doc.setFontSize(18); doc.setTextColor(...ACCENT);
  doc.text("ANEXO DE GASTOS", M, 18);
  doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text(`Período: ${rangeLabel(detail)}`, M, 25);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.8);
  doc.line(M, 29, W - M, 29);

  let y = 40;

  // ── Sección 1: gastos de bodega por categoría ────────────────────────────────
  doc.setFontSize(12); doc.setTextColor(20, 20, 20);
  doc.text("1. Gastos de bodega por categoría", M, y);
  y += 8;

  const byCat = new Map<string, number>();
  for (const e of detail.expenses) byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);

  doc.setFontSize(9);
  if (byCat.size === 0) {
    doc.setTextColor(...GREY);
    doc.text("Sin gastos de bodega en este período.", M + 2, y);
    y += 8;
  } else {
    for (const [cat, amount] of Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])) {
      if (y > H - 24) { doc.addPage(); y = 20; }
      doc.setTextColor(50, 50, 50);
      doc.text(cat.replace(/_/g, " "), M + 2, y);
      doc.text(money(amount), W - M, y, { align: "right" });
      y += 6;
    }
    doc.setDrawColor(200, 200, 200); doc.line(M, y - 2, W - M, y - 2);
    doc.setFontSize(10); doc.setTextColor(20, 20, 20);
    doc.text("Subtotal bodega", M + 2, y + 4);
    doc.text(money(detail.period.total_bodega_expenses), W - M, y + 4, { align: "right" });
    y += 14;
  }

  // ── Sección 2: comparativo por proyecto (cotizado vs real) ───────────────────
  if (y > H - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(12); doc.setTextColor(20, 20, 20);
  doc.text("2. Comparativo por proyecto (cotizado vs. real)", M, y);
  y += 8;

  doc.setFillColor(...HEAD_BG); doc.rect(M, y - 5, W - 2 * M, 7, "F");
  doc.setFontSize(8); doc.setTextColor(20, 20, 20);
  doc.text("PROYECTO", M + 1, y);
  doc.text("Cotizado", 120, y, { align: "right" });
  doc.text("Gastos", 150, y, { align: "right" });
  doc.text("Utilidad", W - M, y, { align: "right" });
  y += 8;

  doc.setFontSize(8);
  for (const p of detail.projects) {
    if (y > H - 20) { doc.addPage(); y = 20; }
    const loss = p.profit < 0;
    if (loss) { doc.setFillColor(...LOSS_BG); doc.rect(M, y - 4.5, W - 2 * M, 6.5, "F"); }
    doc.setTextColor(loss ? 150 : 50, loss ? 20 : 50, loss ? 30 : 50);
    const name = p.project_name.length > 40 ? p.project_name.slice(0, 39) + "…" : p.project_name;
    doc.text((loss ? "▼ " : "") + name, M + 1, y);
    doc.text(money(p.quoted_value), 120, y, { align: "right" });
    doc.text(money(p.project_expenses), 150, y, { align: "right" });
    doc.text(money(p.profit), W - M, y, { align: "right" });
    y += 6.5;
  }

  doc.setFontSize(7); doc.setTextColor(180, 180, 180);
  doc.text("Documento generado automáticamente por el sistema Innovar.", M, H - 8);
  doc.save(`Cierre_Anexo_${detail.period.period_end}.pdf`);
}
