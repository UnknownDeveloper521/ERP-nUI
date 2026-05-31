import {
  BOM_STORAGE_KEY,
  ITEMS_STORAGE_KEY,
  OPERATIONS_STORAGE_KEY,
  type LocalBomRecord,
  type LocalItemRecord,
  type LocalOperationRecord,
} from "@/lib/localMasterSeed";

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

function nextId(records: { id: number }[]) {
  if (records.length === 0) return 1;
  return Math.max(...records.map((record) => record.id)) + 1;
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

function filterBySearch<T extends { code?: string; name?: string }>(
  records: T[],
  search?: string,
) {
  const query = search?.trim().toLowerCase();
  if (!query) return records;
  return records.filter(
    (record) =>
      String(record.code ?? "").toLowerCase().includes(query) ||
      String(record.name ?? "").toLowerCase().includes(query),
  );
}

export const mockItemsApi = {
  async getAll(page = 1, limit = 10, search?: string, item_type_id?: number) {
    let records = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
    if (item_type_id) {
      records = records.filter((record) => record.item_type_id === item_type_id);
    }
    records = filterBySearch(records, search);
    const pageData = paginate(records, page, limit);
    return success({ records: pageData.records, pagination: pageData.pagination });
  },

  async getOne(id: number) {
    const record = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY).find((item) => item.id === id);
    if (!record) return failure("Item not found.");
    return success(record);
  },

  async create(data: Partial<LocalItemRecord>) {
    const records = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
    const created: LocalItemRecord = {
      id: nextId(records),
      code: String(data.code ?? ""),
      name: String(data.name ?? ""),
      item_type_id: Number(data.item_type_id ?? 401),
      item_type_name: String(data.item_type_name ?? "Raw Material"),
      uom_id: Number(data.uom_id ?? 501),
      uom_name: String(data.uom_name ?? "Pieces"),
      is_expiry_tracked: Boolean(data.is_expiry_tracked),
      shelf_life_days: data.shelf_life_days,
      warranty_period: data.warranty_period,
      notes: data.notes,
      created_at: new Date().toISOString(),
    };
    writeJson(ITEMS_STORAGE_KEY, [...records, created]);
    return success(created, "Item created.");
  },

  async update(id: number, data: Partial<LocalItemRecord>) {
    const records = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
    const index = records.findIndex((item) => item.id === id);
    if (index < 0) return failure("Item not found.");
    records[index] = { ...records[index], ...data, id };
    writeJson(ITEMS_STORAGE_KEY, records);
    return success(records[index], "Item updated.");
  },

  async delete(id: number) {
    const records = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
    const nextRecords = records.filter((item) => item.id !== id);
    if (nextRecords.length === records.length) return failure("Item not found.");
    writeJson(ITEMS_STORAGE_KEY, nextRecords);
    return success(undefined, "Item deleted.");
  },
};

const OPERATION_INPUT_TYPES = [
  { id: 1, value_code: "RM", value_name: "Raw Material" },
  { id: 2, value_code: "SFG", value_name: "Semi Finished Good" },
  { id: 3, value_code: "FG", value_name: "Finished Good" },
  { id: 4, value_code: "Waste", value_name: "Waste" },
  { id: 5, value_code: "Consumables", value_name: "Consumables" },
];

export const mockOperationsApi = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: number;
    department_id?: number;
  }) {
    let records = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY);
    if (params?.department_id) {
      records = records.filter((record) => record.department_id === params.department_id);
    }
    records = filterBySearch(records, params?.search);
    const pageData = paginate(records, params?.page, params?.limit);
    return success({ records: pageData.records, pagination: pageData.pagination });
  },

  async getOne(id: number) {
    const record = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY).find(
      (operation) => operation.id === id,
    );
    if (!record) return failure("Operation not found.");
    return success(record);
  },

  async getInputTypes() {
    return success(OPERATION_INPUT_TYPES);
  },

  async getOutputTypes() {
    return success(OPERATION_INPUT_TYPES);
  },

  async create(data: Partial<LocalOperationRecord> & { code?: string; name?: string }) {
    const records = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY);
    const created: LocalOperationRecord = {
      id: nextId(records),
      code: String(data.code ?? "OPR-NEW"),
      name: String(data.name ?? "New Operation"),
      description: String(data.description ?? data.name ?? "New Operation"),
      department_id: Number(data.department_id ?? 1),
      department_name: String(data.department_name ?? "Production"),
      inputs: Array.isArray(data.inputs) ? data.inputs : [],
      outputs: Array.isArray(data.outputs) ? data.outputs : [],
      is_qc_required: Boolean(data.is_qc_required),
      is_qc_required_batch_wise: Boolean(data.is_qc_required_batch_wise),
      cycle_time: Number(data.cycle_time ?? 1),
      status: "Active",
      qc_parameters: [],
      is_gsv7_demo: true,
    };
    writeJson(OPERATIONS_STORAGE_KEY, [...records, created]);
    return success(created, "Operation created.");
  },

  async update(data: Partial<LocalOperationRecord> & { id: number }) {
    const records = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY);
    const index = records.findIndex((operation) => operation.id === data.id);
    if (index < 0) return failure("Operation not found.");
    records[index] = { ...records[index], ...data };
    writeJson(OPERATIONS_STORAGE_KEY, records);
    return success(records[index], "Operation updated.");
  },

  async delete(id: number) {
    const records = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY);
    const nextRecords = records.filter((operation) => operation.id !== id);
    if (nextRecords.length === records.length) return failure("Operation not found.");
    writeJson(OPERATIONS_STORAGE_KEY, nextRecords);
    return success(undefined, "Operation deleted.");
  },
};

export const mockBomApi = {
  async getBOMList(params: {
    search?: string;
    item_type_id?: number | string;
    created_at?: string;
    page: number;
    limit: number;
  }) {
    let records = readJson<LocalBomRecord>(BOM_STORAGE_KEY);
    if (params.item_type_id && params.item_type_id !== "all" && params.item_type_id !== "All") {
      const typeId = Number(params.item_type_id);
      records = records.filter((record) => record.item_type_id === typeId);
    }
    if (params.created_at) {
      records = records.filter(
        (record) =>
          record.created_at.startsWith(params.created_at!) ||
          record.creaed_at.startsWith(params.created_at!),
      );
    }
    records = filterBySearch(records, params.search);
    const pageData = paginate(records, params.page, params.limit);
    return success({
      records: pageData.records.map(({ components: _components, description: _description, item_type_id: _itemTypeId, ...record }) => record),
      pagination: pageData.pagination,
    });
  },

  async getBOMDetail(id: number) {
    const record = readJson<LocalBomRecord>(BOM_STORAGE_KEY).find((bom) => bom.id === id);
    if (!record) return failure("BOM not found.");
    return success(record);
  },

  async createBOM(data: {
    bom_name: string;
    item_id: number;
    item_type_id: number;
    description: string;
    components: Array<{ input_component_id: number; quantity: number }>;
  }) {
    const records = readJson<LocalBomRecord>(BOM_STORAGE_KEY);
    const items = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
    const item = items.find((entry) => entry.id === data.item_id);
    const created: LocalBomRecord = {
      id: nextId(records),
      bom_code: `BOM-${String(nextId(records)).padStart(3, "0")}`,
      bom_name: data.bom_name,
      item_id: data.item_id,
      item_name: item?.name ?? `Item ${data.item_id}`,
      item_type: item?.item_type_name?.includes("Semi") ? "SFG" : item?.item_type_name?.includes("Finished") ? "FG" : "RM",
      item_type_id: data.item_type_id,
      description: data.description,
      creaed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      components: data.components.map((component, index) => {
        const inputItem = items.find((entry) => entry.id === component.input_component_id);
        return {
          id: index + 1,
          input_component_id: component.input_component_id,
          item_id: component.input_component_id,
          item_code: inputItem?.code ?? String(component.input_component_id),
          item_name: inputItem?.name ?? `Item ${component.input_component_id}`,
          item_type: inputItem?.item_type_name?.includes("Raw") ? "RM" : "SFG",
          quantity: component.quantity,
          uom: inputItem?.uom_name,
        };
      }),
    };
    writeJson(BOM_STORAGE_KEY, [...records, created]);
    return success(created, "BOM created.");
  },

  async updateBOM(id: number, data: Partial<LocalBomRecord>) {
    const records = readJson<LocalBomRecord>(BOM_STORAGE_KEY);
    const index = records.findIndex((bom) => bom.id === id);
    if (index < 0) return failure("BOM not found.");
    records[index] = { ...records[index], ...data, id };
    writeJson(BOM_STORAGE_KEY, records);
    return success(records[index], "BOM updated.");
  },

  async deleteBOM(id: number) {
    const records = readJson<LocalBomRecord>(BOM_STORAGE_KEY);
    const nextRecords = records.filter((bom) => bom.id !== id);
    if (nextRecords.length === records.length) return failure("BOM not found.");
    writeJson(BOM_STORAGE_KEY, nextRecords);
    return success(undefined, "BOM deleted.");
  },
};

export async function mockGetItemsDropdown(params?: {
  item_type_id?: number;
  status?: number;
  search?: string;
}) {
  let records = readJson<LocalItemRecord>(ITEMS_STORAGE_KEY);
  if (params?.item_type_id != null) {
    records = records.filter((record) => record.item_type_id === params.item_type_id);
  }
  records = filterBySearch(records, params?.search);
  return success({
    records: records.map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      item_code: record.code,
      item_name: record.name,
      item_type_id: record.item_type_id,
      item_type_name: record.item_type_name,
    })),
  });
}

export async function mockGetOperationsDropdown() {
  const records = readJson<LocalOperationRecord>(OPERATIONS_STORAGE_KEY);
  return success({
    records: records.map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      operation_code: record.code,
      operation_name: record.name,
    })),
  });
}

export async function mockGetItemTypes() {
  return success({
    records: [
      { id: 401, value_name: "Raw Material", value_code: "RM", code: "RM", name: "Raw Material" },
      { id: 403, value_name: "Semi Finished Good", value_code: "SFG", code: "SFG", name: "Semi Finished Good" },
      { id: 402, value_name: "Finished Good", value_code: "FG", code: "FG", name: "Finished Good" },
      { id: 404, value_name: "Consumables", value_code: "Consumables", code: "Consumables", name: "Consumables" },
    ],
  });
}

export async function mockGetUoms() {
  return success({
    records: [
      { id: 501, value_name: "Pieces", value_code: "NOS", code: "NOS", name: "Pieces" },
      { id: 502, value_name: "Kilograms", value_code: "KG", code: "KG", name: "Kilograms" },
      { id: 503, value_name: "Litres", value_code: "LTR", code: "LTR", name: "Litres" },
    ],
  });
}

export async function mockGetBOMComponents() {
  const boms = readJson<LocalBomRecord>(BOM_STORAGE_KEY);
  return success({
    records: boms.map((bom) => ({
      id: `local-bom-${bom.id}`,
      bom_component_id: `local-bom-${bom.id}`,
      output_component: {
        id: bom.item_id,
        code: readJson<LocalItemRecord>(ITEMS_STORAGE_KEY).find((item) => item.id === bom.item_id)?.code ?? "",
        name: bom.item_name,
        item_type: bom.item_type,
        uom: "Nos",
      },
      input_components: bom.components.map((component) => ({
        item_id: component.item_id,
        item_code: component.item_code,
        item_name: component.item_name,
        item_type: component.item_type,
        uom: component.uom ?? "Nos",
        quantity: component.quantity,
      })),
    })),
  });
}
