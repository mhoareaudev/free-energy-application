import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { NOMENCLATURE_CATEGORIES } from '../components/NomenclatureView'
import { formatDateFR } from './dateUtils'

// A4 in points
const W = 595.28
const H = 841.89
const MARGIN = 40
const INNER_W = W - 2 * MARGIN

const RED       = rgb(0.61, 0.07, 0.07)
const GRAY_TEXT = rgb(0.4, 0.4, 0.4)
const ROW_ALT   = rgb(0.975, 0.975, 0.975)
const BOX_BG    = rgb(0.97, 0.97, 0.97)
const BOX_BORDER = rgb(0.88, 0.88, 0.88)
const LINE_GRAY  = rgb(0.91, 0.91, 0.91)

// Column x positions (Quantité right-edge, Unité start)
const COL_QTY_END = W - MARGIN - 52
const COL_UNIT    = W - MARGIN - 48

export async function generateNomenclaturePdf(clientData, nomenclatureData) {
  const pdfDoc  = await PDFDocument.create()
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let currentPage = pdfDoc.addPage([W, H])
  let y = H - MARGIN

  const txt = (str, x, yPos, size, f = font, color = rgb(0, 0, 0)) => {
    if (str == null || str === '') return
    currentPage.drawText(String(str), { x, y: yPos, size, font: f, color })
  }

  const hline = (x1, y1, x2, color = LINE_GRAY, thickness = 0.5) => {
    currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color })
  }

  const fillRect = (x, yPos, w, h, color, border = null) => {
    const opts = { x, y: yPos, width: w, height: h, color }
    if (border) { opts.borderColor = border; opts.borderWidth = 0.5 }
    currentPage.drawRectangle(opts)
  }

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN) {
      currentPage = pdfDoc.addPage([W, H])
      y = H - MARGIN
    }
  }

  // ── Title ──────────────────────────────────────────────────────
  txt('NOMENCLATURE', MARGIN, y, 18, bold, RED)
  const dateStr = formatDateFR()
  const dateW = font.widthOfTextAtSize(dateStr, 9)
  txt(dateStr, W - MARGIN - dateW, y + 2, 9, font, GRAY_TEXT)
  y -= 8
  hline(MARGIN, y, W - MARGIN, rgb(0.8, 0.12, 0.12), 1)
  y -= 18

  // ── Client info box ────────────────────────────────────────────
  const name      = clientData?.clientName || ''
  const adresse   = clientData?.adresse    || ''
  const cp        = clientData?.codePostal || ''
  const ville     = clientData?.ville      || ''
  const tel       = clientData?.telephone  || ''
  const email     = clientData?.email      || ''
  const addr2     = [cp, ville].filter(Boolean).join(' ')

  const leftLines  = 1 + (adresse ? 1 : 0) + (addr2 ? 1 : 0)
  const rightLines = (tel ? 1 : 0) + (email ? 1 : 0)
  const maxLines   = Math.max(leftLines, rightLines, 1)
  // boxH: enough for content plus balanced padding
  const boxH = Math.max(36, 12 + maxLines * 14 + 8)

  fillRect(MARGIN, y - boxH, INNER_W, boxH, BOX_BG, BOX_BORDER)

  // Left text: vertically centered — cy is the baseline of the first line
  // visual center of text block ≈ cy - (leftLines - 1) * 6
  // we want that to equal the box center (y - boxH/2), adjusted for ascent
  const leftBlockH = (leftLines - 1) * 12 + 13 // approx visual height
  let cy = y - (boxH - leftBlockH) / 2 - 8  // 8 = Helvetica 11pt ascent
  txt(name, MARGIN + 10, cy, 11, bold)
  cy -= 14
  if (adresse) { txt(adresse, MARGIN + 10, cy, 9, font, GRAY_TEXT); cy -= 12 }
  if (addr2)   { txt(addr2,   MARGIN + 10, cy, 9, font, GRAY_TEXT) }

  // Right side: tel + email (centered similarly)
  const rightBlockH = rightLines * 11
  let ry = y - (boxH - rightBlockH) / 2 - 6  // 6 = Helvetica 9pt ascent
  if (tel) {
    const s = `Tél : ${tel}`
    txt(s, W - MARGIN - 10 - font.widthOfTextAtSize(s, 9), ry, 9, font, GRAY_TEXT)
    ry -= 12
  }
  if (email) {
    txt(email, W - MARGIN - 10 - font.widthOfTextAtSize(email, 9), ry, 9, font, GRAY_TEXT)
  }

  y -= boxH + 20

  // ── Nomenclature tables ────────────────────────────────────────
  const items = nomenclatureData?.items || []

  for (const cat of NOMENCLATURE_CATEGORIES) {
    const catItems = items.filter(item => item.categorie === cat.id)
    if (catItems.length === 0) continue

    // Estimate space: header 18 + col header 14 + rows + gap 10
    ensureSpace(28 + 18 + catItems.length * 14 + 10)

    // Category header bar
    fillRect(MARGIN, y - 16, INNER_W, 18, RED)
    txt(cat.label, MARGIN + 6, y - 10, 9, bold, rgb(1, 1, 1))
    y -= 28  // 18pt bar + 10pt gap before column headers

    // Column headers
    txt('Désignation', MARGIN + 6, y, 8, bold, GRAY_TEXT)
    txt('Qté',  COL_QTY_END - font.widthOfTextAtSize('Qté', 8),  y, 8, bold, GRAY_TEXT)
    txt('Unité', COL_UNIT + 2, y, 8, bold, GRAY_TEXT)
    y -= 6
    hline(MARGIN, y, W - MARGIN)
    y -= 12

    // Item rows
    for (let i = 0; i < catItems.length; i++) {
      ensureSpace(14)
      const item = catItems[i]

      if (i % 2 === 1) {
        fillRect(MARGIN, y - 3, INNER_W, 14, ROW_ALT)
      }

      // Truncate long designations
      const maxW = COL_QTY_END - MARGIN - 14
      let desig = item.designation || ''
      while (desig.length > 1 && font.widthOfTextAtSize(desig, 9) > maxW) {
        desig = desig.slice(0, -1)
      }
      if (desig !== item.designation) desig += '…'

      txt(desig, MARGIN + 6, y, 9)

      const qty = parseFloat(item.quantite) || 0
      const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
      txt(qtyStr, COL_QTY_END - font.widthOfTextAtSize(qtyStr, 9), y, 9) // right-aligned
      txt(item.unite || '', COL_UNIT + 2, y, 9)

      hline(MARGIN, y - 4, W - MARGIN)
      y -= 14
    }

    y -= 10
  }

  return await pdfDoc.save()
}

export async function downloadNomenclaturePdf(clientData, nomenclatureData) {
  const bytes = await generateNomenclaturePdf(clientData, nomenclatureData)
  const blob  = new Blob([bytes], { type: 'application/pdf' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `nomenclature_${(clientData?.clientName || 'client').replace(/\s+/g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generateStockPdf(items) {
  const pdfDoc  = await PDFDocument.create()
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let currentPage = pdfDoc.addPage([W, H])
  let y = H - MARGIN

  const txt = (str, x, yPos, size, f = font, color = rgb(0, 0, 0)) => {
    if (str == null || str === '') return
    currentPage.drawText(String(str), { x, y: yPos, size, font: f, color })
  }
  const hline = (x1, y1, x2, color = LINE_GRAY, thickness = 0.5) => {
    currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color })
  }
  const fillRect = (x, yPos, w, h, color, border = null) => {
    const opts = { x, y: yPos, width: w, height: h, color }
    if (border) { opts.borderColor = border; opts.borderWidth = 0.5 }
    currentPage.drawRectangle(opts)
  }
  const ensureSpace = (needed) => {
    if (y - needed < MARGIN) {
      currentPage = pdfDoc.addPage([W, H])
      y = H - MARGIN
    }
  }

  // Title
  txt('STOCK NOMENCLATURES', MARGIN, y, 18, bold, RED)
  const dateStr = formatDateFR()
  const dateW = font.widthOfTextAtSize(dateStr, 9)
  txt(dateStr, W - MARGIN - dateW, y + 2, 9, font, GRAY_TEXT)
  y -= 8
  hline(MARGIN, y, W - MARGIN, rgb(0.8, 0.12, 0.12), 1)
  y -= 20

  for (const cat of NOMENCLATURE_CATEGORIES) {
    const catItems = items.filter(item => item.categorie === cat.id)
    if (catItems.length === 0) continue

    ensureSpace(28 + 18 + catItems.length * 14 + 10)

    fillRect(MARGIN, y - 16, INNER_W, 18, RED)
    txt(cat.label, MARGIN + 6, y - 10, 9, bold, rgb(1, 1, 1))
    y -= 28

    txt('Désignation', MARGIN + 6, y, 8, bold, GRAY_TEXT)
    txt('Qté',  COL_QTY_END - font.widthOfTextAtSize('Qté', 8),  y, 8, bold, GRAY_TEXT)
    txt('Unité', COL_UNIT + 2, y, 8, bold, GRAY_TEXT)
    y -= 6
    hline(MARGIN, y, W - MARGIN)
    y -= 12

    for (let i = 0; i < catItems.length; i++) {
      ensureSpace(14)
      const item = catItems[i]
      if (i % 2 === 1) fillRect(MARGIN, y - 3, INNER_W, 14, ROW_ALT)

      const maxW = COL_QTY_END - MARGIN - 14
      let desig = item.designation || ''
      while (desig.length > 1 && font.widthOfTextAtSize(desig, 9) > maxW) desig = desig.slice(0, -1)
      if (desig !== item.designation) desig += '…'

      txt(desig, MARGIN + 6, y, 9)
      const qty = parseFloat(item.quantite) || 0
      const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
      txt(qtyStr, COL_QTY_END - font.widthOfTextAtSize(qtyStr, 9), y, 9)
      txt(item.unite || '', COL_UNIT + 2, y, 9)

      hline(MARGIN, y - 4, W - MARGIN)
      y -= 14
    }
    y -= 10
  }

  // Download
  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock_nomenclatures_${formatDateFR().replace(/\//g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
