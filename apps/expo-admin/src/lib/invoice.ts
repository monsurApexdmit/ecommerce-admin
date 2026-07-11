import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/types/order";

function itemPrice(item: Order["items"][number]) {
  return Number(item.unitPrice ?? item.price ?? 0);
}

function itemTotal(item: Order["items"][number]) {
  return Number(item.totalPrice ?? itemPrice(item) * item.quantity);
}

export function buildInvoiceHtml(order: Order) {
  const shipTo = order.shippingFullName
    ? `
      <p style="font-weight:600;">${order.shippingFullName}</p>
      ${order.shippingEmail ? `<p style="font-size:13px;color:#6b7280;">${order.shippingEmail}</p>` : ""}
      <p style="font-size:13px;color:#6b7280;">${order.shippingPhone ?? ""}</p>
      <p style="font-size:13px;color:#6b7280;">${order.shippingAddressLine1 ?? ""}${order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}</p>
      <p style="font-size:13px;color:#6b7280;">${[order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")}</p>
      <p style="font-size:13px;color:#6b7280;">${order.shippingCountry ?? ""}</p>
    `
    : `<p style="font-weight:600;">${order.customerName}</p>`;

  const itemsHtml = order.items.length
    ? order.items
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.productName}</td>
              <td style="text-align:center;">${item.quantity}</td>
              <td style="text-align:right;">${formatCurrency(itemPrice(item))}</td>
              <td style="text-align:right;color:#dc2626;font-weight:700;">${formatCurrency(itemTotal(item))}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td>1</td>
        <td>${order.customerName}</td>
        <td style="text-align:center;">1</td>
        <td style="text-align:right;">${formatCurrency(order.amount)}</td>
        <td style="text-align:right;color:#dc2626;font-weight:700;">${formatCurrency(order.amount)}</td>
      </tr>
    `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 32px; color: #374151; }
          .invoice-container { max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
          .logo { font-size: 24px; font-weight: 700; color: #059669; }
          .company-info { text-align: right; }
          .company-info p { font-size: 13px; color: #6b7280; margin: 4px 0; }
          .invoice-title { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
          .status-badge { display:inline-block; padding:6px 14px; background:#10b981; color:white; border-radius:999px; font-size:14px; font-weight:600; }
          .meta { display:grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 32px 0; }
          .meta h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
          .meta p { margin: 4px 0; font-size: 14px; }
          table { width:100%; border-collapse: collapse; margin: 32px 0; }
          th { text-align:left; background:#f8fafc; color:#334155; font-size:12px; text-transform:uppercase; padding:12px; border-bottom:2px solid #e5e7eb; }
          td { padding:14px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; }
          .summary { background:#f8fafc; border-radius:16px; padding:24px; display:grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .summary h3 { font-size:12px; text-transform:uppercase; color:#6b7280; margin-bottom:6px; }
          .summary p { font-size:16px; font-weight:600; margin:0; }
          .total { color:#dc2626; font-size:24px !important; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div>
              <div class="invoice-title">INVOICE</div>
              <div>
                <span style="font-weight:600;margin-right:8px;">STATUS</span>
                <span class="status-badge">${order.status}</span>
              </div>
            </div>
            <div class="company-info">
              <div class="logo">Admin</div>
              <p>59 Station Rd, Purls Bridge, United Kingdom</p>
              <p>019579034</p>
            </div>
          </div>

          <div class="meta">
            <div>
              <h3>Date</h3>
              <p>${new Date(order.orderTime).toLocaleDateString()}</p>
            </div>
            <div>
              <h3>Invoice No</h3>
              <p>#${order.invoiceNo}</p>
            </div>
            <div style="text-align:right;">
              <h3>${order.shippingFullName ? "Ship To" : "Invoice To"}</h3>
              ${shipTo}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:80px;">SR.</th>
                <th>PRODUCT TITLE</th>
                <th style="width:120px;text-align:center;">QUANTITY</th>
                <th style="width:120px;text-align:right;">ITEM PRICE</th>
                <th style="width:120px;text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div class="summary">
            <div>
              <h3>Payment Method</h3>
              <p>${order.method}</p>
            </div>
            <div>
              <h3>Shipping Cost</h3>
              <p>${formatCurrency(Number(order.shippingCost ?? 0))}</p>
            </div>
            <div>
              <h3>Discount</h3>
              <p>${formatCurrency(Number(order.discount ?? 0))}</p>
            </div>
            <div>
              <h3>Total Amount</h3>
              <p class="total">${formatCurrency(Number(order.amount ?? 0))}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function printInvoice(order: Order) {
  await Print.printAsync({ html: buildInvoiceHtml(order) });
}

export async function shareInvoicePdf(order: Order) {
  const result = await Print.printToFileAsync({ html: buildInvoiceHtml(order) });
  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: `Invoice #${order.invoiceNo}`,
      UTI: "com.adobe.pdf",
    });
    return;
  }

  await Share.share({
    message: `Invoice ready: ${result.uri}`,
  });
}
