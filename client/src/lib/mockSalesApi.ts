import {
  getQuotationById,
  getQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  changeQuotationStatus,
  type QuotationData,
  type QuotationStatus,
} from "@/lib/mockQuotations";
import {
  buildCustomerWithDetailsRecords,
  customerIdFromName,
  mapQuotationToApiDetail,
} from "@/lib/mockSalesShared";

type ApiSuccess<T> = {
  isSuccessful: true;
  message: string;
  data: T;
  showMessage?: boolean;
};

type ApiFailure = {
  isSuccessful: false;
  message: string;
  showMessage?: boolean;
};

function success<T>(data: T, message = "OK"): ApiSuccess<T> {
  return { isSuccessful: true, message, data, showMessage: false };
}

function failure(message: string): ApiFailure {
  return { isSuccessful: false, message, showMessage: true };
}

const STATUS_NAME_TO_ID: Record<string, number> = {
  "Draft Quote": 1,
  "Submitted Quote": 2,
  "Expired Quotations": 3,
  "Converted to SO": 4,
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
      totalCount: records.length,
      totalRecords: records.length,
      totalPages: Math.max(1, Math.ceil(records.length / safeLimit)),
    },
  };
}

function toListRow(q: QuotationData) {
  return {
    id: q.id,
    quotation_code: q.quotationNo,
    quotation_date: q.quotationDate,
    customer_name: q.customerName,
    status_name: q.status,
    status_id: q.statusId ?? STATUS_NAME_TO_ID[q.status] ?? 1,
    discount_amount: q.discountAmount ?? 0,
    total_amount: q.total,
  };
}

export async function mockGetCustomerWithDetails(params?: {
  customer_id?: number;
  search?: string;
  status?: number;
}) {
  let records = buildCustomerWithDetailsRecords();
  if (params?.customer_id != null) {
    records = records.filter((r) => r.customer_id === Number(params.customer_id));
  }
  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    records = records.filter((r) => r.customer_name.toLowerCase().includes(q));
  }
  return success({ records });
}

export async function mockGetQuotationWithDetails(params?: {
  customer_id?: number;
  quotation_id?: number;
  search?: string;
  status?: number;
}) {
  let quotes = getQuotations();
  if (params?.customer_id != null) {
    const cid = Number(params.customer_id);
    quotes = quotes.filter((q) => customerIdFromName(q.customerName) === cid);
  }
  if (params?.quotation_id != null && !Number.isNaN(Number(params.quotation_id))) {
    quotes = quotes.filter((q) => q.id === Number(params.quotation_id));
  }
  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    quotes = quotes.filter(
      (row) =>
        row.quotationNo.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q),
    );
  }

  const records = quotes.map((quote) => {
    const detail = mapQuotationToApiDetail(quote);
    return {
      ...detail,
      quotation: detail,
      _items: detail.items,
      _terms: detail.payment_terms,
    };
  });

  return success({ records });
}

export const mockSalesApi = {
  async getQuotationList(params: {
    search?: string;
    date?: string;
    status_id?: number | string;
    page?: number;
    limit?: number;
  } = {}) {
    let records = getQuotations();
    if (params.date) {
      records = records.filter((q) => q.quotationDate === params.date);
    }
    if (params.status_id != null && params.status_id !== "" && params.status_id !== "all") {
      const statusId = Number(params.status_id);
      records = records.filter(
        (q) => (q.statusId ?? STATUS_NAME_TO_ID[q.status]) === statusId,
      );
    }
    const q = params.search?.trim().toLowerCase();
    if (q) {
      records = records.filter(
        (row) =>
          row.quotationNo.toLowerCase().includes(q) ||
          row.customerName.toLowerCase().includes(q),
      );
    }
    const pageData = paginate(records, params.page ?? 1, params.limit ?? 10);
    return success({
      records: pageData.records.map(toListRow),
      pagination: pageData.pagination,
    });
  },

  async getQuotationById(id: number) {
    const q = getQuotationById(id);
    if (!q) return failure("Quotation not found.");
    return success(mapQuotationToApiDetail(q));
  },

  async saveDraft(data: Record<string, unknown>) {
    const payload = data as Partial<QuotationData>;
    const created = createQuotation({
      ...(payload as Omit<QuotationData, "id">),
      status: (payload.status as QuotationStatus) ?? "Draft Quote",
    });
    return success(mapQuotationToApiDetail(created), "Draft saved.");
  },

  async submitQuotation(data: Record<string, unknown>) {
    const payload = data as Partial<QuotationData>;
    const created = createQuotation({
      ...(payload as Omit<QuotationData, "id">),
      status: "Submitted Quote",
    });
    return success(mapQuotationToApiDetail(created), "Quotation submitted.");
  },

  async updateQuotation(id: number, data: Record<string, unknown>) {
    const updated = updateQuotation(id, data as Partial<QuotationData>);
    if (!updated) return failure("Quotation not found.");
    return success(mapQuotationToApiDetail(updated), "Quotation updated.");
  },

  async deleteQuotation(id: number) {
    const ok = deleteQuotation(id);
    if (!ok) return failure("Quotation not found.");
    return success(undefined, "Quotation deleted.");
  },

  changeQuotationStatus,
};
