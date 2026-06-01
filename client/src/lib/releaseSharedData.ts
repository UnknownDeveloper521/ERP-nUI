// ============================================================================
// SHARED OPERATION RELEASE DATA
// ============================================================================
// This file contains shared data and types for Operation Releases used by both:
// - Production module (Material Release)
// - Inventory module (WH Receive)
// ============================================================================

export interface ProducedItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  qtyProduced: number;
  itemTypeCode?: string;
  skuCode?: string;
  skuName?: string;
  warehouseId?: number;
  warehouseName?: string;
}

export interface OperationRelease {
  id: number;
  releaseNo: string;
  releaseDate: string;
  releasedBy: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  batchIds: string[];
  status: "Issued to Warehouse" | "Received By Warehouse";
  items: ProducedItem[];
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
  batchDetails?: Array<{
    batchNo: string;
    /** e.g. Morning, Night, Day Shift — from API */
    shift: string;
    items: ProducedItem[];
  }>;
}

/** Merge line items by code + name + uom (sums qty). */
export function aggregateProducedItems(items: ProducedItem[]): ProducedItem[] {
  const byKey = new Map<string, ProducedItem>();
  let nextId = 1;
  for (const it of items) {
    const key = `${it.itemCode}\0${it.itemName}\0${it.uom}`;
    const ex = byKey.get(key);
    if (ex) {
      ex.qtyProduced += it.qtyProduced;
    } else {
      byKey.set(key, { ...it, id: nextId++ });
    }
  }
  return Array.from(byKey.values());
}

/**
 * Backend often nests output under `batch_wise_outputs` (batch_code, shift_name, items[]).
 * Returns per-batch rows + batch ids + flattened line items (not aggregated; use aggregateProducedItems for summary).
 */
export function parseBatchWiseOutputs(raw: unknown): {
  batchDetails: NonNullable<OperationRelease["batchDetails"]>;
  batchIds: string[];
  lineItems: ProducedItem[];
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { batchDetails: [], batchIds: [], lineItems: [] };
  }
  const batchDetails: NonNullable<OperationRelease["batchDetails"]> = [];
  const lineItems: ProducedItem[] = [];
  let lineId = 0;
  for (const bd of raw) {
    if (bd == null || typeof bd !== "object") continue;
    const o = bd as Record<string, any>;
    const batchNo = String(o.batch_code ?? o.batch_no ?? o.batchNo ?? "");
    const shift = String(o.shift_name ?? o.shift ?? "—");
    const bItems = o.items ?? o.produced_items ?? [];
    const items: ProducedItem[] = Array.isArray(bItems)
      ? bItems.map((r: any) => {
          const row: ProducedItem = {
            id: ++lineId,
            itemCode: String(r.item_code ?? r.itemCode ?? ""),
            itemName: String(r.item_name ?? r.itemName ?? ""),
            uom: String(r.uom_name ?? r.uom ?? ""),
            qtyProduced: Number(
              r.total_qty ?? r.produced_qty ?? r.qty_produced ?? r.qtyProduced ?? r.qty ?? 0
            ),
            itemTypeCode: String(r.item_type_code ?? r.itemTypeCode ?? ""),
            skuCode: String(r.sku_code ?? r.skuCode ?? ""),
            skuName: String(r.sku_name ?? r.skuName ?? ""),
          };
          lineItems.push(row);
          return { ...row };
        })
      : [];
    if (batchNo) {
      batchDetails.push({ batchNo, shift, items });
    }
  }
  const batchIds = batchDetails.map((b) => b.batchNo).filter(Boolean);
  return { batchDetails, batchIds, lineItems };
}

// ============================================================================
// MOCK DATA
// ============================================================================

export let mockReleaseRecords: OperationRelease[] = [
  {
    id: 1,
    releaseNo: "REL-GSV7-001",
    releaseDate: "2026-05-30",
    operation: "GSV7 Assembly",
    workCenter: "Assembly Line",
    warehouse: "Jinja Main WH",
    releasedBy: "Sarah Nambi",
    qcVerifiedBy: "QC — Daniel Kato",
    qcVerifiedOn: "2026-05-30",
    status: "Issued to Warehouse",
    batchIds: ["BATCH-GSV7-002"],
    items: [
      {
        id: 101,
        itemCode: "FG-GSV7",
        itemName: "GSV7 Battery",
        skuCode: "SKU-GSV7-12V",
        skuName: "GSV7 Battery 12V Standard",
        uom: "NOS",
        qtyProduced: 98,
      },
    ],
    batchDetails: [
      {
        batchNo: "BATCH-GSV7-002",
        shift: "Morning",
        items: [
          {
            id: 101,
            itemCode: "FG-GSV7",
            itemName: "GSV7 Battery",
            skuCode: "SKU-GSV7-12V",
            skuName: "GSV7 Battery 12V Standard",
            uom: "NOS",
            qtyProduced: 98,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    releaseNo: "REL-GSV7-002",
    releaseDate: "2026-05-30",
    operation: "Grid Casting",
    workCenter: "Grid Casting Center",
    warehouse: "Jinja Main WH",
    releasedBy: "Peter Musoke",
    status: "Received By Warehouse",
    batchIds: ["BATCH-GSV7-003"],
    items: [
      {
        id: 201,
        itemCode: "SFG-GRID-CAST",
        itemName: "Cast Grid",
        uom: "NOS",
        qtyProduced: 778,
      },
    ],
    batchDetails: [
      {
        batchNo: "BATCH-GSV7-003",
        shift: "Night",
        items: [
          {
            id: 201,
            itemCode: "SFG-GRID-CAST",
            itemName: "Cast Grid",
            uom: "NOS",
            qtyProduced: 778,
          },
        ],
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const addReleaseRecord = (record: OperationRelease): OperationRelease[] => {
  mockReleaseRecords.unshift(record);
  return [...mockReleaseRecords];
};

export const updateReleaseRecord = (id: number, updates: Partial<OperationRelease>): OperationRelease[] => {
  const index = mockReleaseRecords.findIndex(req => req.id === id);
  if (index !== -1) {
    mockReleaseRecords[index] = { ...mockReleaseRecords[index], ...updates };
  }
  return [...mockReleaseRecords];
};

export const getReleaseRecordById = (id: number): OperationRelease | undefined => {
  return mockReleaseRecords.find(req => req.id === id);
};
