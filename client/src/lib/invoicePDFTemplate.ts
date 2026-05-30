import { format } from "date-fns";

// Unified Invoice PDF Template
// Used by: Invoicing module (preview & download) and Sales Order module (download invoice)

export interface InvoicePDFData {
    companyName?: string;
    companyAddress?: string;
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
    currencySymbol: string;
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

    const isDraft = invoice.status.toUpperCase() === "DRAFT";
    const formattedInvoiceDate = isDraft ? "-" : format(new Date(invoice.invoiceDate), "dd-MM-yyyy");

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
                    
                    .document-title { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
                    .title-row { display: flex; align-items: center; gap: 10px; }
                    .document-title h2 { margin: 0; font-size: 18px; color: #1a1a1a; }
                    .document-title p { margin: 2px 0; font-weight: 700; color: #1a1a1a; font-size: 12px; }
                    .document-title .status { 
                        padding: 2px 8px; 
                        border-radius: 4px; 
                        font-size: 9px; 
                        font-weight: 700; 
                        text-transform: uppercase;
                        background: #f1f5f9; 
                        color: #475569;
                        border: 1px solid #e2e8f0;
                    }
                    .status-open { background: #eff6ff !important; color: #1d4ed8 !important; border: 1px solid #dbeafe !important; }

                    .info-box { border: 1px solid #d0d0d0; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
                    .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                    .info-item { margin-bottom: 4px; display: flex; }
                    .info-item strong { width: 110px; color: #4a4a4a; font-size: 10px; flex-shrink: 0; }
                    .info-item span { color: #1a1a1a; font-weight: 500; }

                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; }
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: 700; }

                    .totals-section { margin-top: 20px; display: flex; justify-content: flex-end; }
                    .totals-box { width: 300px; border: 1px solid #d0d0d0; padding: 12px; border-radius: 6px; background: #f8fafc; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
                    .total-row.grand { border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; font-size: 14px; font-weight: 800; color: #1a1a1a; }

                    .section-header { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px; margin-top: 15px; }
                    
                    .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #d0d0d0; text-align: center; font-size: 9px; color: #94a3b8; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-info">
                            <h1>${invoice.companyName || "MASTER-ERP"}</h1>
                            <p>${invoice.companyAddress || "Industrial Solutions & Services<br>Ahmedabad, Gujarat, India"}</p>
                        </div>
                        <div class="document-title">
                            <div class="title-row">
                                <h2>TAX INVOICE</h2>
                                <span class="status ${invoice.status.toLowerCase() === 'open' ? 'status-open' : ''}">
                                    ${invoice.status}
                                </span>
                            </div>
                            <p>${isDraft ? "-" : invoice.invoiceNumber}</p>
                        </div>
                    </div>

                    <div class="info-box">
                        <h3>Bill To</h3>
                        <div class="info-item"><strong>Customer</strong><span>${invoice.customerName}</span></div>
                        <div class="info-item"><strong>Contact Person</strong><span>${invoice.contactPerson}</span></div>
                        <div class="info-item"><strong>Mobile</strong><span>${invoice.mobileNo || "N/A"}</span></div>
                        <div class="info-item"><strong>Billing Address</strong><span>${invoice.billingAddress}</span></div>
                        <div class="info-item"><strong>Shipping Address</strong><span>${invoice.shippingAddress}</span></div>
                    </div>

                    <div class="info-box">
                        <h3>Invoice Details</h3>
                        <div class="info-item"><strong>Invoice Date</strong><span>${formattedInvoiceDate}</span></div>
                        <div class="info-item"><strong>SO Code</strong><span>${invoice.soNumber}</span></div>
                        <div class="info-item"><strong>SO Date</strong><span>${invoice.soDate ? format(new Date(invoice.soDate), "dd-MM-yyyy") : "-"}</span></div>
                        <div class="info-item"><strong>Delivery Date</strong><span>${invoice.deliveryDate ? format(new Date(invoice.deliveryDate), "dd-MM-yyyy") : "-"}</span></div>
                        <div class="info-item"><strong>Currency</strong><span style="font-weight: 700;">${invoice.currency || "USD"}</span></div>
                    </div>

                    ${invoice.terms && invoice.terms.length > 0 ? `
                        <div style="margin-bottom: 20px;">
                            <div class="section-header">Payment Terms</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 40%;">TERM TYPE</th>
                                        <th class="text-center" style="width: 20%;">PERCENTAGE</th>
                                        <th class="text-center" style="width: 15%;">DAYS</th>
                                        <th class="text-right" style="width: 25%;">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoice.terms.map(term => `
                                        <tr>
                                            <td>${term.termType}</td>
                                            <td class="text-center">${term.percentage}%</td>
                                            <td class="text-center">${term.days || "-"}</td>
                                            <td class="text-right font-bold">
                                                ${invoice.currencySymbol} ${((grandTotal * term.percentage) / 100).toFixed(2)}
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : ""}

                    <div class="section-header">Invoice Items</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px;" class="text-center">#</th>
                                <th>ITEM NAME</th>
                                <th style="width: 60px;" class="text-center">UOM</th>
                                <th style="width: 60px;" class="text-center">QTY</th>
                                <th style="width: 100px;" class="text-right">UNIT PRICE</th>
                                <th style="width: 120px;" class="text-right">AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoice.items.map((item, index) => `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td class="font-bold">${item.itemName}</td>
                                    <td class="text-center">${item.uom}</td>
                                    <td class="text-center">${item.orderedQty}</td>
                                    <td class="text-right">${invoice.currencySymbol} ${item.rate.toFixed(2)}</td>
                                    <td class="text-right font-bold">${invoice.currencySymbol} ${item.price.toFixed(2)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span class="font-bold">${invoice.currencySymbol} ${subtotal.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span style="color: #64748b;">Discount (${invoice.discountValue}%):</span>
                                <span class="font-bold" style="color: #dc2626;">-${invoice.currencySymbol} ${discountAmount.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span style="color: #64748b;">Tax (${invoice.taxPercentage}%):</span>
                                <span class="font-bold">${invoice.currencySymbol} ${totalTax.toFixed(2)}</span>
                            </div>
                            <div class="total-row grand">
                                <span>GRAND TOTAL</span>
                                <span>${invoice.currencySymbol} ${grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is a computer generated document. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}</p>
                        <p>${invoice.companyName || "Tassos Consultancy Services"} | ${invoice.companyAddress || "Govt IT Solutions | Ahmedabad"}</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};
