import { itemsApi, operationsApi } from "@/lib/api";
import {
    GSV7_FLOW_CHILD_OPERATION_CODES,
    GSV7_FLOW_STORAGE_FLAG,
    GSV7_MAIN_OPERATION_CODE,
    GSV7_MOCK_OPERATIONS,
    GSV7_ITEMS,
    OPERATION_FLOW_MAPPING_STORAGE_KEY,
    type Gsv7MockOperation,
} from "@/lib/gsv7OperationsMockData";

export interface ApiOperationRef {
    id: number;
    code: string;
    name: string;
}

type OperationTypeRecord = { id: number; value_name: string; value_code: string };

function normalizeCode(code: string) {
    return String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function findOpByCode(operations: ApiOperationRef[], code: string): ApiOperationRef | undefined {
    const target = normalizeCode(code);
    return operations.find((op) => normalizeCode(op.code) === target);
}

function hoursToCycleTime(hours: number): string {
    const totalMinutes = Math.max(0, Math.round(hours * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function resolveOperationTypeId(
    apiTypes: OperationTypeRecord[],
    typeLabel: string,
): number | undefined {
    const selected = normalizeCode(typeLabel);
    const match = apiTypes.find((t) => {
        const code = normalizeCode(t.value_code);
        const name = normalizeCode(t.value_name);
        return code === selected || name === selected;
    });
    return match?.id != null && Number.isFinite(Number(match.id)) ? Number(match.id) : undefined;
}

function mapOperationTypeApiResponse(res: {
    isSuccessful?: boolean;
    data?: OperationTypeRecord[] | null;
}): OperationTypeRecord[] {
    if (!res?.isSuccessful || !Array.isArray(res.data)) return [];
    return res.data
        .map((r) => ({
            id: Number(r.id),
            value_name: String(r.value_name ?? "").trim(),
            value_code: String(r.value_code ?? "").trim(),
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0);
}

function extractItemRows(itemsRes: { data?: unknown }): any[] {
    const data = itemsRes?.data as { records?: unknown[] } | unknown[] | undefined;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { records?: unknown[] }).records)) {
        return (data as { records: unknown[] }).records;
    }
    return [];
}

function buildItemIdByCode(items: any[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const rec of items) {
        const row = (rec as { item?: unknown })?.item ?? rec;
        const r = row as { id?: number; item_id?: number; code?: string; item_code?: string };
        const code = normalizeCode(String(r?.code ?? r?.item_code ?? ""));
        const id = Number(r?.id ?? r?.item_id);
        if (code && Number.isFinite(id) && id > 0) map.set(code, id);
    }
    return map;
}

function collectRequiredItemCodes(): string[] {
    const codes = new Set<string>();
    for (const op of GSV7_MOCK_OPERATIONS) {
        for (const line of [...op.inputs, ...op.outputs]) {
            codes.add(normalizeCode(line.itemCode));
        }
    }
    return [...codes];
}

export interface CreateGsv7OperationsResult {
    created: string[];
    skipped: string[];
    failed: { code: string; message: string }[];
    missingItemCodes: string[];
    operations: ApiOperationRef[];
}

/**
 * Creates GSV7 mock operations in the API when codes are missing.
 * Items must exist in Procurement with matching codes (see GSV7_ITEMS).
 */
export async function createGsv7OperationsFromMock(options: {
    departmentId: number;
    existingOperations: ApiOperationRef[];
}): Promise<CreateGsv7OperationsResult> {
    const { departmentId, existingOperations } = options;
    const created: string[] = [];
    const skipped: string[] = [];
    const failed: { code: string; message: string }[] = [];
    const missingItemCodes = new Set<string>();

    const [inputTypesRes, outputTypesRes, itemsRes] = await Promise.all([
        operationsApi.getInputTypes(),
        operationsApi.getOutputTypes(),
        itemsApi.getAll(1, 2000),
    ]);

    const inputTypes = mapOperationTypeApiResponse(inputTypesRes);
    const outputTypes = mapOperationTypeApiResponse(outputTypesRes);
    const itemIdByCode = buildItemIdByCode(extractItemRows(itemsRes));

    const requiredCodes = collectRequiredItemCodes();
    for (const code of requiredCodes) {
        if (!itemIdByCode.has(code)) missingItemCodes.add(code);
    }

    const operations: ApiOperationRef[] = [...existingOperations];

    const upsertOpRef = (op: { id: number; code: string; name: string }) => {
        const idx = operations.findIndex((o) => normalizeCode(o.code) === normalizeCode(op.code));
        if (idx >= 0) operations[idx] = op;
        else operations.push(op);
    };

    for (const mock of GSV7_MOCK_OPERATIONS) {
        if (findOpByCode(operations, mock.code)) {
            skipped.push(mock.code);
            continue;
        }

        const missingForOp: string[] = [];
        for (const line of [...mock.inputs, ...mock.outputs]) {
            if (!itemIdByCode.has(normalizeCode(line.itemCode))) {
                missingForOp.push(line.itemCode);
            }
        }
        if (missingForOp.length > 0) {
            failed.push({
                code: mock.code,
                message: `Missing items: ${[...new Set(missingForOp)].join(", ")}`,
            });
            continue;
        }

        const payload = buildCreatePayload(mock, departmentId, itemIdByCode, inputTypes, outputTypes);
        if (!payload) {
            failed.push({ code: mock.code, message: "Could not resolve input/output types." });
            continue;
        }

        try {
            const res = await operationsApi.create(payload);
            if (!res?.isSuccessful) {
                failed.push({
                    code: mock.code,
                    message: String(res?.message ?? "Create operation failed"),
                });
                continue;
            }
            const newId = Number(
                (res?.data as { id?: number })?.id ??
                    (res?.data as { operation?: { id?: number } })?.operation?.id,
            );
            if (!Number.isFinite(newId) || newId <= 0) {
                failed.push({ code: mock.code, message: "Created but no operation id returned." });
                continue;
            }
            created.push(mock.code);
            upsertOpRef({ id: newId, code: mock.code, name: mock.name });
        } catch (e: unknown) {
            failed.push({
                code: mock.code,
                message: e instanceof Error ? e.message : "Create operation failed",
            });
        }
    }

    return {
        created,
        skipped,
        failed,
        missingItemCodes: [...missingItemCodes],
        operations,
    };
}

function buildCreatePayload(
    mock: Gsv7MockOperation,
    departmentId: number,
    itemIdByCode: Map<string, number>,
    inputTypes: OperationTypeRecord[],
    outputTypes: OperationTypeRecord[],
) {
    const inputs = mock.inputs.map((line) => {
        const inputTypeId = resolveOperationTypeId(inputTypes, line.type);
        const itemId = itemIdByCode.get(normalizeCode(line.itemCode));
        if (!inputTypeId || !itemId) return null;
        return { item_id: itemId, input_type_id: inputTypeId };
    });
    const outputs = mock.outputs.map((line) => {
        const outputTypeId = resolveOperationTypeId(outputTypes, line.type);
        const itemId = itemIdByCode.get(normalizeCode(line.itemCode));
        if (!outputTypeId || !itemId) return null;
        return { item_id: itemId, output_type_id: outputTypeId };
    });

    if (inputs.some((x) => x == null) || outputs.some((x) => x == null)) return null;

    return {
        code: mock.code,
        name: mock.name,
        description: `GSV7 demo — ${mock.name}`,
        department_id: departmentId,
        cycle_time: hoursToCycleTime(mock.cycleTimeHours ?? 1),
        batchwise_tracking: !!mock.isBatchwise,
        is_qc_required: !!mock.isQcRequired,
        status: 1,
        inputs: inputs as { item_id: number; input_type_id: number }[],
        outputs: outputs as { item_id: number; output_type_id: number }[],
        qc_parameters: [],
    };
}

export interface SeedGsv7FlowResult {
    applied: boolean;
    parentOperationId?: number;
    mappedChildCount: number;
    missingCodes: string[];
    message: string;
}

/**
 * Writes Operation Flow Mapping for GSV7 Assembly into localStorage.
 * Matches operations by code from the API list.
 */
export function seedGsv7OperationFlowMapping(
    apiOperations: ApiOperationRef[],
    options?: { force?: boolean },
): SeedGsv7FlowResult {
    const force = options?.force ?? false;

    if (!force && localStorage.getItem(GSV7_FLOW_STORAGE_FLAG) === "1") {
        return {
            applied: false,
            mappedChildCount: 0,
            missingCodes: [],
            message: "GSV7 flow mapping already seeded (use force to overwrite).",
        };
    }

    const parent = findOpByCode(apiOperations, GSV7_MAIN_OPERATION_CODE);
    if (!parent) {
        return {
            applied: false,
            mappedChildCount: 0,
            missingCodes: [GSV7_MAIN_OPERATION_CODE],
            message: `Create operation "${GSV7_MAIN_OPERATION_CODE}" (GSV7 Assembly) in Production Masters first.`,
        };
    }

    const missingCodes: string[] = [];
    const flowRows: {
        operation_id: number;
        operation_code: string;
        operation_name: string;
        sequence: number;
    }[] = [];

    GSV7_FLOW_CHILD_OPERATION_CODES.forEach((code, index) => {
        const op = findOpByCode(apiOperations, code);
        if (!op) {
            missingCodes.push(code);
            return;
        }
        flowRows.push({
            operation_id: op.id,
            operation_code: op.code,
            operation_name: op.name,
            sequence: index + 1,
        });
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

    allMappings[String(parent.id)] = flowRows;
    localStorage.setItem(OPERATION_FLOW_MAPPING_STORAGE_KEY, JSON.stringify(allMappings));
    localStorage.setItem(GSV7_FLOW_STORAGE_FLAG, "1");

    return {
        applied: true,
        parentOperationId: parent.id,
        mappedChildCount: flowRows.length,
        missingCodes,
        message:
            missingCodes.length > 0
                ? `Flow mapping saved for GSV7 Assembly (${flowRows.length} ops). Missing codes: ${missingCodes.join(", ")}`
                : `Flow mapping saved for GSV7 Assembly with ${flowRows.length} child operations.`,
    };
}

/** Item codes to create in Procurement before running GSV7 setup. */
export function getGsv7RequiredItemCodes(): string[] {
    return Object.values(GSV7_ITEMS).map((i) => i.code);
}

/** Printable checklist for creating operations in the UI (inputs/outputs per operation). */
export function getGsv7OperationSetupChecklist(): string {
    return GSV7_MOCK_OPERATIONS.map((op) => {
        const ins = op.inputs.map((i) => `${i.itemCode} (${i.type})`).join(", ");
        const outs = op.outputs.map((o) => `${o.itemCode} (${o.type})`).join(", ");
        return `${op.code} — ${op.name}\n  Inputs: ${ins || "—"}\n  Outputs: ${outs || "—"}`;
    }).join("\n\n");
}

export async function setupGsv7ProductionDemo(options: {
    departmentId: number;
    existingOperations: ApiOperationRef[];
    forceFlow?: boolean;
}): Promise<{
    create: CreateGsv7OperationsResult;
    flow: SeedGsv7FlowResult;
}> {
    const create = await createGsv7OperationsFromMock({
        departmentId: options.departmentId,
        existingOperations: options.existingOperations,
    });
    const flow = seedGsv7OperationFlowMapping(create.operations, {
        force: options.forceFlow ?? create.created.length > 0,
    });
    return { create, flow };
}
