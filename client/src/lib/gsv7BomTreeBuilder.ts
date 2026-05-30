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

    const childOperations: Gsv7BomStructureOperation[] = [];
    if (normalizeCode(producer.code) === normalizeCode(GSV7_MAIN_OPERATION_CODE)) {
        mainOperation.inputs.forEach((input, index) => {
            if (input.nestedOperation) {
                childOperations.push({
                    ...input.nestedOperation,
                    sequence: index + 1,
                });
            }
        });
    }

    return {
        selectedItemCode: itemCode,
        selectedItemName: item?.name ?? itemCode,
        mainOperation,
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
