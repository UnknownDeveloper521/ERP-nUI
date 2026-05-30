import { format } from "date-fns";
import { WorkerWage } from "./workerPayrollSharedData";
import { CURRENCY_SYMBOL } from "@/config/appConfig";

export const generateWorkerPaymentPDFHTML = (wage: WorkerWage): string => {
    const formattedDate = format(new Date(wage.registerDate), "dd-MM-yyyy");
    const generationTime = format(new Date(), "dd-MM-yyyy, HH:mm");

    return `
        <html>
            <head>
                <title>Worker Payment - ${wage.wagePeriod}</title>
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
                    .status-paid { background: #ecfdf5 !important; color: #059669 !important; border: 1px solid #d1fae5 !important; }

                    .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
                    .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
                    .info-item { margin-bottom: 4px; display: flex; }
                    .info-item strong { width: 120px; color: #64748b; font-size: 10px; flex-shrink: 0; }
                    .info-item span { color: #1a1a1a; font-weight: 600; }

                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; }
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: 700; }

                    .totals-section { margin-top: 20px; display: flex; justify-content: flex-end; }
                    .totals-box { width: 300px; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background: #f8fafc; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
                    .total-row.grand { border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; font-size: 14px; font-weight: 800; color: #1a1a1a; }

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
                            <h1>MASTER-ERP</h1>
                            <p>Industrial Solutions & Services</p>
                            <p>Ahmedabad, Gujarat, India</p>
                        </div>
                        <div class="document-title">
                            <div class="title-row">
                                <h2>PAYMENT VOUCHER</h2>
                                <span class="status ${wage.status.toLowerCase() === 'paid' ? 'status-paid' : ''}">
                                    ${wage.status}
                                </span>
                            </div>
                            <p>PV-${wage.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>

                    <div class="info-box">
                        <h3>General Information</h3>
                        <div class="info-item"><strong>Wage Period</strong><span>${wage.wagePeriod}</span></div>
                        <div class="info-item"><strong>Payment Date</strong><span>${formattedDate}</span></div>
                        <div class="info-item"><strong>Voucher No</strong><span>PV-${wage.id.slice(-6).toUpperCase()}</span></div>
                    </div>

                    <div class="info-box">
                        <h3>Departmental Details</h3>
                        <div class="info-item"><strong>Department</strong><span>${wage.department}</span></div>
                        <div class="info-item"><strong>Location</strong><span>${wage.location}</span></div>
                    </div>

                    <div class="section-header" style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px; margin-top: 15px;">Payment Details</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px;" class="text-center">#</th>
                                <th>DESCRIPTION</th>
                                <th style="width: 80px;" class="text-center">WORKERS</th>
                                <th style="width: 120px;" class="text-right">RATE / WORKER</th>
                                <th style="width: 120px;" class="text-right">TOTAL AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="text-center">1</td>
                                <td>
                                    <div class="font-bold">Worker Category: ${wage.workerCategory}</div>
                                    <div style="font-size: 9px; color: #64748b;">Operation: ${wage.operation}</div>
                                </td>
                                <td class="text-center">${wage.noOfWorkers}</td>
                                <td class="text-right">${CURRENCY_SYMBOL}${wage.netWageAmount.toLocaleString()}</td>
                                <td class="text-right font-bold">${CURRENCY_SYMBOL}${wage.totalWageAmount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row grand">
                                <span>NET PAID</span>
                                <span>${CURRENCY_SYMBOL}${wage.totalWageAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is a computer generated payment voucher. Generated on ${generationTime}</p>
                        <p>Tassos Consultancy Services | Industrial ERP Solutions</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};
