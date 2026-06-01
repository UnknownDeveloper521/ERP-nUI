import {
  changeSOStatus,
  closeSalesOrder,
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrderById,
  getSalesOrders,
  updateSalesOrder,
  type SOData,
  type SOStatus,
} from "@/lib/mockSalesOrders";
import { mapSalesOrderToApiDetail } from "@/lib/mockSalesShared";

type ApiSuccess<T> = { isSuccessful: true; message: string; data: T; showMessage?: boolean };
type ApiFailure = { isSuccessful: false; message: string; showMessage?: boolean };

function success<T>(data: T, message = "OK"): ApiSuccess<T> {
  return { isSuccessful: true, message, data, showMessage: false };
}

function failure(message: string): ApiFailure {
  return { isSuccessful: false, message, showMessage: true };
}

const SO_STATUS_ID: Record<string, number> = {
  Draft: 1,
  "Invoice Pending": 2,
  Invoiced: 3,
  "Dispatch Pending": 4,
  Dispatched: 5,
  Close: 6,
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
      totalCount: records.length,
      totalPages: Math.max(1, Math.ceil(records.length / safeLimit)),
    },
  };
}

export const mockSalesOrdersApi = {
  async getSOList(params: {
    search?: string;
    date?: string;
    status_id?: number | string;
    page?: number;
    limit?: number;
  } = {}) {
    let records = getSalesOrders();
    if (params.date) {
      records = records.filter((so) => so.soDate === params.date);
    }
    if (params.status_id != null && params.status_id !== "") {
      const statusName = Object.entries(SO_STATUS_ID).find(
        ([, id]) => id === Number(params.status_id),
      )?.[0];
      if (statusName) records = records.filter((so) => so.status === statusName);
    }
    const q = params.search?.trim().toLowerCase();
    if (q) {
      records = records.filter(
        (so) =>
          so.soNumber.toLowerCase().includes(q) ||
          so.customerName.toLowerCase().includes(q),
      );
    }
    const pageData = paginate(records, params.page ?? 1, params.limit ?? 10);
    return success({
      records: pageData.records.map((so) => ({
        id: so.id,
        sales_order_code: so.soNumber,
        order_date: so.soDate,
        customer_name: so.customerName,
        status_id: SO_STATUS_ID[so.status] ?? 1,
        status_name: so.status,
      })),
      pagination: pageData.pagination,
    });
  },

  async getSOById(id: number) {
    const so = getSalesOrderById(id);
    if (!so) return failure("Sales order not found.");
    return success(mapSalesOrderToApiDetail(so));
  },

  async saveAsDraftSO(data: Record<string, unknown>) {
    const created = createSalesOrder({ ...(data as Omit<SOData, "id">), status: "Draft" });
    return success(mapSalesOrderToApiDetail(created), "Draft saved.");
  },

  async submitSO(data: Record<string, unknown>) {
    const created = createSalesOrder({
      ...(data as Omit<SOData, "id">),
      status: "Invoice Pending",
    });
    return success({
      id: created.id,
      sales_order_code: created.soNumber,
    });
  },

  async updateSO(data: Record<string, unknown> & { id: number }) {
    const { id, ...rest } = data;
    const updated = updateSalesOrder(id, rest as Partial<SOData>);
    if (!updated) return failure("Sales order not found.");
    return success(undefined, "Sales order updated.");
  },

  async deleteSO(id: number) {
    const ok = deleteSalesOrder(id);
    if (!ok) return failure("Sales order not found.");
    return success(undefined, "Sales order deleted.");
  },

  async getSalesOrderItems(salesOrderId: number) {
    const so = getSalesOrderById(salesOrderId);
    if (!so) return failure("Sales order not found.");
    const detail = mapSalesOrderToApiDetail(so);
    return success({
      records: detail.items.map((item: Record<string, unknown>) => ({
        ...item,
        remaining_qty:
          Number(item.quantity ?? 0) - Number(item.dispatch_qty ?? 0),
      })),
    });
  },

  changeSOStatus,
  closeSalesOrder,
};
