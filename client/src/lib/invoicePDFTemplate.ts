import { format } from "date-fns";

// Unified Invoice PDF Template
// Used by: Invoicing module (preview & download) and Sales Order module (download invoice)

export interface InvoicePDFData {
    invoiceNumber: string;
    invoiceDate: string;
    status: string;
    customerName: string;
    contactPerson: string;
    mobileNo?: string;
    billingAddress: string;
    shippingAddress: string;
    soNumber: string;
    soDate?: string;
    deliveryDate?: string;
    currency: string;
    remarks?: string;
    terms: Array<{
        id: number;
        percentage: number;
        termType: string;
        date?: string;
        days?: number;
    }>;
    items: Array<{
        id: number;
        itemName: string;
        uom: string;
        orderedQty: number;
        rate: number;
        price: number;
    }>;
    discountValue?: number;
    discountType?: "%" | "Amount";
    taxPercentage: number;
    taxValue?: number;
    taxType?: "%" | "Amount";
}

const calculateTotals = (
    items: InvoicePDFData['items'], 
    discountValue: number = 0, 
    discountType: "%" | "Amount" = "%",
    taxValue: number = 0, 
    taxType: "%" | "Amount" = "%"
) => {
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    
    // Calculate discount
    let discountAmount = 0;
    if (discountType === "%") {
        discountAmount = (subtotal * discountValue) / 100;
    } else {
        discountAmount = discountValue;
    }
    
    const afterDiscount = subtotal - discountAmount;
    
    // Calculate tax
    let totalTax = 0;
    if (taxType === "%") {
        totalTax = (afterDiscount * taxValue) / 100;
    } else {
        totalTax = taxValue;
    }
    
    const grandTotal = afterDiscount + totalTax;
    return { subtotal, discountAmount, totalTax, grandTotal };
};

export const generateInvoicePDFHTML = (invoice: InvoicePDFData): string => {
    const { subtotal, discountAmount, totalTax, grandTotal } = calculateTotals(
        invoice.items, 
        invoice.discountValue || 0,
        invoice.discountType || "%",
        invoice.taxValue || invoice.taxPercentage,
        invoice.taxType || "%"
    );
    const formattedInvoiceDate = format(new Date(invoice.invoiceDate), "dd-MM-yyyy");

    return `
        <html>
            <head>
                <title>Invoice - ${invoice.invoiceNumber}</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #1a1a1a; line-height: 1.4; font-size: 11px; background: white; }
                    .container { width: 100%; max-width: 100%; margin: 0 auto; }
                    
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
                    .company-info h1 { margin: 0; color: #1a1a1a; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                    .company-info p { margin: 2px 0; color: #4a4a4a; font-size: 10px; }
                    
                    .document-title { text-align: right; }
                    .document-title h2 { margin: 0; font-size: 18px; color: #1a1a1a; }
                    .document-title p { margin: 2px 0; font-weight: 700; color: #1a1a1a; font-size: 12px; }
                    .document-title .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 4px; background: #f5f5f5; color: #333; }

                    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    .info-box { border: 1px solid #d0d0d0; padding: 10px; border-radius: 6px; }
                    .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                    .info-item { margin-bottom: 4px; display: flex; }
                    .info-item strong { width: 110px; color: #4a4a4a; font-size: 10px; flex-shrink: 0; }
                    .info-item span { color: #1a1a1a; font-weight: 500; }

                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    th { background-color: #f5f5f5; color: #333; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #d0d0d0; text-align: left; }
                    td { padding: 8px 10px; border: 1px solid #d0d0d0; font-size: 10px; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: 700; }

                    .totals-section { margin-top: 20px; display: flex; justify-content: flex-end; }
                    .totals-box { width: 300px; border: 1px solid #d0d0d0; padding: 12px; border-radius: 6px; background: #f5f5f5; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
                    .total-row.grand { border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; font-size: 14px; font-weight: 800; color: #1a1a1a; }

                    .terms-bullets { margin-top: 15px; }
                    .terms-bullets h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
                    
                    .remarks-section { margin-top: 15px; }
                    .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
                    .remarks-box { border: 1px solid #d0d0d0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f5f5f5; }
                    
                    .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #d0d0d0; text-align: center; font-size: 9px; color: #888; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-info">
                            <h1>MASTER-ERP</h1>
                            <p>Industrial Solutions & Services</p>
                            <p>Ahmedabad, Gujarat, India</p>
                        </div>
                        <div class="document-title">
                            <h2>TAX INVOICE</h2>
                            <p>${invoice.invoiceNumber}</p>
                            <div class="status status-simple">
                                ${invoice.status.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div class="info-box" style="margin-bottom: 15px;">
                        <h3>Bill To</h3>
                        <div class="info-item"><strong>Customer</strong><span>${invoice.customerName}</span></div>
                        <div class="info-item"><strong>Contact Person</strong><span>${invoice.contactPerson}</span></div>
                        <div class="info-item"><strong>Mobile</strong><span>${invoice.mobileNo || "N/A"}</span></div>
                        <div class="info-item"><strong>Billing Address</strong><span>${invoice.billingAddress}</span></div>
                        <div class="info-item"><strong>Shipping Address</strong><span>${invoice.shippingAddress}</span></div>
                    </div>

                    <div class="info-box" style="margin-bottom: 20px;">
                        <h3>Invoice Details</h3>
                        <div class="info-item"><strong>Invoice Date</strong><span>${formattedInvoiceDate}</span></div>
                        <div class="info-item"><strong>SO Number</strong><span>${invoice.soNumber}</span></div>
                        <div class="info-item"><strong>SO Date</strong><span>${invoice.soDate ? format(new Date(invoice.soDate), "dd-MM-yyyy") : "-"}</span></div>
                        <div class="info-item"><strong>Delivery Date</strong><span>${invoice.deliveryDate ? format(new Date(invoice.deliveryDate), "dd-MM-yyyy") : "-"}</span></div>
                        <div class="info-item"><strong>Currency</strong><span style="font-weight: 700; color: #1a1a1a;">${invoice.currency || "USD"}</span></div>
                    </div>

                    ${invoice.remarks ? `
                        <div class="remarks-section">
                            <h3>Remarks / Special Instructions</h3>
                            <div class="remarks-box">${invoice.remarks}</div>
                        </div>
                    ` : ""}

                    ${invoice.terms.length > 0 ? `
                        <div class="terms-bullets">
                            <h3>Payment Terms</h3>
                            <div style="margin-top: 8px;">
                                ${invoice.terms.map(term => {
                                    let termDescription = `${term.percentage}% ${term.termType}`;
                                    
                                    // FIX 2: Show proper due information based on term type
                                    if (term.termType === "Delivery" || term.termType === "On Delivery") {
                                        if (term.date) {
                                            termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                        } else if (invoice.deliveryDate) {
                                            termDescription += ` – Due on delivery (${format(new Date(invoice.deliveryDate), "dd-MM-yyyy")})`;
                                        } else {
                                            termDescription += ` – Due on delivery`;
                                        }
                                    } else if (term.termType === "Days" && term.days) {
                                        // Calculate due date: Invoice Date + days
                                        const invoiceDate = new Date(invoice.invoiceDate);
                                        const dueDate = new Date(invoiceDate);
                                        dueDate.setDate(dueDate.getDate() + term.days);
                                        termDescription += ` within ${term.days} days – Due on ${format(dueDate, "dd-MM-yyyy")}`;
                                    } else if (term.termType === "Advance") {
                                        if (term.date) {
                                            termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                        } else {
                                            termDescription += ` – Due on order confirmation`;
                                        }
                                    } else if (term.date) {
                                        termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                    }
                                    
                                    return `
                                        <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                                            <span style="color: #333; font-weight: bold; margin-top: 2px;">•</span>
                                            <p style="color: #333; font-size: 10px; line-height: 1.5; margin: 0;">${termDescription}</p>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </div>
                    ` : ""}

                    <table>
                        <thead>
                            <tr>
                                <th width="50">#</th>
                                <th>Item Name</th>
                                <th width="60" class="text-center">UOM</th>
                                <th width="80" class="text-right">Qty</th>
                                <th width="80" class="text-right">Rate</th>
                                <th width="100" class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoice.items.map((item, index) => `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td class="font-bold">${item.itemName}</td>
                                    <td class="text-center">${item.uom}</td>
                                    <td class="text-right">${item.orderedQty}</td>
                                    <td class="text-right">${item.rate.toFixed(2)}</td>
                                    <td class="text-right font-bold">${item.price.toFixed(2)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span class="font-bold">${invoice.currency || "USD"} ${subtotal.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Discount (${invoice.discountType === "%" ? (invoice.discountValue || 0) + "%" : "Amount"}):</span>
                                <span class="font-bold" style="color: #dc2626;">-${invoice.currency || "USD"} ${discountAmount.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Tax (${invoice.taxType === "%" ? (invoice.taxValue || invoice.taxPercentage) + "%" : "Amount"}):</span>
                                <span class="font-bold">${invoice.currency || "USD"} ${totalTax.toFixed(2)}</span>
                            </div>
                            <div class="total-row grand">
                                <span>Grand Total:</span>
                                <span>${invoice.currency || "USD"} ${grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is a computer generated document. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}</p>
                        <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};
