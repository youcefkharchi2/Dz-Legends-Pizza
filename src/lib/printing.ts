import { money, type Order, type Settings } from "./types";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
export function printReceipt(order: Order, settings: Settings) {
  const popup = window.open("", "_blank", "width=440,height=720");
  if (!popup)
    throw new Error(
      "Autorisez les fenêtres d’impression dans votre navigateur.",
    );
  popup.document.write(
    `<!doctype html><html lang="fr"><head><title>Ticket ${escape(order.number)}</title><style>@page{size:${settings.receiptWidth}mm auto;margin:3mm}body{font:12px monospace;color:#000;width:${Number(settings.receiptWidth) - 8}mm;margin:10px auto}h1{font:700 20px sans-serif;text-align:center;margin-bottom:8px}.center{text-align:center}hr{border:0;border-top:1px dashed #000;margin:12px 0}table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:top}td:last-child{text-align:right}small{font-size:10px}.total{font-size:17px;font-weight:bold}.row{display:flex;justify-content:space-between;margin:6px 0}@media print{button{display:none}body{margin:0}}button{width:100%;padding:12px;margin-top:20px;cursor:pointer}</style></head><body>${settings.logo ? `<div class="center"><img src="${escape(settings.logo)}" alt="Logo" style="max-width:55px;max-height:55px;object-fit:contain"></div>` : ""}<h1>${escape(settings.name)}</h1><div class="center">${escape(settings.address)}<br>${escape(settings.phone)}</div><hr><div>Ticket : ${escape(order.number)}<br>${escape(new Date(order.date).toLocaleString("fr-DZ"))}<br>Caissier : ${escape(order.employeeName)}<br>Statut : ${escape(order.status)}</div><hr><table>${order.items.map((i) => `<tr><td>${i.quantity} × ${escape(i.name)}${i.size ? " · " + escape(i.size) : ""}<br><small>${escape(i.extras.join(", "))}${i.extras.length ? " · " : ""}${escape(money(i.price))} / unité</small></td><td>${escape(money(i.price * i.quantity))}</td></tr>`).join("")}</table><hr><div class="row"><span>Sous-total</span><span>${escape(money(order.subtotal))}</span></div>${order.discount ? `<div class="row"><span>Remise</span><span>− ${escape(money(order.discount))}</span></div>` : ""}<div class="row total"><span>TOTAL</span><span>${escape(money(order.total))}</span></div><hr><div class="row"><span>Paiement</span><span>${escape(order.payment)}</span></div><div class="row"><span>Reçu</span><span>${escape(money(order.received))}</span></div><div class="row"><span>Monnaie</span><span>${escape(money(order.change))}</span></div><hr><p class="center">${escape(settings.footer)}</p><button onclick="window.print()">Imprimer le ticket</button><script>window.onload=()=>{window.focus();window.print();}</script></body></html>`,
  );
  popup.document.close();
}
export function exportCSV(filename: string, rows: (string | number)[][]) {
  const csv =
    "\ufeff" +
    rows
      .map((row) =>
        row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(";"),
      )
      .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
