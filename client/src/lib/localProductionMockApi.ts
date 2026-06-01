import { format } from "date-fns";
import {
  PRODUCTION_PLAN_STORAGE_KEY,
  type LocalProductionPlanRecord,
} from "@/lib/localMasterSeed";
import {
  BATCH_STORAGE_KEY,
  MATERIAL_RELEASE_STORAGE_KEY,
  MOCK_WAREHOUSES,
  MOCK_WORK_CENTERS,
  MR_STORAGE_KEY,
  WORK_CENTER_OPERATION_CODES,
  type LocalBatchRecord,
  type LocalMaterialReleaseRecord,
  type LocalMrRecord,
} from "@/lib/localProductionSeed";
import { getGsv7DemoOperationId } from "@/lib/gsv7OperationsMockData";
import { mockProductionPlanApi } from "@/lib/localMasterMockApi";

type ApiSuccess<T> = {
  isSuccessful: true;
  message: string;
  data: T;
  showMessage?: boolean;
};

type ApiFailure = {
  isSuccessful: false;
  message: string;
  data?: undefined;
  showMessage?: boolean;
};

function success<T>(data: T, message = "OK"): ApiSuccess<T> {
  return { isSuccessful: true, message, data, showMessage: false };
}

function failure(message: string): ApiFailure {
  return { isSuccessful: false, message, showMessage: true };
}

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, records: T[]) {
  localStorage.setItem(key, JSON.stringify(records));
}

function nextId(records: { id?: number; batch_id?: number; release_id?: number }[]) {
  const ids = records.map((r) => r.id ?? r.batch_id ?? r.release_id ?? 0);
  if (ids.length === 0) return 1;
  return Math.max(...ids) + 1;
}

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

function filterSearch<T extends Record<string, unknown>>(records: T[], search?: string, keys: string[]) {
  const q = search?.trim().toLowerCase();
  if (!q) return records;
  return records.filter((row) =>
    keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
  );
}

function toBatchListRow(b: LocalBatchRecord) {
  return {
    batch_id: b.batch_id,
    batch_code: b.batch_code,
    batch_date: b.batch_date,
    mr_id: b.mr_id,
    mr_code: b.mr_code,
    operation_id: b.operation_id,
    operation_name: b.operation_name,
    work_center_id: b.work_center_id,
    work_center_name: b.work_center_name,
    shift_id: b.shift_id,
    shift_name: b.shift_name,
    status_id: b.status_id,
    status_name: b.status_name,
  };
}

function toMrListRow(m: LocalMrRecord) {
  return {
    id: m.id,
    mr_code: m.mr_code,
    request_date: m.request_date,
    required_by_date: m.required_by_date,
    operation_id: m.operation_id,
    operation_name: m.operation_name,
    work_center_id: m.work_center_id,
    work_center_name: m.work_center_name,
    warehouse_id: m.warehouse_id,
    warehouse_name: m.warehouse_name,
    shift_id: m.shift_id,
    shift_name: m.shift_name,
    production_plan_id: m.production_plan_id,
    production_plan_code: m.production_plan_code,
    status_id: m.status_id,
    status_name: m.status_name,
    requested_by_name: m.requested_by_name,
    received_date: m.received_date,
    items: m.items,
  };
}

export async function mockGetWorkCenters() {
  return success({ records: [...MOCK_WORK_CENTERS] });
}

export async function mockGetWarehouses() {
  return success({ records: [...MOCK_WAREHOUSES] });
}

export async function mockGetMRForBatch(params?: { shift_id?: number | string }) {
  let records = readJson<LocalMrRecord>(MR_STORAGE_KEY).filter(
    (mr) => mr.status_id === 3,
  );
  if (params?.shift_id != null && params.shift_id !== "" && params.shift_id !== "all") {
    const shiftId = Number(params.shift_id);
    records = records.filter((mr) => mr.shift_id === shiftId);
  }
  return success({
    records: records.map((mr) => ({
      mr_id: mr.id,
      id: mr.id,
      mr_code: mr.mr_code,
      request_date: mr.request_date,
      required_by_date: mr.required_by_date,
      operation_id: mr.operation_id,
      operation_name: mr.operation_name,
      work_center_id: mr.work_center_id,
      work_center_name: mr.work_center_name,
      shift_id: mr.shift_id,
      shift_name: mr.shift_name,
      inputs: mr.inputs ?? [],
      outputs: mr.outputs ?? [],
      items: mr.items,
    })),
  });
}

export async function mockGetOperationWithWorkCenter(work_center_id: number) {
  const codes = WORK_CENTER_OPERATION_CODES[work_center_id] ?? [];
  const records = codes.map((code) => {
    const id = getGsv7DemoOperationId(code);
    const name = code.replace(/^OPR-/, "").replace(/-/g, " ");
    return {
      operation_id: id,
      id,
      operation_code: code,
      operation_name: name,
      name,
    };
  });
  return success({ records });
}

export async function mockGetBatchWithItems(params: { operation_id: number }) {
  const opId = Number(params.operation_id);
  const records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY)
    .filter((b) => b.operation_id === opId && b.status_id >= 2)
    .map((b) => ({
      batch_id: b.batch_id,
      batch_code: b.batch_code,
      batch_date: b.batch_date,
      items: b.outputs.map((line) => ({
        item_id: line.item_id,
        item_code: line.item_code,
        item_name: line.item_name,
        uom_name: line.uom_name,
        qty: line.produced_qty ?? 0,
      })),
    }));
  return success({ records });
}

export async function mockGetProductionPlansDropdown(params?: {
  operation_id?: number | string;
  shift_id?: number | string;
  status_id?: number | string;
  search?: string;
}) {
  const listRes = await mockProductionPlanApi.getProductionPlanList({
    page: 1,
    limit: 200,
    operation_id: params?.operation_id,
    shift_id: params?.shift_id,
    status_id: params?.status_id,
    search: params?.search,
  });
  if (!listRes.isSuccessful || !listRes.data?.records) return listRes;

  const records = listRes.data.records.map((plan: LocalProductionPlanRecord & { id?: number }) => ({
    production_plan_id: plan.id ?? (plan as { production_plan_id?: number }).production_plan_id,
    plan_code: plan.plan_code,
    operation_id: plan.operation_id,
    operation_name: plan.operation_name,
    display_name: `${plan.plan_code} — ${plan.operation_name}`,
    status_id: plan.status_id,
  }));

  return success({ records });
}

export const mockProductionFlowApi = {
  async getMyRequestList(params: {
    page: number;
    limit: number;
    search?: string;
    operation_id?: number | string;
    shift_id?: number | string;
    status_id?: number | string;
    request_date?: string;
  }) {
    let records = readJson<LocalMrRecord>(MR_STORAGE_KEY);
    if (params.operation_id && params.operation_id !== "all" && params.operation_id !== "All") {
      const opId = Number(params.operation_id);
      records = records.filter((r) => r.operation_id === opId);
    }
    if (params.shift_id && params.shift_id !== "all" && params.shift_id !== "All") {
      const shiftId = Number(params.shift_id);
      records = records.filter((r) => r.shift_id === shiftId);
    }
    if (params.status_id && params.status_id !== "all" && params.status_id !== "All") {
      const statusId = Number(params.status_id);
      records = records.filter((r) => r.status_id === statusId);
    }
    if (params.request_date) {
      records = records.filter((r) => r.request_date === params.request_date);
    }
    records = filterSearch(records, params.search, ["mr_code", "operation_name", "requested_by_name"]);
    const pageData = paginate(records, params.page, params.limit);
    return success({
      records: pageData.records.map(toMrListRow),
      pagination: pageData.pagination,
    });
  },

  async getMyRequestById(id: number) {
    const mr = readJson<LocalMrRecord>(MR_STORAGE_KEY).find((r) => r.id === id);
    if (!mr) return failure("Material request not found.");
    return success({
      mr_code: mr.mr_code,
      request_date: mr.request_date,
      required_by_date: mr.required_by_date,
      operation_id: mr.operation_id,
      operation_name: mr.operation_name,
      work_center_id: mr.work_center_id,
      work_center_name: mr.work_center_name,
      warehouse_id: mr.warehouse_id,
      warehouse_name: mr.warehouse_name,
      shift_id: mr.shift_id,
      shift_name: mr.shift_name,
      production_plan_id: mr.production_plan_id,
      production_plan_code: mr.production_plan_code,
      requested_by: mr.requested_by_name,
      requested_by_name: mr.requested_by_name,
      received_date: mr.received_date,
      items: mr.items.map((item) => ({
        id: item.id,
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.uom,
        warehouse_id: mr.warehouse_id,
        warehouse_name: mr.warehouse_name,
        required_qty: item.required_qty,
        issued_qty: item.issued_qty,
        received_qty: item.received_qty,
        available_qty: item.available_qty,
      })),
    });
  },

  async createMyRequest(data: {
    request_date: string;
    required_by_date: string;
    operation_id: number;
    work_center_id: number;
    warehouse_id: number;
    shift_id: number;
    production_plan_id: number;
    items: { item_id: number; required_qty: number }[];
  }) {
    const records = readJson<LocalMrRecord>(MR_STORAGE_KEY);
    const plans = readJson<LocalProductionPlanRecord>(PRODUCTION_PLAN_STORAGE_KEY);
    const plan = plans.find((p) => p.id === data.production_plan_id);
    const wc = MOCK_WORK_CENTERS.find((w) => w.id === data.work_center_id);
    const wh = MOCK_WAREHOUSES.find((w) => w.id === data.warehouse_id);
    const shiftName = data.shift_id === 2 ? "Night" : "Morning";
    const opName =
      plan?.operation_name ??
      (data.operation_id ? `Operation ${data.operation_id}` : "Operation");

    const items = data.items.map((row, idx) => ({
      id: idx + 1,
      item_id: row.item_id,
      item_code: `ITEM-${row.item_id}`,
      item_name: `Item ${row.item_id}`,
      uom: "Nos",
      required_qty: row.required_qty,
      issued_qty: 0,
      received_qty: 0,
      available_qty: row.required_qty + 100,
    }));

    const created: LocalMrRecord = {
      id: nextId(records),
      mr_code: `MR-GSV7-${String(nextId(records)).padStart(3, "0")}`,
      request_date: data.request_date,
      required_by_date: data.required_by_date,
      operation_id: data.operation_id,
      operation_name: opName,
      work_center_id: data.work_center_id,
      work_center_name: wc?.name ?? "Work Center",
      warehouse_id: data.warehouse_id,
      warehouse_name: wh?.name ?? "Warehouse",
      shift_id: data.shift_id,
      shift_name: shiftName,
      production_plan_id: data.production_plan_id,
      production_plan_code: plan?.plan_code ?? "",
      status_id: 1,
      status_name: "Requested to Warehouse",
      requested_by_name: "Current User",
      received_date: null,
      items,
      inputs: items.map((item) => ({
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        uom_name: item.uom,
        total_qty: item.required_qty,
      })),
      outputs: [],
    };

    writeJson(MR_STORAGE_KEY, [...records, created]);
    return success(created, "Material request created.");
  },

  async updateMyRequest(
    id: number,
    data: {
      request_date: string;
      required_by_date: string;
      operation_id: number;
      work_center_id: number;
      warehouse_id: number;
      shift_id: number;
      production_plan_id: number;
      items: { id?: number; item_id: number; required_qty: number }[];
    },
  ) {
    const records = readJson<LocalMrRecord>(MR_STORAGE_KEY);
    const index = records.findIndex((r) => r.id === id);
    if (index < 0) return failure("Material request not found.");
    const prev = records[index];
    const items = data.items.map((row, idx) => {
      const existing = prev.items.find((i) => i.item_id === row.item_id);
      return {
        id: row.id ?? existing?.id ?? idx + 1,
        item_id: row.item_id,
        item_code: existing?.item_code ?? `ITEM-${row.item_id}`,
        item_name: existing?.item_name ?? `Item ${row.item_id}`,
        uom: existing?.uom ?? "Nos",
        required_qty: row.required_qty,
        issued_qty: existing?.issued_qty ?? 0,
        received_qty: existing?.received_qty ?? 0,
        available_qty: existing?.available_qty,
      };
    });
    records[index] = {
      ...prev,
      request_date: data.request_date,
      required_by_date: data.required_by_date,
      operation_id: data.operation_id,
      work_center_id: data.work_center_id,
      warehouse_id: data.warehouse_id,
      shift_id: data.shift_id,
      shift_name: data.shift_id === 2 ? "Night" : "Morning",
      production_plan_id: data.production_plan_id,
      items,
    };
    writeJson(MR_STORAGE_KEY, records);
    return success(records[index], "Material request updated.");
  },

  async receiveMaterials(
    requestId: number,
    data: { items: { id: number; received_qty: number }[] },
  ) {
    const records = readJson<LocalMrRecord>(MR_STORAGE_KEY);
    const index = records.findIndex((r) => r.id === requestId);
    if (index < 0) return failure("Material request not found.");
    const mr = records[index];
    mr.items = mr.items.map((item) => {
      const recv = data.items.find((r) => r.id === item.id);
      if (!recv) return item;
      return { ...item, received_qty: recv.received_qty };
    });
    mr.status_id = 3;
    mr.status_name = "Received by Production";
    mr.received_date = format(new Date(), "yyyy-MM-dd");
    records[index] = mr;
    writeJson(MR_STORAGE_KEY, records);
    return success(mr, "Materials received.");
  },

  async getBatchList(params: {
    page: number;
    limit: number;
    search?: string;
    batch_date?: string;
    shift_id?: number | string;
    operation_id?: number | string;
    status_id?: number | string;
  }) {
    let records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY);
    if (params.batch_date) records = records.filter((b) => b.batch_date === params.batch_date);
    if (params.shift_id && params.shift_id !== "all" && params.shift_id !== "All") {
      records = records.filter((b) => b.shift_id === Number(params.shift_id));
    }
    if (params.operation_id && params.operation_id !== "all" && params.operation_id !== "All") {
      records = records.filter((b) => b.operation_id === Number(params.operation_id));
    }
    if (params.status_id && params.status_id !== "all" && params.status_id !== "All") {
      records = records.filter((b) => b.status_id === Number(params.status_id));
    }
    records = filterSearch(records, params.search, ["batch_code", "mr_code", "operation_name"]);
    const pageData = paginate(records, params.page, params.limit);
    return success({
      records: pageData.records.map(toBatchListRow),
      pagination: pageData.pagination,
    });
  },

  async getBatchById(id: number) {
    const batch = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY).find((b) => b.batch_id === id);
    if (!batch) return failure("Batch not found.");
    return success(batch);
  },

  async createBatch(data: {
    batch_date: string;
    shift_id: number;
    mr_id: number;
    mr_code: string;
    inputs: Array<{ item_id: number; supplied_qty: number }>;
    outputs: Array<{ item_id: number; produced_qty: number }>;
  }) {
    const records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY);
    const mr = readJson<LocalMrRecord>(MR_STORAGE_KEY).find((m) => m.id === data.mr_id);
    const batchId = nextId(records.map((b) => ({ id: b.batch_id })));
    const mapLines = (
      lines: Array<{ item_id: number; supplied_qty?: number; produced_qty?: number }>,
      kind: "in" | "out",
    ) =>
      lines.map((line) => ({
        item_id: line.item_id,
        item_code: `ITEM-${line.item_id}`,
        item_name: `Item ${line.item_id}`,
        uom_name: "Nos",
        ...(kind === "in"
          ? { supplied_qty: line.supplied_qty ?? 0, total_mr_qty: line.supplied_qty ?? 0 }
          : { produced_qty: line.produced_qty ?? 0, verified_qty: null }),
      }));

    const created: LocalBatchRecord = {
      batch_id: batchId,
      batch_code: `BATCH-GSV7-${String(batchId).padStart(3, "0")}`,
      batch_date: data.batch_date,
      mr_id: data.mr_id,
      mr_code: data.mr_code,
      operation_id: mr?.operation_id ?? 0,
      operation_name: mr?.operation_name ?? "",
      work_center_id: mr?.work_center_id ?? MOCK_WORK_CENTERS[0].id,
      work_center_name: mr?.work_center_name ?? MOCK_WORK_CENTERS[0].name,
      shift_id: data.shift_id,
      shift_name: data.shift_id === 2 ? "Night" : "Morning",
      status_id: 1,
      status_name: "Batch Created",
      inputs: mapLines(data.inputs, "in"),
      outputs: mapLines(data.outputs, "out"),
    };
    writeJson(BATCH_STORAGE_KEY, [...records, created]);
    return success({ id: batchId }, "Batch created.");
  },

  async updateBatch(
    id: number,
    data: { outputs: Array<{ item_id: number; produced_qty: number }> },
  ) {
    const records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY);
    const index = records.findIndex((b) => b.batch_id === id);
    if (index < 0) return failure("Batch not found.");
    const batch = records[index];
    batch.outputs = data.outputs.map((line) => {
      const existing = batch.outputs.find((o) => o.item_id === line.item_id);
      return {
        item_id: line.item_id,
        item_code: existing?.item_code ?? `ITEM-${line.item_id}`,
        item_name: existing?.item_name ?? `Item ${line.item_id}`,
        uom_name: existing?.uom_name ?? "Nos",
        produced_qty: line.produced_qty,
        verified_qty: existing?.verified_qty ?? null,
        sku_code: existing?.sku_code,
        sku_name: existing?.sku_name,
      };
    });
    batch.status_id = 2;
    batch.status_name = "Sent for QC";
    records[index] = batch;
    writeJson(BATCH_STORAGE_KEY, records);
    return success(undefined, "Batch updated.");
  },

  async createBulkBatch(data: {
    material_request_id: number;
    shift_id: number;
    batch_date: string;
    no_of_batches: number;
  }) {
    const mr = readJson<LocalMrRecord>(MR_STORAGE_KEY).find((m) => m.id === data.material_request_id);
    if (!mr) return failure("Material request not found.");
    const count = Math.max(1, data.no_of_batches);
    for (let i = 0; i < count; i++) {
      await mockProductionFlowApi.createBatch({
        batch_date: data.batch_date,
        shift_id: data.shift_id,
        mr_id: data.material_request_id,
        mr_code: mr.mr_code,
        inputs: (mr.inputs ?? []).map((inp) => ({
          item_id: inp.item_id,
          supplied_qty: Math.floor((inp.total_qty ?? 0) / count),
        })),
        outputs: (mr.outputs ?? []).map((out) => ({
          item_id: out.item_id,
          produced_qty: 0,
        })),
      });
    }
    return success(undefined, `${count} batches created.`);
  },

  async getBatchQCList(params: {
    page: number;
    limit: number;
    search?: string;
    operation_id?: number | string;
    work_center_id?: number | string;
    status_id?: number | string;
  }) {
    let records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY).filter(
      (b) => b.status_id >= 2,
    );
    if (params.operation_id != null && params.operation_id !== "" && params.operation_id !== "all") {
      records = records.filter((b) => b.operation_id === Number(params.operation_id));
    }
    if (params.work_center_id != null && params.work_center_id !== "" && params.work_center_id !== "all") {
      records = records.filter((b) => b.work_center_id === Number(params.work_center_id));
    }
    if (params.status_id != null && params.status_id !== "" && params.status_id !== "all") {
      records = records.filter((b) => b.status_id === Number(params.status_id));
    }
    records = filterSearch(records, params.search, ["batch_code", "operation_name"]);
    const pageData = paginate(records, params.page, params.limit);
    return success({
      records: pageData.records.map(toBatchListRow),
      pagination: pageData.pagination,
    });
  },

  async getBatchQCById(id: number) {
    const batch = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY).find((b) => b.batch_id === id);
    if (!batch) return failure("Batch not found.");
    return success({
      batch_id: batch.batch_id,
      batch_code: batch.batch_code,
      batch_date: batch.batch_date,
      shift_id: batch.shift_id,
      shift_name: batch.shift_name,
      operation_id: batch.operation_id,
      operation_name: batch.operation_name,
      work_center_id: batch.work_center_id,
      work_center_name: batch.work_center_name,
      status_id: batch.status_id,
      status_name: batch.status_name,
      verified_by_name: batch.verified_by_name,
      verified_on: batch.verified_on,
      remarks: batch.remarks,
      items: batch.outputs.map((line) => ({
        item_id: line.item_id,
        item_code: line.item_code,
        item_name: line.item_name,
        uom_name: line.uom_name,
        produced_qty: line.produced_qty ?? 0,
        verified_qty: line.verified_qty,
      })),
    });
  },

  async verifyBatchQC(
    id: number,
    data?: { items?: Array<{ item_id: number; verified_qty: number }>; remarks?: string | null },
  ) {
    const records = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY);
    const index = records.findIndex((b) => b.batch_id === id);
    if (index < 0) return failure("Batch not found.");
    const batch = records[index];
    if (data?.items?.length) {
      batch.outputs = batch.outputs.map((line) => {
        const verified = data.items!.find((i) => i.item_id === line.item_id);
        if (!verified) return line;
        return { ...line, verified_qty: verified.verified_qty };
      });
    } else {
      batch.outputs = batch.outputs.map((line) => ({
        ...line,
        verified_qty: line.produced_qty ?? 0,
      }));
    }
    batch.status_id = 3;
    batch.status_name = "Verified QC";
    batch.verified_by_name = "QC Inspector";
    batch.verified_on = new Date().toISOString();
    batch.remarks = data?.remarks ?? batch.remarks;
    records[index] = batch;
    writeJson(BATCH_STORAGE_KEY, records);
    return success(null, "QC verified.");
  },

  async getMaterialReleaseList(params: {
    page: number;
    limit: number;
    search?: string;
    date?: string;
    operation_id?: number | string;
    status_id?: number | string;
    shift_id?: number | string;
  }) {
    let records = readJson<LocalMaterialReleaseRecord>(MATERIAL_RELEASE_STORAGE_KEY);
    if (params.date) records = records.filter((r) => r.release_date === params.date);
    if (params.operation_id != null && params.operation_id !== "" && params.operation_id !== "all") {
      records = records.filter((r) => r.operation_id === Number(params.operation_id));
    }
    if (params.status_id != null && params.status_id !== "" && params.status_id !== "all") {
      records = records.filter((r) => r.status_id === Number(params.status_id));
    }
    if (params.shift_id != null && params.shift_id !== "" && params.shift_id !== "all") {
      records = records.filter((r) => r.shift_id === Number(params.shift_id));
    }
    records = filterSearch(records, params.search, ["release_code", "operation_name"]);
    const pageData = paginate(records, params.page, params.limit);
    return success({
      records: pageData.records,
      pagination: pageData.pagination,
    });
  },

  async getMaterialReleaseById(id: number) {
    const release = readJson<LocalMaterialReleaseRecord>(MATERIAL_RELEASE_STORAGE_KEY).find(
      (r) => r.release_id === id,
    );
    if (!release) return failure("Material release not found.");
    return success(release);
  },

  async createMaterialRelease(data: {
    release_date: string;
    released_by: number;
    operation_id: number;
    work_center_id: number;
    warehouse_id: number;
    production_plan_id: number;
    batch_ids: number[];
  }) {
    const records = readJson<LocalMaterialReleaseRecord>(MATERIAL_RELEASE_STORAGE_KEY);
    const batches = readJson<LocalBatchRecord>(BATCH_STORAGE_KEY).filter((b) =>
      data.batch_ids.includes(b.batch_id),
    );
    const plans = readJson<LocalProductionPlanRecord>(PRODUCTION_PLAN_STORAGE_KEY);
    const plan = plans.find((p) => p.id === data.production_plan_id);
    const wc = MOCK_WORK_CENTERS.find((w) => w.id === data.work_center_id);
    const wh = MOCK_WAREHOUSES.find((w) => w.id === data.warehouse_id);
    const releaseId = nextId(records.map((r) => ({ id: r.release_id })));

    const created: LocalMaterialReleaseRecord = {
      release_id: releaseId,
      release_code: `REL-GSV7-${String(releaseId).padStart(3, "0")}`,
      release_date: data.release_date,
      operation_id: data.operation_id,
      operation_name: plan?.operation_name ?? "Operation",
      work_center_id: data.work_center_id,
      work_center_name: wc?.name ?? "",
      warehouse_id: data.warehouse_id,
      warehouse_name: wh?.name ?? "",
      shift_id: 1,
      shift_name: "Morning",
      status_id: 2,
      status_name: "Issued to Warehouse",
      released_by_name: "Current User",
      production_plan_id: data.production_plan_id,
      production_plan_code: plan?.plan_code ?? "",
      batch_ids: data.batch_ids,
      batch_nos: batches.map((b) => b.batch_code),
      batches: batches.map((b) => ({
        batch_id: b.batch_id,
        batch_code: b.batch_code,
        items: b.outputs.map((line) => ({
          item_id: line.item_id,
          item_code: line.item_code,
          item_name: line.item_name,
          uom_name: line.uom_name,
          qty: line.produced_qty ?? 0,
        })),
      })),
    };
    writeJson(MATERIAL_RELEASE_STORAGE_KEY, [...records, created]);
    return success(created, "Material release created.");
  },

  async importMaterialReleaseSerials(_formData: FormData) {
    return success({
      release_id: 1,
      batch_id: 2,
      batch_code: "BATCH-GSV7-002",
      imported_count: 5,
      serials: Array.from({ length: 5 }, (_, i) => ({
        serial_number: `GSV7-IMP-${String(i + 1).padStart(4, "0")}`,
        qr_code_data: `GSV7:IMP:${i + 1}`,
      })),
    });
  },
};
