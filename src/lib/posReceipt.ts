// Shared 80mm thermal-receipt printer, used by both /pos (table service) and
// /comptoir (counter sales). Opens a new window, writes a print-ready HTML
// document, and triggers the browser print dialog.

export type ReceiptItem = { name: string; quantity: number; unitPrice: number }

export function printReceipt(cafeName: string, tableLabel: string | number, items: ReceiptItem[], total: number, currency: string) {
  const lines = items.map(i => `<tr>
    <td>${i.name}</td>
    <td style="text-align:center">${i.quantity}</td>
    <td style="text-align:right">${(i.unitPrice * i.quantity).toFixed(2)}</td>
  </tr>`).join('')
  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.d{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  td{padding:2px 0;vertical-align:top}.tot td{font-weight:bold;border-top:1px dashed #000;padding-top:4px}
  @media print{body{width:80mm}@page{margin:0;size:80mm auto}}</style></head>
  <body><div class="c b" style="font-size:16px">☕ ${cafeName}</div>
  <div class="c" style="font-size:10px;color:#555">Smart Menu POS</div><div class="d"></div>
  <div>Table: <b>${tableLabel}</b></div><div>Date: ${new Date().toLocaleString()}</div><div class="d"></div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${lines}</tbody>
  <tfoot><tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${total.toFixed(2)} ${currency}</td></tr></tfoot>
  </table><div class="d"></div><div class="c" style="font-size:10px">Thank you · شكراً · Merci</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`)
  win.document.close()
}
