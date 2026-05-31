import {
    GSV7_ITEMS,
    GSV7_MAIN_OPERATION_CODE,
    GSV7_MOCK_OPERATIONS,
    getGsv7DemoOperationId,
    getGsv7ItemIdByCode,
    normalizeGsv7OperationLine,
    type Gsv7MockOperation,
    type Gsv7MockOperationLine,
} from "@/lib/gsv7OperationsMockData";

export { GSV7_ITEM_ID_BASE, getGsv7ItemIdByCode } from "@/lib/gsv7OperationsMockData";

/** When true, BOM create dialog SFG/FG dropdown uses GSV7 mock catalog only (not API getbomcomponents). */
export const BOM_SFG_FG_MOCK_DROPDOWN_ONLY = true;

function normalizeCode(code: string) {
    return String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

export function isGsv7CatalogItemCode(itemCode?: string): boolean {
    if (!itemCode) return false;
    const key = normalizeCode(itemCode);
    return Object.values(GSV7_ITEMS).some((i) => normalizeCode(i.code) === key);
}

export function findGsv7OperationProducingItem(itemCode: string): Gsv7MockOperation | undefined {
    const key = normalizeCode(itemCode);
    return GSV7_MOCK_OPERATIONS.find((op) =>
        op.outputs.some((o) => normalizeCode(normalizeGsv7OperationLine(o).itemCode) === key),
    );
}

function lineCode(line: Gsv7MockOperationLine): string {
    return normalizeGsv7OperationLine(line).itemCode;
}

function lineName(line: Gsv7MockOperationLine): string {
    return normalizeGsv7OperationLine(line).itemName;
}

export interface Gsv7BomStructureLine {
    item_id: number;
    item_code: string;
    item_name: string;
    type: string;
    uom: string;
    quantity: number | string;
    producedBy?: { code: string; name: string };
    nestedOperation?: Gsv7BomStructureOperation;
}

export interface Gsv7BomStructureOperation {
    id: number;
    code: string;
    name: string;
    sequence?: number;
    outputs: Gsv7BomStructureLine[];
    inputs: Gsv7BomStructureLine[];
}

export interface Gsv7BomOperationTree {
    selectedItemCode: string;
    selectedItemName: string;
    mainOperation: Gsv7BomStructureOperation;
    childOperations: Gsv7BomStructureOperation[];
    rootOutputQuantity: number;
    isGsv7Nested: true;
}

function mapLine(line: Gsv7MockOperationLine, quantity: number): Gsv7BomStructureLine {
    const norm = normalizeGsv7OperationLine(line);
    return {
        item_id: getGsv7ItemIdByCode(norm.itemCode),
        item_code: norm.itemCode,
        item_name: norm.itemName,
        type: norm.type,
        uom: norm.uom ?? "Nos",
        quantity,
    };
}

function buildScaledOperation(
    mock: Gsv7MockOperation,
    targetOutputCode: string,
    requiredOutputQty: number,
    visited: Set<string>,
): Gsv7BomStructureOperation {
    const targetKey = normalizeCode(targetOutputCode);
    const outputLine =
        mock.outputs.find((o) => normalizeCode(lineCode(o)) === targetKey) ?? mock.outputs[0];
    const outputPerBatch = Number(normalizeGsv7OperationLine(outputLine).quantity ?? 1) || 1;
    const batches = requiredOutputQty / outputPerBatch;

    const outputs = mock.outputs.map((o) =>
        mapLine(o, Number(normalizeGsv7OperationLine(o).quantity) * batches),
    );

    const inputs: Gsv7BomStructureLine[] = mock.inputs.map((inp) => {
        const normInp = normalizeGsv7OperationLine(inp);
        const scaledQty = Number(normInp.quantity) * batches;
        const line = mapLine(inp, scaledQty);

        if (normInp.type === "SFG") {
            const producer = findGsv7OperationProducingItem(normInp.itemCode);
            const visitKey = normalizeCode(normInp.itemCode);
            if (
                producer &&
                normalizeCode(producer.code) !== normalizeCode(mock.code) &&
                !visited.has(visitKey)
            ) {
                visited.add(visitKey);
                line.producedBy = { code: producer.code, name: producer.name };
                line.nestedOperation = buildScaledOperation(
                    producer,
                    normInp.itemCode,
                    scaledQty,
                    visited,
                );
                visited.delete(visitKey);
            }
        }

        return line;
    });

    return {
        id: getGsv7DemoOperationId(mock.code),
        code: mock.code,
        name: mock.name,
        outputs,
        inputs,
    };
}

/** Remove nested operation panels — used when showing operations as separate boxes. */
function stripNestedFromOperation(op: Gsv7BomStructureOperation): Gsv7BomStructureOperation {
    return {
        ...op,
        inputs: op.inputs.map(({ nestedOperation: _nested, ...line }) => line),
    };
}

/** Collect every nested operation under the root into a flat list (depth-first). */
function flattenNestedOperations(rootOp: Gsv7BomStructureOperation): Gsv7BomStructureOperation[] {
    const acc: Gsv7BomStructureOperation[] = [];

    const walk = (op: Gsv7BomStructureOperation) => {
        for (const input of op.inputs) {
            if (!input.nestedOperation) continue;
            acc.push(input.nestedOperation);
            walk(input.nestedOperation);
        }
    };

    walk(rootOp);
    return acc.map((op, index) => ({
        ...stripNestedFromOperation(op),
        sequence: index + 1,
    }));
}

/** Nested BOM tree for any GSV7 catalog SFG/FG; quantities scale from root output qty. */
export function buildGsv7NestedBomTree(
    itemCode: string,
    rootOutputQty = 1,
): Gsv7BomOperationTree | null {
    const producer = findGsv7OperationProducingItem(itemCode);
    if (!producer) return null;

    const item = Object.values(GSV7_ITEMS).find(
        (i) => normalizeCode(i.code) === normalizeCode(itemCode),
    );
    const mainOperation = buildScaledOperation(producer, itemCode, rootOutputQty, new Set());
    const childOperations =
        normalizeCode(producer.code) === normalizeCode(GSV7_MAIN_OPERATION_CODE)
            ? flattenNestedOperations(mainOperation)
            : [];

    return {
        selectedItemCode: itemCode,
        selectedItemName: item?.name ?? itemCode,
        mainOperation: stripNestedFromOperation(mainOperation),
        childOperations,
        rootOutputQuantity: rootOutputQty,
        isGsv7Nested: true,
    };
}

/** One getbomcomponents-style row per SFG/FG in the GSV7 catalog. */
export function getAllGsv7BomComponentRecords(): {
    id: string;
    bom_component_id: string;
    output_component: {
        id: number;
        code: string;
        name: string;
        item_type: string;
        uom: string;
    };
    input_components: {
        item_id: number;
        item_code: string;
        item_name: string;
        item_type: string;
        uom: string;
        quantity: number;
    }[];
}[] {
    const seen = new Set<string>();
    const records: ReturnType<typeof getAllGsv7BomComponentRecords> = [];

    for (const op of GSV7_MOCK_OPERATIONS) {
        for (const rawOut of op.outputs) {
            const out = normalizeGsv7OperationLine(rawOut);
            if (out.type !== "SFG" && out.type !== "FG") continue;
            const key = normalizeCode(out.itemCode);
            if (!key || seen.has(key)) continue;
            seen.add(key);

            const producer = findGsv7OperationProducingItem(out.itemCode);
            records.push({
                id: `gsv7-bom-${out.itemCode}`,
                bom_component_id: `gsv7-bom-${out.itemCode}`,
                output_component: {
                    id: getGsv7ItemIdByCode(out.itemCode),
                    code: out.itemCode,
                    name: out.itemName,
                    item_type: out.type,
                    uom: out.uom ?? "Nos",
                },
                input_components: (producer?.inputs ?? []).map((rawInp) => {
                    const inp = normalizeGsv7OperationLine(rawInp);
                    return {
                        item_id: getGsv7ItemIdByCode(inp.itemCode),
                        item_code: inp.itemCode,
                        item_name: inp.itemName,
                        item_type: inp.type,
                        uom: inp.uom ?? "Nos",
                        quantity: inp.quantity,
                    };
                }),
            });
        }
    }

    return records;
}

export interface FlatBomComponent {
    item_id: string;
    type: string;
    quantity: number | string;
    item: {
        id: string;
        code: string;
        name: string;
        type: string;
        uom: string;
    };
}

function collectLeafMaterials(
    operation: Gsv7BomStructureOperation,
    acc: Map<string, FlatBomComponent>,
) {
    for (const input of operation.inputs) {
        if (input.nestedOperation) {
            collectLeafMaterials(input.nestedOperation, acc);
            continue;
        }
        const typeKey = String(input.type).toUpperCase();
        if (typeKey !== "RM" && typeKey !== "CONSUMABLES" && typeKey !== "CONS") continue;

        const key = normalizeCode(input.item_code);
        const existing = acc.get(key);
        const qty = Number(input.quantity) || 0;
        if (existing) {
            existing.quantity = Number(existing.quantity) + qty;
        } else {
            acc.set(key, {
                item_id: String(input.item_id),
                type: input.type,
                quantity: qty,
                item: {
                    id: String(input.item_id),
                    code: input.item_code,
                    name: input.item_name,
                    type: input.type,
                    uom: input.uom,
                },
            });
        }
    }
}

/** Top-level assembly inputs (SFG/RM) for BOM header components. */
export function gsv7TreeToTopLevelComponents(tree: Gsv7BomOperationTree): FlatBomComponent[] {
    return tree.mainOperation.inputs.map((line) => ({
        item_id: String(line.item_id),
        type: line.type,
        quantity: line.quantity,
        item: {
            id: String(line.item_id),
            code: line.item_code,
            name: line.item_name,
            type: line.type,
            uom: line.uom,
        },
    }));
}

/** Exploded RM totals from full nested tree (for reference / planning). */
export function gsv7TreeToExplodedRmComponents(tree: Gsv7BomOperationTree): FlatBomComponent[] {
    const acc = new Map<string, FlatBomComponent>();
    collectLeafMaterials(tree.mainOperation, acc);
    return [...acc.values()];
}

// ---------------------------------------------------------------------------
// BOM quantity persistence (BOM form → Production Plan)
// ---------------------------------------------------------------------------

const GSV7_BOM_QTY_STORAGE_KEY = "master-erp-gsv7-bom-quantities";

export type Gsv7BomQuantityMap = Record<string, number | string>;

function collectQtyFromOperation(op: Gsv7BomStructureOperation, acc: Gsv7BomQuantityMap) {
    for (const line of [...op.outputs, ...op.inputs]) {
        if (line.item_id > 0) acc[String(line.item_id)] = line.quantity;
    }
}

export function collectGsv7TreeQuantities(tree: {
    mainOperation: Gsv7BomStructureOperation;
    childOperations: Gsv7BomStructureOperation[];
}): Gsv7BomQuantityMap {
    const acc: Gsv7BomQuantityMap = {};
    collectQtyFromOperation(tree.mainOperation, acc);
    tree.childOperations.forEach((child) => collectQtyFromOperation(child, acc));
    return acc;
}

export function saveGsv7BomQuantities(itemCode: string, quantities: Gsv7BomQuantityMap) {
    try {
        const key = normalizeCode(itemCode);
        if (!key) return;
        const raw = localStorage.getItem(GSV7_BOM_QTY_STORAGE_KEY);
        const all = raw ? (JSON.parse(raw) as Record<string, Gsv7BomQuantityMap>) : {};
        all[key] = quantities;
        localStorage.setItem(GSV7_BOM_QTY_STORAGE_KEY, JSON.stringify(all));
    } catch {
        /* ignore */
    }
}

export function loadGsv7BomQuantities(itemCode: string): Gsv7BomQuantityMap {
    try {
        const key = normalizeCode(itemCode);
        if (!key) return {};
        const raw = localStorage.getItem(GSV7_BOM_QTY_STORAGE_KEY);
        if (!raw) return {};
        const all = JSON.parse(raw) as Record<string, Gsv7BomQuantityMap>;
        return all[key] ?? {};
    } catch {
        return {};
    }
}

function applyQtyMapToOperation(
    op: Gsv7BomStructureOperation,
    qtyMap: Gsv7BomQuantityMap,
): Gsv7BomStructureOperation {
    const patch = (lines: Gsv7BomStructureOperation["inputs"]) =>
        lines.map((line) => {
            const q = qtyMap[String(line.item_id)];
            return q !== undefined ? { ...line, quantity: q } : line;
        });

    return {
        ...op,
        outputs: patch(op.outputs),
        inputs: patch(op.inputs),
    };
}

export function applyGsv7BomQuantityMap(
    tree: Gsv7BomOperationTree,
    qtyMap: Gsv7BomQuantityMap,
): Gsv7BomOperationTree {
    if (Object.keys(qtyMap).length === 0) return tree;
    return {
        ...tree,
        mainOperation: applyQtyMapToOperation(tree.mainOperation, qtyMap),
        childOperations: tree.childOperations.map((child) => applyQtyMapToOperation(child, qtyMap)),
    };
}
