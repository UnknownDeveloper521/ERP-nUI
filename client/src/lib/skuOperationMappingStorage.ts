export const SKU_OPERATION_MAPPING_STORAGE_KEY = "master-erp-sku-operation-mappings";

export interface SkuMappedOperation {
    operation_id: number;
    operation_code: string;
    operation_name: string;
    sequence: number;
}

export interface SkuOperationMappingRecord {
    fg_item_id: number;
    fg_code: string;
    fg_name: string;
    sku_id: number;
    sku_code: string;
    sku_name: string;
    operations: SkuMappedOperation[];
}

export function skuOperationMappingKey(fgItemId: number, skuId: number): string {
    return `${fgItemId}:${skuId}`;
}

export function loadAllSkuOperationMappings(): Record<string, SkuOperationMappingRecord> {
    try {
        const raw = localStorage.getItem(SKU_OPERATION_MAPPING_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function withSkuOperationSequences(rows: SkuMappedOperation[]): SkuMappedOperation[] {
    return rows.map((row, index) => ({ ...row, sequence: index + 1 }));
}

export function saveSkuOperationMapping(record: SkuOperationMappingRecord): void {
    const all = loadAllSkuOperationMappings();
    const key = skuOperationMappingKey(record.fg_item_id, record.sku_id);
    all[key] = {
        ...record,
        operations: withSkuOperationSequences(record.operations),
    };
    localStorage.setItem(SKU_OPERATION_MAPPING_STORAGE_KEY, JSON.stringify(all));
}

export function getSkuOperationMapping(
    fgItemId: number,
    skuId: number,
): SkuOperationMappingRecord | undefined {
    return loadAllSkuOperationMappings()[skuOperationMappingKey(fgItemId, skuId)];
}

export function listSkuOperationMappings(): SkuOperationMappingRecord[] {
    return Object.values(loadAllSkuOperationMappings()).filter(
        (r) => r && Array.isArray(r.operations) && r.operations.length > 0,
    );
}

export function deleteSkuOperationMapping(fgItemId: number, skuId: number): void {
    const all = loadAllSkuOperationMappings();
    delete all[skuOperationMappingKey(fgItemId, skuId)];
    localStorage.setItem(SKU_OPERATION_MAPPING_STORAGE_KEY, JSON.stringify(all));
}
