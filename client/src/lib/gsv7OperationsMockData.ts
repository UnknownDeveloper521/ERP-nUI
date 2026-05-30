/**
 * GSV7 battery manufacturing — mock operation catalog, flow mapping, and BOM structure.
 * Used to seed Operation Flow Mapping (localStorage) when matching operations exist in the API.
 * Create matching operations in Production Masters → Operations (same codes/names).
 */

export const GSV7_FLOW_STORAGE_FLAG = "master-erp-gsv7-flow-seed-applied";
export const GSV7_DEMO_VISIBLE_KEY = "master-erp-gsv7-demo-visible";
export const OPERATION_FLOW_MAPPING_STORAGE_KEY = "master-erp-operation-flow-mappings";

/** Stable demo IDs for UI-only operations (do not collide with typical API ids). */
export const GSV7_DEMO_ID_BASE = 9_000_001;

/** Stable demo item IDs for BOM dropdown / components (separate from operation ids). */
export const GSV7_ITEM_ID_BASE = 8_000_001;

export function getGsv7ItemIdByCode(itemCode: string): number {
    const entries = Object.values(GSV7_ITEMS);
    const key = normalizeOpCode(itemCode);
    const idx = entries.findIndex((e) => normalizeOpCode(e.code) === key);
    return GSV7_ITEM_ID_BASE + (idx >= 0 ? idx : entries.length);
}

function normalizeOpCode(code: string) {
    return String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

export function getGsv7DemoOperationId(code: string): number {
    const idx = GSV7_MOCK_OPERATIONS.findIndex((o) => normalizeOpCode(o.code) === normalizeOpCode(code));
    return GSV7_DEMO_ID_BASE + (idx >= 0 ? idx : GSV7_MOCK_OPERATIONS.length);
}

export function isGsv7DemoOperationId(id: number): boolean {
    return Number.isFinite(id) && id >= GSV7_DEMO_ID_BASE && id < GSV7_DEMO_ID_BASE + 100;
}

export function isGsv7DemoVisible(): boolean {
    try {
        return localStorage.getItem(GSV7_DEMO_VISIBLE_KEY) === "1";
    } catch {
        return false;
    }
}

export function setGsv7DemoVisible(visible: boolean) {
    try {
        localStorage.setItem(GSV7_DEMO_VISIBLE_KEY, visible ? "1" : "0");
    } catch {
        /* ignore */
    }
}

// ---------------------------------------------------------------------------
// Items (use these codes when creating Items / operation inputs & outputs)
// ---------------------------------------------------------------------------

export const GSV7_ITEMS = {
    RM_SCRAP_BATTERY: { code: "RM-SCRAP-BAT", name: "Scrap Battery", type: "RM" },
    RM_SCRAP_PLASTIC: { code: "RM-SCRAP-PLASTIC", name: "Plastic Scrap", type: "RM" },
    RM_SCRAP_LEAD: { code: "RM-SCRAP-LEAD", name: "Scrap Lead", type: "RM" },
    RM_PLASTIC_PALLET: { code: "RM-PLASTIC-PALLET", name: "Plastic Pallets", type: "RM" },
    RM_AGM: { code: "RM-AGM", name: "AGM", type: "RM" },
    RM_ACID: { code: "RM-ACID", name: "Acid", type: "RM" },
    SFG_LEAD_INGOT: { code: "SFG-LEAD-INGOT", name: "Purified Lead (Lead Ingots)", type: "SFG" },
    SFG_GRID_CAST: { code: "SFG-GRID-CAST", name: "Cast Grid", type: "SFG" },
    SFG_GRID_POS: { code: "SFG-GRID-POS", name: "Grid Positive", type: "SFG" },
    SFG_GRID_NEG: { code: "SFG-GRID-NEG", name: "Grid Negative", type: "SFG" },
    SFG_GRID_POS_DRY: { code: "SFG-GRID-POS-DRY", name: "Dried Grid Positive", type: "SFG" },
    SFG_GRID_NEG_DRY: { code: "SFG-GRID-NEG-DRY", name: "Dried Grid Negative", type: "SFG" },
    SFG_CONNECTOR: { code: "SFG-CONNECTOR", name: "Connectors", type: "SFG" },
    SFG_TERMINAL: { code: "SFG-TERMINAL", name: "Terminals", type: "SFG" },
    SFG_PLASTIC_CASE: { code: "SFG-PLASTIC-CASE", name: "Plastic Case", type: "SFG" },
    FG_GSV7: { code: "FG-GSV7", name: "GSV7 Battery", type: "FG" },
} as const;

export interface Gsv7MockOperationLine {
    itemCode: string;
    itemName: string;
    type: "RM" | "SFG" | "FG" | "Waste" | "Consumables";
    quantity: number;
    uom?: string;
}

type Gsv7CatalogItem = (typeof GSV7_ITEMS)[keyof typeof GSV7_ITEMS];

/** Map catalog item → operation line (itemCode/itemName, not code/name). */
export function gsv7Line(
    item: Gsv7CatalogItem,
    quantity: number,
    uom?: string,
): Gsv7MockOperationLine {
    return {
        itemCode: item.code,
        itemName: item.name,
        type: item.type,
        quantity,
        uom: uom ?? (item.type === "RM" ? "Kg" : "Nos"),
    };
}

/** Normalize lines that used spread `{ ...GSV7_ITEMS.* }` with code/name only. */
export function normalizeGsv7OperationLine(
    line: Partial<Gsv7MockOperationLine> & { code?: string; name?: string },
): Gsv7MockOperationLine {
    return {
        itemCode: String(line.itemCode ?? line.code ?? "").trim(),
        itemName: String(line.itemName ?? line.name ?? "").trim(),
        type: line.type ?? "RM",
        quantity: Number(line.quantity ?? 1) || 1,
        uom: line.uom,
    };
}

export interface Gsv7MockOperation {
    code: string;
    name: string;
    cycleTimeHours?: number;
    isQcRequired?: boolean;
    isBatchwise?: boolean;
    inputs: Gsv7MockOperationLine[];
    outputs: Gsv7MockOperationLine[];
}

/** All operations in process order (upstream → downstream). */
export const GSV7_MOCK_OPERATIONS: Gsv7MockOperation[] = [
    {
        code: "OPR-SCRAP-SORT",
        name: "Scrap Sorting",
        cycleTimeHours: 0.5,
        inputs: [gsv7Line(GSV7_ITEMS.RM_SCRAP_BATTERY, 1, "Nos")],
        outputs: [
            gsv7Line(GSV7_ITEMS.RM_SCRAP_PLASTIC, 1, "Kg"),
            gsv7Line(GSV7_ITEMS.RM_SCRAP_LEAD, 1, "Kg"),
        ],
    },
    {
        code: "OPR-PURIFY-LEAD",
        name: "Lead Purification",
        cycleTimeHours: 1,
        isQcRequired: true,
        inputs: [gsv7Line(GSV7_ITEMS.RM_SCRAP_LEAD, 1, "Kg")],
        outputs: [gsv7Line(GSV7_ITEMS.SFG_LEAD_INGOT, 1, "Kg")],
    },
    {
        code: "OPR-GRID-CAST",
        name: "Grid Casting",
        cycleTimeHours: 1,
        inputs: [gsv7Line(GSV7_ITEMS.SFG_LEAD_INGOT, 0.9, "Kg")],
        outputs: [gsv7Line(GSV7_ITEMS.SFG_GRID_CAST, 1, "Nos")],
    },
    {
        code: "OPR-GRID-PN",
        name: "Grid Positive / Negative Formation",
        cycleTimeHours: 1,
        inputs: [gsv7Line(GSV7_ITEMS.SFG_GRID_CAST, 1, "Nos")],
        outputs: [
            gsv7Line(GSV7_ITEMS.SFG_GRID_POS, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_GRID_NEG, 1, "Nos"),
        ],
    },
    {
        code: "OPR-GRID-DRY",
        name: "Grid Drying",
        cycleTimeHours: 0.75,
        isBatchwise: true,
        inputs: [
            gsv7Line(GSV7_ITEMS.SFG_GRID_POS, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_GRID_NEG, 1, "Nos"),
        ],
        outputs: [
            gsv7Line(GSV7_ITEMS.SFG_GRID_POS_DRY, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_GRID_NEG_DRY, 1, "Nos"),
        ],
    },
    {
        code: "OPR-CONNECTOR",
        name: "Connector Creation",
        cycleTimeHours: 0.5,
        inputs: [gsv7Line(GSV7_ITEMS.SFG_LEAD_INGOT, 0.4, "Kg")],
        outputs: [gsv7Line(GSV7_ITEMS.SFG_CONNECTOR, 2, "Nos")],
    },
    {
        code: "OPR-TERMINAL",
        name: "Terminal Creation",
        cycleTimeHours: 0.5,
        isQcRequired: true,
        inputs: [gsv7Line(GSV7_ITEMS.SFG_LEAD_INGOT, 0.4, "Kg")],
        outputs: [gsv7Line(GSV7_ITEMS.SFG_TERMINAL, 2, "Nos")],
    },
    {
        code: "OPR-PLASTIC-CASE",
        name: "Plastic Case Moulding",
        cycleTimeHours: 1,
        inputs: [gsv7Line(GSV7_ITEMS.RM_PLASTIC_PALLET, 1, "Kg")],
        outputs: [gsv7Line(GSV7_ITEMS.SFG_PLASTIC_CASE, 1, "Nos")],
    },
    {
        code: "OPR-GSV7-ASM",
        name: "GSV7 Assembly",
        cycleTimeHours: 1,
        isQcRequired: true,
        isBatchwise: true,
        inputs: [
            gsv7Line(GSV7_ITEMS.SFG_GRID_POS_DRY, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_GRID_NEG_DRY, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_TERMINAL, 2, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_CONNECTOR, 2, "Nos"),
            gsv7Line(GSV7_ITEMS.SFG_PLASTIC_CASE, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.RM_AGM, 1, "Nos"),
            gsv7Line(GSV7_ITEMS.RM_ACID, 1, "Ltr"),
        ],
        outputs: [gsv7Line(GSV7_ITEMS.FG_GSV7, 1, "Nos")],
    },
];

/** Parent operation code for final assembly. */
export const GSV7_MAIN_OPERATION_CODE = "OPR-GSV7-ASM";

/**
 * Mini operations under GSV7 Assembly (outputs feed GSV7 assembly inputs).
 * Order = suggested manufacturing sequence in Operation Flow Mapping.
 */
export const GSV7_FLOW_CHILD_OPERATION_CODES = [
    "OPR-SCRAP-SORT",
    "OPR-PURIFY-LEAD",
    "OPR-GRID-CAST",
    "OPR-GRID-PN",
    "OPR-GRID-DRY",
    "OPR-CONNECTOR",
    "OPR-TERMINAL",
    "OPR-PLASTIC-CASE",
] as const;

/** BOM record shape for getBOMComponents / Production Plan (UI). */
export function getGsv7BomComponentMockRecord() {
    const fg = GSV7_ITEMS.FG_GSV7;
    const asm = GSV7_MOCK_OPERATIONS.find((o) => o.code === GSV7_MAIN_OPERATION_CODE);
    const inputs = asm?.inputs ?? [];

    return {
        output_component: {
            id: getGsv7ItemIdByCode(fg.code),
            code: fg.code,
            name: fg.name,
            item_type: "FG",
            uom: "Nos",
        },
        input_components: inputs.map((raw) => {
            const line = normalizeGsv7OperationLine(raw);
            return {
                item_id: getGsv7ItemIdByCode(line.itemCode),
                item_code: line.itemCode,
                item_name: line.itemName,
                item_type: line.type,
                uom: line.uom ?? "Nos",
                quantity: line.quantity,
            };
        }),
    };
}

export function getGsv7MainOperationMock() {
    return GSV7_MOCK_OPERATIONS.find((o) => o.code === GSV7_MAIN_OPERATION_CODE);
}

export interface Gsv7DemoOperationListRow {
    id: number;
    code: string;
    name: string;
    description?: string;
    department_id: number;
    department_name?: string;
    inputs: {
        id: number;
        item_id: number;
        type: Gsv7MockOperationLine["type"];
        quantity: number;
        item_name?: string;
        item_code?: string;
        item_uom?: string;
    }[];
    outputs: {
        id: number;
        item_id: number;
        type: Gsv7MockOperationLine["type"];
        quantity: number;
        item_name?: string;
        item_code?: string;
        item_uom?: string;
    }[];
    is_qc_required: boolean;
    is_qc_required_batch_wise: boolean;
    cycle_time: number;
    status: "Active" | "Inactive";
    qc_parameters: [];
    is_gsv7_demo: true;
}

export function mockOperationToListRow(
    mock: Gsv7MockOperation,
    departmentId = 0,
): Gsv7DemoOperationListRow {
    const mapLine = (raw: Gsv7MockOperationLine, idx: number) => {
        const line = normalizeGsv7OperationLine(raw);
        return {
            id: idx + 1,
            item_id: getGsv7ItemIdByCode(line.itemCode),
            type: line.type,
            quantity: line.quantity,
            item_name: line.itemName,
            item_code: line.itemCode,
            item_uom: line.uom ?? "Nos",
        };
    };

    return {
        id: getGsv7DemoOperationId(mock.code),
        code: mock.code,
        name: mock.name,
        description: `GSV7 demo — ${mock.name}`,
        department_id: departmentId,
        department_name: "—",
        inputs: mock.inputs.map(mapLine),
        outputs: mock.outputs.map(mapLine),
        is_qc_required: !!mock.isQcRequired,
        is_qc_required_batch_wise: !!mock.isBatchwise,
        cycle_time: mock.cycleTimeHours ?? 1,
        status: "Active",
        qc_parameters: [],
        is_gsv7_demo: true,
    };
}

/** Dropdown / flow-mapping options for demo operations not returned by the API. */
export function getGsv7DemoOperationOptions(): { id: number; code: string; name: string }[] {
    return GSV7_MOCK_OPERATIONS.map((mock) => ({
        id: getGsv7DemoOperationId(mock.code),
        code: mock.code,
        name: mock.name,
    }));
}

/**
 * Merges GSV7 demo rows into an API operation list (by code; API row wins if duplicate).
 */
export function mergeGsv7MockWithApiOperations<T extends { id?: number; code?: string }>(
    apiRows: T[],
    departmentId = 0,
): (T | Gsv7DemoOperationListRow)[] {
    const apiCodes = new Set(
        apiRows.map((r) => normalizeOpCode(String((r as { code?: string }).code ?? ""))),
    );
    const demoRows = GSV7_MOCK_OPERATIONS.filter(
        (mock) => !apiCodes.has(normalizeOpCode(mock.code)),
    ).map((mock) => mockOperationToListRow(mock, departmentId));

    return [...apiRows, ...demoRows];
}

/** Pre-seeds Operation Flow Mapping for GSV7 Assembly using demo operation IDs. */
export function seedGsv7DemoFlowMapping(): { mappedChildCount: number; message: string } {
    const parentId = getGsv7DemoOperationId(GSV7_MAIN_OPERATION_CODE);
    const flowRows = GSV7_FLOW_CHILD_OPERATION_CODES.map((code, index) => {
        const mock = GSV7_MOCK_OPERATIONS.find((o) => o.code === code);
        return {
            operation_id: getGsv7DemoOperationId(code),
            operation_code: code,
            operation_name: mock?.name ?? code,
            sequence: index + 1,
        };
    });

    let allMappings: Record<string, typeof flowRows> = {};
    try {
        const raw = localStorage.getItem(OPERATION_FLOW_MAPPING_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") allMappings = parsed;
        }
    } catch {
        allMappings = {};
    }

    allMappings[String(parentId)] = flowRows;
    localStorage.setItem(OPERATION_FLOW_MAPPING_STORAGE_KEY, JSON.stringify(allMappings));
    localStorage.setItem(GSV7_FLOW_STORAGE_FLAG, "1");

    return {
        mappedChildCount: flowRows.length,
        message: `GSV7 demo flow mapped (${flowRows.length} operations under GSV7 Assembly).`,
    };
}
