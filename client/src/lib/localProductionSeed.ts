import { format } from "date-fns";
import {
  GSV7_ITEMS,
  GSV7_MOCK_OPERATIONS,
  getGsv7DemoOperationId,
  getGsv7ItemIdByCode,
} from "@/lib/gsv7OperationsMockData";

export const MR_STORAGE_KEY = "master-erp-local-mr-requests";
export const BATCH_STORAGE_KEY = "master-erp-local-batches";
export const MATERIAL_RELEASE_STORAGE_KEY = "master-erp-local-material-releases";

export const MOCK_WORK_CENTERS = [
  { id: 6001, work_center_id: 6001, name: "Lead Furnace Center", work_center_name: "Lead Furnace Center", code: "WC-LEAD" },
  { id: 6002, work_center_id: 6002, name: "Grid Casting Center", work_center_name: "Grid Casting Center", code: "WC-GRID-CAST" },
  { id: 6003, work_center_id: 6003, name: "Grid Formation Center", work_center_name: "Grid Formation Center", code: "WC-GRID-FORM" },
  { id: 6004, work_center_id: 6004, name: "Assembly Line", work_center_name: "Assembly Line", code: "WC-ASM" },
] as const;

export const MOCK_WAREHOUSES = [
  { id: 7001, warehouse_id: 7001, name: "Jinja Main WH", warehouse_name: "Jinja Main WH", code: "WH-JINJA" },
] as const;

export type LocalMrLine = {
  id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  uom: string;
  sku_code?: string;
  sku_name?: string;
  required_qty: number;
  issued_qty: number;
  received_qty: number;
  available_qty?: number;
};

export type LocalMrRecord = {
  id: number;
  mr_code: string;
  request_date: string;
  required_by_date: string;
  operation_id: number;
  operation_name: string;
  work_center_id: number;
  work_center_name: string;
  warehouse_id: number;
  warehouse_name: string;
  shift_id: number;
  shift_name: string;
  production_plan_id: number;
  production_plan_code: string;
  status_id: number;
  status_name: string;
  requested_by_name: string;
  received_date: string | null;
  items: LocalMrLine[];
  /** For GET /common/getmrforbatch */
  inputs?: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    uom_name: string;
    total_qty: number;
    sku_code?: string;
    sku_name?: string;
  }>;
  outputs?: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    uom_name: string;
    total_qty: number;
  }>;
};

export type LocalBatchLine = {
  item_id: number;
  item_code: string;
  item_name: string;
  uom_name: string;
  supplied_qty?: number;
  produced_qty?: number;
  verified_qty?: number | null;
  total_mr_qty?: number;
  sku_code?: string;
  sku_name?: string;
};

export type LocalBatchRecord = {
  batch_id: number;
  batch_code: string;
  batch_date: string;
  mr_id: number;
  mr_code: string;
  operation_id: number;
  operation_name: string;
  work_center_id: number;
  work_center_name: string;
  shift_id: number;
  shift_name: string;
  status_id: number;
  status_name: string;
  inputs: LocalBatchLine[];
  outputs: LocalBatchLine[];
  verified_by_name?: string | null;
  verified_on?: string | null;
  remarks?: string | null;
};

export type LocalMaterialReleaseRecord = {
  release_id: number;
  release_code: string;
  release_date: string;
  operation_id: number;
  operation_name: string;
  work_center_id: number;
  work_center_name: string;
  warehouse_id: number;
  warehouse_name: string;
  shift_id: number;
  shift_name: string;
  status_id: number;
  status_name: string;
  released_by_name: string;
  production_plan_id: number;
  production_plan_code: string;
  batch_ids: number[];
  batch_nos: string[];
  batches?: Array<{
    batch_id: number;
    batch_code: string;
    items: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      uom_name: string;
      qty: number;
      serial_numbers?: string[];
    }>;
  }>;
};

function itemId(code: string) {
  return getGsv7ItemIdByCode(code);
}

function opId(code: string) {
  return getGsv7DemoOperationId(code);
}

function line(
  id: number,
  itemCode: string,
  itemName: string,
  uom: string,
  required: number,
  issued: number,
  received: number,
  skuCode?: string,
  skuName?: string,
): LocalMrLine {
  const item_id = itemId(itemCode);
  return {
    id,
    item_id,
    item_code: itemCode,
    item_name: itemName,
    uom,
    sku_code: skuCode,
    sku_name: skuName,
    required_qty: required,
    issued_qty: issued,
    received_qty: received,
    available_qty: Math.max(required, issued) + 500,
  };
}

export function buildLocalMrSeed(): LocalMrRecord[] {
  const today = format(new Date(), "yyyy-MM-dd");

  const purifyOp = GSV7_MOCK_OPERATIONS.find((o) => o.code === "OPR-PURIFY-LEAD")!;
  const asmOp = GSV7_MOCK_OPERATIONS.find((o) => o.code === "OPR-GSV7-ASM")!;
  const dryOp = GSV7_MOCK_OPERATIONS.find((o) => o.code === "OPR-GRID-DRY")!;
  const castOp = GSV7_MOCK_OPERATIONS.find((o) => o.code === "OPR-GRID-CAST")!;

  const scrapLeadIn = purifyOp.inputs[0];
  const leadOut = purifyOp.outputs[0];

  const asmInputs = asmOp.inputs;
  const fgOut = asmOp.outputs[0];

  return [
    {
      id: 1,
      mr_code: "MR-GSV7-001",
      request_date: today,
      required_by_date: today,
      operation_id: opId("OPR-PURIFY-LEAD"),
      operation_name: purifyOp.name,
      work_center_id: MOCK_WORK_CENTERS[0].id,
      work_center_name: MOCK_WORK_CENTERS[0].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 1,
      shift_name: "Morning",
      production_plan_id: 3,
      production_plan_code: "PLN-GSV7-003",
      status_id: 3,
      status_name: "Received by Production",
      requested_by_name: "James Okello",
      received_date: today,
      items: [
        line(1, scrapLeadIn.itemCode, scrapLeadIn.itemName, "Kg", 2500, 2500, 2500),
      ],
      inputs: [
        {
          item_id: itemId(scrapLeadIn.itemCode),
          item_code: scrapLeadIn.itemCode,
          item_name: scrapLeadIn.itemName,
          uom_name: "Kg",
          total_qty: 2500,
        },
      ],
      outputs: [
        {
          item_id: itemId(leadOut.itemCode),
          item_code: leadOut.itemCode,
          item_name: leadOut.itemName,
          uom_name: "Kg",
          total_qty: 2200,
        },
      ],
    },
    {
      id: 2,
      mr_code: "MR-GSV7-002",
      request_date: today,
      required_by_date: today,
      operation_id: opId("OPR-GSV7-ASM"),
      operation_name: asmOp.name,
      work_center_id: MOCK_WORK_CENTERS[3].id,
      work_center_name: MOCK_WORK_CENTERS[3].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 1,
      shift_name: "Morning",
      production_plan_id: 1,
      production_plan_code: "PLN-GSV7-001",
      status_id: 3,
      status_name: "Received by Production",
      requested_by_name: "Sarah Nambi",
      received_date: today,
      items: [
        line(1, asmInputs[0].itemCode, asmInputs[0].itemName, "Nos", 100, 100, 100),
        line(2, asmInputs[1].itemCode, asmInputs[1].itemName, "Nos", 100, 100, 100),
        line(3, asmInputs[4].itemCode, asmInputs[4].itemName, "Nos", 100, 100, 100),
        line(4, asmInputs[5].itemCode, asmInputs[5].itemName, "Nos", 100, 100, 100),
        line(5, asmInputs[6].itemCode, asmInputs[6].itemName, "Ltr", 120, 120, 120),
        line(6, GSV7_ITEMS.FG_GSV7.code, GSV7_ITEMS.FG_GSV7.name, "Nos", 0, 0, 0, "SKU-GSV7-12V", "GSV7 Battery 12V Standard"),
      ],
      inputs: asmInputs.map((inp) => ({
        item_id: itemId(inp.itemCode),
        item_code: inp.itemCode,
        item_name: inp.itemName,
        uom_name: inp.uom ?? "Nos",
        total_qty: 100,
      })),
      outputs: [
        {
          item_id: itemId(fgOut.itemCode),
          item_code: fgOut.itemCode,
          item_name: fgOut.itemName,
          uom_name: "Nos",
          total_qty: 100,
        },
      ],
    },
    {
      id: 3,
      mr_code: "MR-GSV7-003",
      request_date: today,
      required_by_date: today,
      operation_id: opId("OPR-GRID-DRY"),
      operation_name: dryOp.name,
      work_center_id: MOCK_WORK_CENTERS[2].id,
      work_center_name: MOCK_WORK_CENTERS[2].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 2,
      shift_name: "Night",
      production_plan_id: 2,
      production_plan_code: "PLN-GSV7-002",
      status_id: 2,
      status_name: "Issued by Warehouse",
      requested_by_name: "Peter Musoke",
      received_date: null,
      items: [
        line(1, GSV7_ITEMS.SFG_GRID_POS.code, GSV7_ITEMS.SFG_GRID_POS.name, "Nos", 500, 500, 0),
        line(2, GSV7_ITEMS.SFG_GRID_NEG.code, GSV7_ITEMS.SFG_GRID_NEG.name, "Nos", 500, 500, 0),
      ],
      inputs: dryOp.inputs.map((inp, idx) => ({
        item_id: itemId(inp.itemCode),
        item_code: inp.itemCode,
        item_name: inp.itemName,
        uom_name: "Nos",
        total_qty: 500,
        sku_code: idx === 0 ? "SKU-GRID-POS" : undefined,
      })),
      outputs: dryOp.outputs.map((out) => ({
        item_id: itemId(out.itemCode),
        item_code: out.itemCode,
        item_name: out.itemName,
        uom_name: "Nos",
        total_qty: 480,
      })),
    },
    {
      id: 4,
      mr_code: "MR-GSV7-004",
      request_date: today,
      required_by_date: today,
      operation_id: opId("OPR-GRID-CAST"),
      operation_name: castOp.name,
      work_center_id: MOCK_WORK_CENTERS[1].id,
      work_center_name: MOCK_WORK_CENTERS[1].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 1,
      shift_name: "Morning",
      production_plan_id: 4,
      production_plan_code: "PLN-GSV7-004",
      status_id: 1,
      status_name: "Requested to Warehouse",
      requested_by_name: "Grace Achieng",
      received_date: null,
      items: [
        line(1, GSV7_ITEMS.SFG_LEAD_INGOT.code, GSV7_ITEMS.SFG_LEAD_INGOT.name, "Kg", 900, 0, 0),
      ],
      inputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_LEAD_INGOT.code),
          item_code: GSV7_ITEMS.SFG_LEAD_INGOT.code,
          item_name: GSV7_ITEMS.SFG_LEAD_INGOT.name,
          uom_name: "Kg",
          total_qty: 900,
        },
      ],
      outputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_CAST.code),
          item_code: GSV7_ITEMS.SFG_GRID_CAST.code,
          item_name: GSV7_ITEMS.SFG_GRID_CAST.name,
          uom_name: "Nos",
          total_qty: 800,
        },
      ],
    },
  ];
}

export function buildLocalBatchSeed(): LocalBatchRecord[] {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  return [
    {
      batch_id: 1,
      batch_code: "BATCH-GSV7-001",
      batch_date: yesterday,
      mr_id: 1,
      mr_code: "MR-GSV7-001",
      operation_id: opId("OPR-PURIFY-LEAD"),
      operation_name: "Lead Purification",
      work_center_id: MOCK_WORK_CENTERS[0].id,
      work_center_name: MOCK_WORK_CENTERS[0].name,
      shift_id: 1,
      shift_name: "Morning",
      status_id: 4,
      status_name: "Batch Closed",
      inputs: [
        {
          item_id: itemId(GSV7_ITEMS.RM_SCRAP_LEAD.code),
          item_code: GSV7_ITEMS.RM_SCRAP_LEAD.code,
          item_name: GSV7_ITEMS.RM_SCRAP_LEAD.name,
          uom_name: "Kg",
          supplied_qty: 2500,
          total_mr_qty: 2500,
        },
      ],
      outputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_LEAD_INGOT.code),
          item_code: GSV7_ITEMS.SFG_LEAD_INGOT.code,
          item_name: GSV7_ITEMS.SFG_LEAD_INGOT.name,
          uom_name: "Kg",
          produced_qty: 2280,
          verified_qty: 2275,
        },
      ],
      verified_by_name: "QC — Daniel Kato",
      verified_on: `${yesterday}T14:30:00`,
    },
    {
      batch_id: 2,
      batch_code: "BATCH-GSV7-002",
      batch_date: today,
      mr_id: 2,
      mr_code: "MR-GSV7-002",
      operation_id: opId("OPR-GSV7-ASM"),
      operation_name: "GSV7 Assembly",
      work_center_id: MOCK_WORK_CENTERS[3].id,
      work_center_name: MOCK_WORK_CENTERS[3].name,
      shift_id: 1,
      shift_name: "Morning",
      status_id: 2,
      status_name: "Sent for QC",
      inputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_POS_DRY.code),
          item_code: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
          item_name: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
          uom_name: "Nos",
          supplied_qty: 100,
          total_mr_qty: 100,
        },
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_NEG_DRY.code),
          item_code: GSV7_ITEMS.SFG_GRID_NEG_DRY.code,
          item_name: GSV7_ITEMS.SFG_GRID_NEG_DRY.name,
          uom_name: "Nos",
          supplied_qty: 100,
          total_mr_qty: 100,
        },
        {
          item_id: itemId(GSV7_ITEMS.RM_ACID.code),
          item_code: GSV7_ITEMS.RM_ACID.code,
          item_name: GSV7_ITEMS.RM_ACID.name,
          uom_name: "Ltr",
          supplied_qty: 120,
          total_mr_qty: 120,
        },
      ],
      outputs: [
        {
          item_id: itemId(GSV7_ITEMS.FG_GSV7.code),
          item_code: GSV7_ITEMS.FG_GSV7.code,
          item_name: GSV7_ITEMS.FG_GSV7.name,
          uom_name: "Nos",
          produced_qty: 98,
          verified_qty: null,
          sku_code: "SKU-GSV7-12V",
          sku_name: "GSV7 Battery 12V Standard",
        },
      ],
    },
    {
      batch_id: 3,
      batch_code: "BATCH-GSV7-003",
      batch_date: today,
      mr_id: 1,
      mr_code: "MR-GSV7-001",
      operation_id: opId("OPR-GRID-CAST"),
      operation_name: "Grid Casting",
      work_center_id: MOCK_WORK_CENTERS[1].id,
      work_center_name: MOCK_WORK_CENTERS[1].name,
      shift_id: 2,
      shift_name: "Night",
      status_id: 3,
      status_name: "Verified QC",
      inputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_LEAD_INGOT.code),
          item_code: GSV7_ITEMS.SFG_LEAD_INGOT.code,
          item_name: GSV7_ITEMS.SFG_LEAD_INGOT.name,
          uom_name: "Kg",
          supplied_qty: 720,
          total_mr_qty: 900,
        },
      ],
      outputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_CAST.code),
          item_code: GSV7_ITEMS.SFG_GRID_CAST.code,
          item_name: GSV7_ITEMS.SFG_GRID_CAST.name,
          uom_name: "Nos",
          produced_qty: 780,
          verified_qty: 778,
        },
      ],
      verified_by_name: "QC — Daniel Kato",
      verified_on: `${today}T09:15:00`,
    },
    {
      batch_id: 4,
      batch_code: "BATCH-GSV7-004",
      batch_date: today,
      mr_id: 3,
      mr_code: "MR-GSV7-003",
      operation_id: opId("OPR-GRID-DRY"),
      operation_name: "Grid Drying",
      work_center_id: MOCK_WORK_CENTERS[2].id,
      work_center_name: MOCK_WORK_CENTERS[2].name,
      shift_id: 2,
      shift_name: "Night",
      status_id: 1,
      status_name: "Batch Created",
      inputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_POS.code),
          item_code: GSV7_ITEMS.SFG_GRID_POS.code,
          item_name: GSV7_ITEMS.SFG_GRID_POS.name,
          uom_name: "Nos",
          supplied_qty: 500,
          total_mr_qty: 500,
        },
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_NEG.code),
          item_code: GSV7_ITEMS.SFG_GRID_NEG.code,
          item_name: GSV7_ITEMS.SFG_GRID_NEG.name,
          uom_name: "Nos",
          supplied_qty: 500,
          total_mr_qty: 500,
        },
      ],
      outputs: [
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_POS_DRY.code),
          item_code: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
          item_name: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
          uom_name: "Nos",
          produced_qty: 0,
        },
        {
          item_id: itemId(GSV7_ITEMS.SFG_GRID_NEG_DRY.code),
          item_code: GSV7_ITEMS.SFG_GRID_NEG_DRY.code,
          item_name: GSV7_ITEMS.SFG_GRID_NEG_DRY.name,
          uom_name: "Nos",
          produced_qty: 0,
        },
      ],
    },
  ];
}

export function buildLocalMaterialReleaseSeed(): LocalMaterialReleaseRecord[] {
  const today = format(new Date(), "yyyy-MM-dd");

  return [
    {
      release_id: 1,
      release_code: "REL-GSV7-001",
      release_date: today,
      operation_id: opId("OPR-GSV7-ASM"),
      operation_name: "GSV7 Assembly",
      work_center_id: MOCK_WORK_CENTERS[3].id,
      work_center_name: MOCK_WORK_CENTERS[3].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 1,
      shift_name: "Morning",
      status_id: 2,
      status_name: "Issued to Warehouse",
      released_by_name: "Sarah Nambi",
      production_plan_id: 1,
      production_plan_code: "PLN-GSV7-001",
      batch_ids: [2],
      batch_nos: ["BATCH-GSV7-002"],
      batches: [
        {
          batch_id: 2,
          batch_code: "BATCH-GSV7-002",
          items: [
            {
              item_id: itemId(GSV7_ITEMS.FG_GSV7.code),
              item_code: GSV7_ITEMS.FG_GSV7.code,
              item_name: GSV7_ITEMS.FG_GSV7.name,
              uom_name: "Nos",
              qty: 98,
              serial_numbers: Array.from({ length: 5 }, (_, i) => `GSV7-26-${String(i + 1).padStart(5, "0")}`),
            },
          ],
        },
      ],
    },
    {
      release_id: 2,
      release_code: "REL-GSV7-002",
      release_date: today,
      operation_id: opId("OPR-GRID-CAST"),
      operation_name: "Grid Casting",
      work_center_id: MOCK_WORK_CENTERS[1].id,
      work_center_name: MOCK_WORK_CENTERS[1].name,
      warehouse_id: MOCK_WAREHOUSES[0].id,
      warehouse_name: MOCK_WAREHOUSES[0].name,
      shift_id: 2,
      shift_name: "Night",
      status_id: 1,
      status_name: "Draft",
      released_by_name: "Peter Musoke",
      production_plan_id: 4,
      production_plan_code: "PLN-GSV7-004",
      batch_ids: [3],
      batch_nos: ["BATCH-GSV7-003"],
      batches: [
        {
          batch_id: 3,
          batch_code: "BATCH-GSV7-003",
          items: [
            {
              item_id: itemId(GSV7_ITEMS.SFG_GRID_CAST.code),
              item_code: GSV7_ITEMS.SFG_GRID_CAST.code,
              item_name: GSV7_ITEMS.SFG_GRID_CAST.name,
              uom_name: "Nos",
              qty: 778,
            },
          ],
        },
      ],
    },
  ];
}

/** Work center → operation codes for dropdown filtering */
export const WORK_CENTER_OPERATION_CODES: Record<number, string[]> = {
  [MOCK_WORK_CENTERS[0].id]: ["OPR-SCRAP-SORT", "OPR-PURIFY-LEAD"],
  [MOCK_WORK_CENTERS[1].id]: ["OPR-GRID-CAST", "OPR-CONNECTOR", "OPR-TERMINAL"],
  [MOCK_WORK_CENTERS[2].id]: ["OPR-GRID-PN", "OPR-GRID-DRY"],
  [MOCK_WORK_CENTERS[3].id]: ["OPR-PLASTIC-CASE", "OPR-GSV7-ASM"],
};
