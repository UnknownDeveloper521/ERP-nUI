import { format } from "date-fns";

// Unified Quotation PDF Template
// Used by: Quotations module (preview & download) and Sales Order module (download quotation)

export interface QuotationPDFData {
    quotationNo?: string;
    quotationDate: string;
    quotationValidity: string;
    deliveryTime?: string;
    currency: string;
    customerName: string;
    contactPersonName?: string;
    contactNumber?: string;
    billingAddress?: string;
    shippingAddress?: string;
    remarks?: string;
    paymentTerms?: Array<{
        id: number;
        terms: string;
        value?: number;
        percentage?: number;
        days?: number;
        date?: string;
        valueType?: string;
    }>;
    items: Array<{
        id: number;
        itemCode?: string;
        item: string;
        qty: number | string;
        rate: number | string;
        amount: number;
    }>;
    subtotal: number;
    discountValue?: number;
    discountType?: "%" | "Amount";
    discountAmount?: number;
    taxPercentage: number;
    taxValue?: number;
    taxType?: "%" | "Amount";
    taxAmount: number;
    total: number;
}

const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    try {
        return format(new Date(dateStr), "dd-MM-yyyy");
    } catch {
        return '—';
    }
};

export const generateQuotationPDFHTML = (quotation: QuotationPDFData): string => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quotation ${quotation.quotationNo}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page {
                    size: A4;
                    margin: 15mm;
                }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    color: #1a1a1a;
                    line-height: 1.4;
                    background: white;
                    font-size: 11px;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #333;
                    page-break-after: avoid;
                }
                
                .company-info h1 {
                    color: #1a1a1a;
                    font-size: 22px;
                    font-weight: bold;
                    margin-bottom: 3px;
                }
                
                .company-info p {
                    color: #4a4a4a;
                    font-size: 10px;
                    line-height: 1.3;
                }
                
                .document-title {
                    text-align: right;
                }
                
                .document-title h2 {
                    font-size: 20px;
                    color: #1a1a1a;
                    margin-bottom: 3px;
                }
                
                .document-title p {
                    color: #4a4a4a;
                    font-size: 11px;
                }
                
                .section {
                    margin-bottom: 16px;
                    page-break-inside: avoid;
                }
                
                .section-title {
                    font-weight: 600;
                    font-size: 10px;
                    color: #4a4a4a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid #d0d0d0;
                    page-break-after: avoid;
                }
                
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px 20px;
                }
                
                .info-item {
                    margin-bottom: 0;
                }
                
                .info-label {
                    font-size: 9px;
                    color: #666;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin-bottom: 2px;
                }
                
                .info-value {
                    font-size: 11px;
                    color: #1a1a1a;
                    font-weight: 500;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 10px;
                    page-break-inside: avoid;
                }
                
                thead {
                    background-color: #f5f5f5;
                    page-break-after: avoid;
                }
                
                th {
                    padding: 8px 10px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 9px;
                    color: #333;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #d0d0d0;
                }
                
                th.text-right {
                    text-align: right;
                }
                
                td {
                    padding: 7px 10px;
                    border-bottom: 1px solid #e8e8e8;
                    color: #333;
                    font-size: 10px;
                }
                
                td.text-right {
                    text-align: right;
                }
                
                .totals-section {
                    margin-top: 12px;
                    display: flex;
                    justify-content: flex-end;
                }
                
                .totals-box {
                    width: 280px;
                    border: 1px solid #d0d0d0;
                    overflow: hidden;
                }
                
                .totals-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 12px;
                    border-bottom: 1px solid #e8e8e8;
                    font-size: 10px;
                }
                
                .totals-row:last-child {
                    border-bottom: none;
                }
                
                .totals-row.subtotal {
                    background-color: #f5f5f5;
                }
                
                .totals-row.total {
                    background-color: #333;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                }
                
                .totals-label {
                    color: #666;
                }
                
                .totals-row.total .totals-label {
                    color: white;
                }
                
                .totals-value {
                    font-weight: 600;
                    color: #1a1a1a;
                }
                
                .totals-row.total .totals-value {
                    color: white;
                }
                
                .footer {
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #d0d0d0;
                    text-align: center;
                    font-size: 9px;
                    color: #888;
                    line-height: 1.4;
                    page-break-inside: avoid;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .no-print {
                        display: none;
                    }
                    
                    @page {
                        margin: 15mm;
                        size: A4 portrait;
                    }
                    
                    * {
                        page-break-inside: avoid;
                    }
                    
                    .section {
                        page-break-inside: avoid;
                    }
                    
                    table {
                        page-break-inside: avoid;
                    }
                    
                    .footer {
                        page-break-before: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <h1>MASTER-ERP</h1>
                    <p>Industrial Solutions & Services<br>
                    Ahmedabad, Gujarat, India</p>
                </div>
                <div class="document-title">
                    <h2>QUOTATION</h2>
                    <p># ${quotation.quotationNo || 'DRAFT'}</p>
                </div>
            </div>

            <!-- Quotation Details -->
            <div class="section">
                <div class="section-title">Quotation Details</div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Quotation No</div>
                        <div class="info-value">${quotation.quotationNo || '—'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Quotation Date</div>
                        <div class="info-value">${formatDate(quotation.quotationDate)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Quotation Validity Date</div>
                        <div class="info-value">${formatDate(quotation.quotationValidity)}</div>
                    </div>
                    ${quotation.deliveryTime ? `
                    <div class="info-item">
                        <div class="info-label">Expected Delivery Date</div>
                        <div class="info-value">${formatDate(quotation.deliveryTime)}</div>
                    </div>
                    ` : ''}
                    <div class="info-item">
                        <div class="info-label">Currency</div>
                        <div class="info-value">${quotation.currency}</div>
                    </div>
                </div>
            </div>

            <!-- Customer Information -->
            <div class="section">
                <div class="section-title">Customer Information</div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Customer Name</div>
                        <div class="info-value">${quotation.customerName}</div>
                    </div>
                    ${quotation.contactPersonName ? `
                    <div class="info-item">
                        <div class="info-label">Contact Person</div>
                        <div class="info-value">${quotation.contactPersonName}</div>
                    </div>
                    ` : ''}
                    ${quotation.contactNumber ? `
                    <div class="info-item">
                        <div class="info-label">Contact Number</div>
                        <div class="info-value">${quotation.contactNumber}</div>
                    </div>
                    ` : ''}
                    ${quotation.billingAddress ? `
                    <div class="info-item">
                        <div class="info-label">Billing Address</div>
                        <div class="info-value">${quotation.billingAddress}</div>
                    </div>
                    ` : ''}
                    ${quotation.shippingAddress ? `
                    <div class="info-item">
                        <div class="info-label">Shipping Address</div>
                        <div class="info-value">${quotation.shippingAddress}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${quotation.remarks ? `
            <!-- Remarks -->
            <div class="section">
                <div class="section-title">Remarks</div>
                <p style="color: #333; font-size: 10px; line-height: 1.5;">${quotation.remarks}</p>
            </div>
            ` : ''}

            ${quotation.paymentTerms && quotation.paymentTerms.length > 0 ? `
            <!-- Payment Terms -->
            <div class="section">
                <div class="section-title">Payment Terms</div>
                <div style="margin-top: 8px;">
                    ${quotation.paymentTerms.map(term => {
                        const value = term.value || term.percentage || 0;
                        
                        let termText = "";
                        let termDate = "";
                        
                        if (term.terms === "Advance") {
                            termText = `${value}% Advance`;
                            termDate = formatDate(quotation.quotationDate);
                        } else if (term.terms === "Delivery") {
                            termText = `${value}% Delivery`;
                            termDate = "On delivery";
                        } else if (term.terms === "Days") {
                            termText = `${value}% Payment`;
                            termDate = `${term.days || 0} days from invoice date`;
                        }
                        
                        return `
                            <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                                <span style="color: #333; font-weight: bold; margin-top: 2px;">•</span>
                                <p style="color: #333; font-size: 10px; line-height: 1.5; margin: 0;">${termText} – ${termDate}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Items -->
            <div class="section">
                <div class="section-title">Items</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 8%;">#</th>
                            <th style="width: 42%;">Item</th>
                            <th class="text-right" style="width: 12%;">Qty</th>
                            <th class="text-right" style="width: 18%;">Rate</th>
                            <th class="text-right" style="width: 20%;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quotation.items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td><strong>${item.item}</strong></td>
                                <td class="text-right">${item.qty || 0}</td>
                                <td class="text-right">${quotation.currency} ${(Number(item.rate) || 0).toFixed(2)}</td>
                                <td class="text-right"><strong>${quotation.currency} ${(Number(item.amount) || 0).toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Financial Summary -->
                <div class="totals-section">
                    <div class="totals-box">
                        <div class="totals-row subtotal">
                            <span class="totals-label">Subtotal</span>
                            <span class="totals-value">${quotation.currency} ${(Number(quotation.subtotal) || 0).toFixed(2)}</span>
                        </div>
                        <div class="totals-row">
                            <span class="totals-label">Discount (${quotation.discountType === "%" ? (quotation.discountValue || 0) + "%" : "Amount"})</span>
                            <span class="totals-value" style="color: #dc2626;">-${quotation.currency} ${(Number(quotation.discountAmount) || 0).toFixed(2)}</span>
                        </div>
                        <div class="totals-row">
                            <span class="totals-label">Tax (${quotation.taxType === "%" ? (quotation.taxValue || quotation.taxPercentage || 0) + "%" : "Amount"})</span>
                            <span class="totals-value">${quotation.currency} ${(Number(quotation.taxAmount) || 0).toFixed(2)}</span>
                        </div>
                        <div class="totals-row total">
                            <span class="totals-label">Grand Total</span>
                            <span class="totals-value">${quotation.currency} ${(Number(quotation.total) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>This is a computer-generated quotation. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}.</p>
                <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
            </div>
        </body>
        </html>
    `;
};
