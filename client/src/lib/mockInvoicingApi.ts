import {
  getInvoiceById,
  getInvoices,
  type InvoiceData,
} from "@/lib/mockInvoices";
import { mapInvoiceToApiDetail } from "@/lib/mockSalesShared";

type ApiSuccess<T> = { isSuccessful: true; message: string; data: T; showMessage?: boolean };
type ApiFailure = { isSuccessful: false; message: string; showMessage?: boolean };

function success<T>(data: T, message = "OK"): ApiSuccess<T> {
  return { isSuccessful: true, message, data, showMessage: false };
}

function failure(message: string): ApiFailure {
  return { isSuccessful: false, message, showMessage: true };
}

const INVOICE_STATUS_ID: Record<string, number> = {
  Draft: 1,
  Open: 2,
  "Partially Paid": 3,
  Closed: 4,
  Overdue: 5,
  Cancelled: 6,
};

function paginate<T>(records: T[], page = 1, limit = 10) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  return {
    records: records.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalRecords: records.length,
    },
  };
}

export const mockInvoicingApi = {
  async getInvoicesList(params: {
    search?: string;
    date?: string;
    status_id?: number | string;
    page?: number;
    limit?: number;
  } = {}) {
    let records = getInvoices();
    if (params.date) {
      records = records.filter((inv) => inv.invoiceDate === params.date);
    }
    if (params.status_id != null && params.status_id !== "") {
      const statusName = Object.entries(INVOICE_STATUS_ID).find(
        ([, id]) => id === Number(params.status_id),
      )?.[0];
      if (statusName) records = records.filter((inv) => inv.status === statusName);
    }
    const q = params.search?.trim().toLowerCase();
    if (q) {
      records = records.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.soNumber.toLowerCase().includes(q),
      );
    }
    const pageData = paginate(records, params.page ?? 1, params.limit ?? 10);
    return success({
      records: pageData.records.map((inv) => ({
        invoice_id: inv.id,
        invoice_code: inv.invoiceNumber,
        invoice_date: inv.invoiceDate,
        sales_order_id: inv.id,
        so_code: inv.soNumber,
        customer_name: inv.customerName,
        invoice_amount: inv.grandTotal,
        currency_name: inv.currency,
        status_id: INVOICE_STATUS_ID[inv.status] ?? 1,
        status_name: inv.status,
      })),
      pagination: pageData.pagination,
    });
  },

  async getInvoiceById(id: number) {
    const invoice = getInvoiceById(id);
    if (!invoice) return failure("Invoice not found.");
    return success(mapInvoiceToApiDetail(invoice));
  },

  async updateInvoice(id: number, data: Record<string, unknown>) {
    const invoice = getInvoiceById(id);
    if (!invoice) return failure("Invoice not found.");
    if (data.status_code === "Open" || data.status_name === "Open") {
      (invoice as InvoiceData).status = "Open";
    }
    return success(undefined, "Invoice updated.");
  },

  async cancelInvoice(invoice_id: number) {
    const invoice = getInvoiceById(invoice_id);
    if (!invoice) return failure("Invoice not found.");
    invoice.status = "Cancelled";
    return success(invoice, "Invoice cancelled.");
  },

  async getPendingPaymentsList(_params: Record<string, unknown>) {
    const records = getInvoices()
      .filter((inv) => inv.status === "Open" || inv.status === "Partially Paid" || inv.status === "Overdue")
      .map((inv) => ({
        pending_payment_id: inv.id,
        invoice_id: inv.id,
        invoice_code: inv.invoiceNumber,
        customer_name: inv.customerName,
        due_amount: inv.grandTotal,
        due_date: inv.dueDate,
        status_name: inv.status,
      }));
    return success({ records, pagination: { page: 1, limit: 50, totalRecords: records.length } });
  },

  async getPendingPaymentById(id: number) {
    const invoice = getInvoiceById(id);
    if (!invoice) return failure("Pending payment not found.");
    return success({
      invoice_id: invoice.id,
      invoice_code: invoice.invoiceNumber,
      customer_name: invoice.customerName,
      due_amount: invoice.grandTotal,
      invoice: mapInvoiceToApiDetail(invoice),
    });
  },

  async updatePendingPayment(_id: number, _data: Record<string, unknown>) {
    return success(undefined, "Payment recorded.");
  },
};
