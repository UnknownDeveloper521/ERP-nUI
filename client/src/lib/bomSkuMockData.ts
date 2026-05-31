import type { SkuDropdownRecord } from "@/lib/api";
import { GSV7_ITEMS } from "@/lib/gsv7OperationsMockData";

const normalizeItemCode = (code: string) =>
    String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");

/** Stable demo SKU ids for BOM dropdowns (do not collide with API ids). */
const BOM_MOCK_SKU_ID_BASE = 9_100_001;

function mockSkuId(itemCode: string, variant: number): number {
    const norm = normalizeItemCode(itemCode);
    let hash = 0;
    for (let i = 0; i < norm.length; i += 1) {
        hash = (hash * 31 + norm.charCodeAt(i)) | 0;
    }
    return BOM_MOCK_SKU_ID_BASE + (Math.abs(hash) % 50_000) * 10 + variant;
}

function buildPair(itemCode: string, itemName: string): SkuDropdownRecord[] {
    const norm = normalizeItemCode(itemCode);
    return [
        {
            id: mockSkuId(norm, 1),
            code: `SKU-${norm}-STD`,
            name: `${itemName} — Standard`,
        },
        {
            id: mockSkuId(norm, 2),
            code: `SKU-${norm}-ALT`,
            name: `${itemName} — Alternate`,
        },
    ];
}

/** Item-code → mock SKUs for GSV7 BOM demo (temporary until API has data). */
const GSV7_BOM_MOCK_SKUS: Record<string, SkuDropdownRecord[]> = Object.fromEntries(
    Object.values(GSV7_ITEMS).map((item) => [normalizeItemCode(item.code), buildPair(item.code, item.name)]),
);

/** Extra variants for items commonly shown in the GSV7 assembly tree. */
GSV7_BOM_MOCK_SKUS[normalizeItemCode("FG-GSV7")] = [
    { id: mockSkuId("FG-GSV7", 1), code: "SKU-GSV7-12V", name: "GSV7 Battery 12V Standard" },
    { id: mockSkuId("FG-GSV7", 2), code: "SKU-GSV7-EXP", name: "GSV7 Battery Export Grade" },
    { id: mockSkuId("FG-GSV7", 3), code: "SKU-GSV7-OEM", name: "GSV7 Battery OEM Pack" },
];

/**
 * Returns mock SKU options for a BOM line when the SKU API has no records yet.
 */
export function getBomMockSkusForItem(itemCode?: string): SkuDropdownRecord[] {
    const code = normalizeItemCode(String(itemCode ?? ""));
    if (!code) {
        return [
            { id: BOM_MOCK_SKU_ID_BASE, code: "SKU-DEMO-01", name: "Demo SKU Standard" },
            { id: BOM_MOCK_SKU_ID_BASE + 1, code: "SKU-DEMO-02", name: "Demo SKU Alternate" },
        ];
    }

    const explicit = GSV7_BOM_MOCK_SKUS[code];
    if (explicit?.length) return explicit;

    const label = code.replace(/-/g, " ");
    return buildPair(code, label);
}

export function mergeSkuDropdownWithMock(
    apiRecords: SkuDropdownRecord[],
    itemCode?: string,
): SkuDropdownRecord[] {
    if (apiRecords.length > 0) return apiRecords;
    return getBomMockSkusForItem(itemCode);
}
