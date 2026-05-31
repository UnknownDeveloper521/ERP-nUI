const SKU_STORAGE_KEY = "master-erp-procurement-skus";
const SKU_OPERATION_API_KEY = "master-erp-sku-operation-api-records";

export interface SkuDropdownRecord {
  id: number;
  code: string;
  name: string;
}

export interface SkuDetailRecord {
  id: number;
  code: string;
  name: string;
  items_id?: number;
  item_code?: string;
  item_name?: string;
  dimension?: string;
  weight?: string;
  type?: string;
  description?: string;
}

export interface CreateSkuRequest {
  code: string;
  name: string;
  items_id: number;
  type?: string;
  dimension?: string;
  weight?: string;
  description?: string;
}

export interface SkuOperationListRecord {
  id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  sku_id: number;
  sku_code: string;
  sku_name: string;
  operation_count: number;
}

export interface SkuOperationDetailOperation {
  id?: number;
  operation_id: number;
  operation_code: string;
  operation_name: string;
  sequence: number;
}

export interface SkuOperationDetailRecord {
  id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  sku_id: number;
  sku_code: string;
  sku_name: string;
  operations: SkuOperationDetailOperation[];
}

type StoredSku = {
  id: number;
  code: string;
  name: string;
  item_id?: number;
  items_id?: number;
  item_code?: string;
  item_name?: string;
  dimensions?: string;
  dimension?: string;
  weight?: string;
  type?: string;
  description?: string;
};

function success<T>(data: T, message = "OK") {
  return { isSuccessful: true, message, data };
}

function failure(message: string) {
  return { isSuccessful: false, message, data: undefined as undefined };
}

function loadStoredSkus(): StoredSku[] {
  try {
    const raw = localStorage.getItem(SKU_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSkus(records: StoredSku[]) {
  localStorage.setItem(SKU_STORAGE_KEY, JSON.stringify(records));
}

function loadStoredSkuOperations(): SkuOperationDetailRecord[] {
  try {
    const raw = localStorage.getItem(SKU_OPERATION_API_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSkuOperations(records: SkuOperationDetailRecord[]) {
  localStorage.setItem(SKU_OPERATION_API_KEY, JSON.stringify(records));
}

function nextId(records: { id: number }[]): number {
  if (records.length === 0) return 1;
  return Math.max(...records.map((r) => r.id)) + 1;
}

export function parseSkuDropdownRecords(data: unknown): SkuDropdownRecord[] {
  const records = Array.isArray(data)
    ? data
    : Array.isArray((data as { records?: unknown[] })?.records)
      ? (data as { records: unknown[] }).records
      : [];

  return records
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: Number(record.id ?? record.sku_id),
        code: String(record.code ?? record.sku_code ?? "").trim(),
        name: String(record.name ?? record.sku_name ?? "").trim(),
      };
    })
    .filter((record) => Number.isFinite(record.id) && record.id > 0 && record.code && record.name);
}

function mapStoredSkuToDetail(sku: StoredSku): SkuDetailRecord {
  return {
    id: sku.id,
    code: sku.code,
    name: sku.name,
    items_id: sku.items_id ?? sku.item_id,
    item_code: sku.item_code,
    item_name: sku.item_name,
    dimension: sku.dimension ?? sku.dimensions,
    weight: sku.weight,
    type: sku.type,
    description: sku.description,
  };
}

function paginate<T>(records: T[], page = 1, limit = 10) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  return {
    records: records.slice(start, start + safeLimit),
    totalCount: records.length,
  };
}

export async function fetchSkuDropdown(params: { item_id: number }) {
  const records = loadStoredSkus()
    .filter((sku) => Number(sku.items_id ?? sku.item_id) === params.item_id)
    .map((sku) => ({ id: sku.id, code: sku.code, name: sku.name }));

  return success({ records });
}

export const skuApi = {
  async getList(params?: { page?: number; limit?: number; search?: string }) {
    const search = params?.search?.trim().toLowerCase();
    let records = loadStoredSkus().map(mapStoredSkuToDetail);
    if (search) {
      records = records.filter(
        (sku) =>
          sku.code.toLowerCase().includes(search) ||
          sku.name.toLowerCase().includes(search),
      );
    }
    const page = paginate(records, params?.page, params?.limit);
    return success({
      records: page.records,
      pagination: { totalCount: page.totalCount },
    });
  },

  async getById(id: number) {
    const sku = loadStoredSkus().find((record) => record.id === id);
    if (!sku) return failure("SKU not found.");
    return success(mapStoredSkuToDetail(sku));
  },

  async create(payload: CreateSkuRequest) {
    const records = loadStoredSkus();
    const created: StoredSku = {
      id: nextId(records),
      code: payload.code,
      name: payload.name,
      items_id: payload.items_id,
      item_id: payload.items_id,
      dimension: payload.dimension,
      weight: payload.weight,
      type: payload.type,
      description: payload.description,
    };
    saveStoredSkus([...records, created]);
    return success(mapStoredSkuToDetail(created), "SKU created.");
  },

  async update(id: number, payload: CreateSkuRequest) {
    const records = loadStoredSkus();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return failure("SKU not found.");

    records[index] = {
      ...records[index],
      code: payload.code,
      name: payload.name,
      items_id: payload.items_id,
      item_id: payload.items_id,
      dimension: payload.dimension,
      weight: payload.weight,
      type: payload.type,
      description: payload.description,
    };
    saveStoredSkus(records);
    return success(mapStoredSkuToDetail(records[index]), "SKU updated.");
  },

  async delete(id: number) {
    const records = loadStoredSkus();
    const nextRecords = records.filter((record) => record.id !== id);
    if (nextRecords.length === records.length) return failure("SKU not found.");
    saveStoredSkus(nextRecords);
    return success(undefined, "SKU deleted.");
  },
};

export const skuOperationApi = {
  async getList(params?: { page?: number; limit?: number; search?: string }) {
    const search = params?.search?.trim().toLowerCase();
    let records = loadStoredSkuOperations().map((mapping) => ({
      id: mapping.id,
      item_id: mapping.item_id,
      item_code: mapping.item_code,
      item_name: mapping.item_name,
      sku_id: mapping.sku_id,
      sku_code: mapping.sku_code,
      sku_name: mapping.sku_name,
      operation_count: mapping.operations?.length ?? 0,
    }));

    if (search) {
      records = records.filter((record) =>
        [record.item_code, record.item_name, record.sku_code, record.sku_name]
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    }

    const page = paginate(records, params?.page, params?.limit);
    return success({
      records: page.records,
      pagination: { totalCount: page.totalCount },
    });
  },

  async getById(id: number) {
    const mapping = loadStoredSkuOperations().find((record) => record.id === id);
    if (!mapping) return failure("SKU operation mapping not found.");
    return success(mapping);
  },

  async create(payload: {
    item_id: number;
    sku_id: number;
    operations: Array<{ operation_id: number; sequence: number }>;
  }) {
    const records = loadStoredSkuOperations();
    const created: SkuOperationDetailRecord = {
      id: nextId(records),
      item_id: payload.item_id,
      item_code: String(payload.item_id),
      item_name: `Item ${payload.item_id}`,
      sku_id: payload.sku_id,
      sku_code: String(payload.sku_id),
      sku_name: `SKU ${payload.sku_id}`,
      operations: payload.operations.map((operation, index) => ({
        id: index + 1,
        operation_id: operation.operation_id,
        operation_code: `OP-${operation.operation_id}`,
        operation_name: `Operation ${operation.operation_id}`,
        sequence: operation.sequence,
      })),
    };
    saveStoredSkuOperations([...records, created]);
    return success(created, "SKU operation mapping created.");
  },

  async update(
    id: number,
    payload: {
      item_id: number;
      sku_id: number;
      operations: Array<{ operation_id: number; sequence: number; id?: number }>;
      delete?: Array<{ id: number }>;
    },
  ) {
    const records = loadStoredSkuOperations();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return failure("SKU operation mapping not found.");

    records[index] = {
      ...records[index],
      item_id: payload.item_id,
      sku_id: payload.sku_id,
      operations: payload.operations.map((operation, idx) => ({
        id: operation.id ?? idx + 1,
        operation_id: operation.operation_id,
        operation_code: `OP-${operation.operation_id}`,
        operation_name: `Operation ${operation.operation_id}`,
        sequence: operation.sequence,
      })),
    };
    saveStoredSkuOperations(records);
    return success(records[index], "SKU operation mapping updated.");
  },

  async delete(id: number) {
    const records = loadStoredSkuOperations();
    const nextRecords = records.filter((record) => record.id !== id);
    if (nextRecords.length === records.length) return failure("SKU operation mapping not found.");
    saveStoredSkuOperations(nextRecords);
    return success(undefined, "SKU operation mapping deleted.");
  },
};
