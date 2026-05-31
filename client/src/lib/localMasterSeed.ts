import {
  GSV7_FLOW_STORAGE_FLAG,
  GSV7_ITEMS,
  GSV7_MOCK_OPERATIONS,
  getGsv7DemoOperationId,
  getGsv7ItemIdByCode,
  mockOperationToListRow,
  seedGsv7DemoFlowMapping,
  setGsv7DemoVisible,
} from "@/lib/gsv7OperationsMockData";
import { gsv7TreeToTopLevelComponents, buildGsv7NestedBomTree } from "@/lib/gsv7BomTreeBuilder";

export const LOCAL_MASTER_SEED_VERSION = "gsv7-v1";
export const LOCAL_MASTER_SEED_FLAG = "master-erp-local-seed-version";

export const ITEMS_STORAGE_KEY = "master-erp-local-items";
export const OPERATIONS_STORAGE_KEY = "master-erp-local-operations";
export const BOM_STORAGE_KEY = "master-erp-local-boms";
export const SKU_STORAGE_KEY = "master-erp-procurement-skus";
export const SKU_OPERATION_STORAGE_KEY = "master-erp-sku-operation-api-records";

export const MOCK_ITEM_TYPE = {
  RM: 401,
  SFG: 403,
  FG: 402,
  CONSUMABLES: 404,
} as const;

export const MOCK_UOM = {
  NOS: 501,
  KG: 502,
  LTR: 503,
} as const;

export type LocalItemRecord = {
  id: number;
  code: string;
  name: string;
  item_type_id: number;
  item_type_name: string;
  uom_id: number;
  uom_name: string;
  is_expiry_tracked: boolean;
  shelf_life_days?: number;
  warranty_period?: number;
  notes?: string;
  created_at: string;
};

export type LocalOperationRecord = ReturnType<typeof mockOperationToListRow>;

export type LocalBomRecord = {
  id: number;
  bom_code: string;
  bom_name: string;
  item_id: number;
  item_name: string;
  item_type: string;
  item_type_id: number;
  description: string;
  creaed_at: string;
  created_at: string;
  components: Array<{
    id: number;
    input_component_id: number;
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    quantity: number;
    uom?: string;
  }>;
};

function itemTypeMeta(type: string) {
  switch (type) {
    case "RM":
      return { id: MOCK_ITEM_TYPE.RM, name: "Raw Material" };
    case "SFG":
      return { id: MOCK_ITEM_TYPE.SFG, name: "Semi Finished Good" };
    case "FG":
      return { id: MOCK_ITEM_TYPE.FG, name: "Finished Good" };
    default:
      return { id: MOCK_ITEM_TYPE.CONSUMABLES, name: "Consumables" };
  }
}

function uomForType(type: string, uom?: string) {
  const normalized = String(uom ?? "").toLowerCase();
  if (normalized.includes("ltr") || normalized.includes("litre")) {
    return { id: MOCK_UOM.LTR, name: "Litres" };
  }
  if (normalized.includes("nos") || type === "FG" || type === "SFG") {
    return { id: MOCK_UOM.NOS, name: "Pieces" };
  }
  return { id: MOCK_UOM.KG, name: "Kilograms" };
}

export function buildLocalItemsSeed(): LocalItemRecord[] {
  const createdAt = "2026-01-15T08:00:00.000Z";
  return Object.values(GSV7_ITEMS).map((item) => {
    const typeMeta = itemTypeMeta(item.type);
    const uomMeta = uomForType(item.type);
    return {
      id: getGsv7ItemIdByCode(item.code),
      code: item.code,
      name: item.name,
      item_type_id: typeMeta.id,
      item_type_name: typeMeta.name,
      uom_id: uomMeta.id,
      uom_name: uomMeta.name,
      is_expiry_tracked: item.type === "FG",
      shelf_life_days: item.type === "FG" ? 365 : undefined,
      warranty_period: item.type === "FG" ? 24 : undefined,
      notes: `GSV7 demo item — ${item.type}`,
      created_at: createdAt,
    };
  });
}

export function buildLocalOperationsSeed(departmentId = 1): LocalOperationRecord[] {
  return GSV7_MOCK_OPERATIONS.map((mock) => mockOperationToListRow(mock, departmentId));
}

export function buildLocalSkuSeed(fgItemId: number) {
  return [
    {
      id: 910001,
      code: "SKU-GSV7-12V",
      name: "GSV7 Battery 12V Standard",
      items_id: fgItemId,
      item_id: fgItemId,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      dimensions: "305 x 173 x 225 mm",
      weight: "28.5 Kg",
      type: "Standard",
      description: "Standard 12V GSV7 battery pack for domestic market.",
    },
    {
      id: 910002,
      code: "SKU-GSV7-EXP",
      name: "GSV7 Battery Export Grade",
      items_id: fgItemId,
      item_id: fgItemId,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      dimensions: "305 x 173 x 225 mm",
      weight: "28.5 Kg",
      type: "Export",
      description: "Export-grade GSV7 battery with enhanced packaging.",
    },
    {
      id: 910003,
      code: "SKU-GSV7-OEM",
      name: "GSV7 Battery OEM Pack",
      items_id: fgItemId,
      item_id: fgItemId,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      dimensions: "305 x 173 x 225 mm",
      weight: "28.0 Kg",
      type: "OEM",
      description: "OEM variant for partner assembly lines.",
    },
    {
      id: 910004,
      code: "SKU-GRID-CAST-STD",
      name: "Cast Grid Standard",
      items_id: getGsv7ItemIdByCode(GSV7_ITEMS.SFG_GRID_CAST.code),
      item_id: getGsv7ItemIdByCode(GSV7_ITEMS.SFG_GRID_CAST.code),
      item_code: GSV7_ITEMS.SFG_GRID_CAST.code,
      item_name: GSV7_ITEMS.SFG_GRID_CAST.name,
      dimensions: "147 x 48 x 1.4 mm",
      weight: "0.25 Kg",
      type: "Standard",
      description: "Standard cast grid SKU for grid formation operation.",
    },
  ];
}

export function buildLocalSkuOperationSeed(fgItemId: number) {
  const operations = GSV7_MOCK_OPERATIONS.map((mock, index) => ({
    id: index + 1,
    operation_id: getGsv7DemoOperationId(mock.code),
    operation_code: mock.code,
    operation_name: mock.name,
    sequence: index + 1,
  }));

  return [
    {
      id: 1,
      item_id: fgItemId,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      sku_id: 910001,
      sku_code: "SKU-GSV7-12V",
      sku_name: "GSV7 Battery 12V Standard",
      operations,
    },
    {
      id: 2,
      item_id: fgItemId,
      item_code: GSV7_ITEMS.FG_GSV7.code,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      sku_id: 910002,
      sku_code: "SKU-GSV7-EXP",
      sku_name: "GSV7 Battery Export Grade",
      operations,
    },
  ];
}

export function buildLocalBomSeed(fgItemId: number): LocalBomRecord[] {
  const tree = buildGsv7NestedBomTree(GSV7_ITEMS.FG_GSV7.code);
  const topLevel = tree ? gsv7TreeToTopLevelComponents(tree) : [];

  const components = topLevel.map((component, index) => ({
    id: index + 1,
    input_component_id: Number(component.item_id),
    item_id: Number(component.item_id),
    item_code: component.item.code,
    item_name: component.item.name,
    item_type: component.type,
    quantity: Number(component.quantity) || 1,
    uom: component.item.uom,
  }));

  const createdAt = "2026-01-15T08:00:00.000Z";

  return [
    {
      id: 1,
      bom_code: "BOM-GSV7-001",
      bom_name: "GSV7 Battery Standard BOM",
      item_id: fgItemId,
      item_name: GSV7_ITEMS.FG_GSV7.name,
      item_type: "FG",
      item_type_id: MOCK_ITEM_TYPE.FG,
      description: "Standard bill of materials for GSV7 battery assembly.",
      creaed_at: createdAt,
      created_at: createdAt,
      components,
    },
    {
      id: 2,
      bom_code: "BOM-GRID-CAST-001",
      bom_name: "Cast Grid Production BOM",
      item_id: getGsv7ItemIdByCode(GSV7_ITEMS.SFG_GRID_CAST.code),
      item_name: GSV7_ITEMS.SFG_GRID_CAST.name,
      item_type: "SFG",
      item_type_id: MOCK_ITEM_TYPE.SFG,
      description: "BOM for cast grid from purified lead ingots.",
      creaed_at: createdAt,
      created_at: createdAt,
      components: [
        {
          id: 1,
          input_component_id: getGsv7ItemIdByCode(GSV7_ITEMS.SFG_LEAD_INGOT.code),
          item_id: getGsv7ItemIdByCode(GSV7_ITEMS.SFG_LEAD_INGOT.code),
          item_code: GSV7_ITEMS.SFG_LEAD_INGOT.code,
          item_name: GSV7_ITEMS.SFG_LEAD_INGOT.name,
          item_type: "SFG",
          quantity: 0.9,
          uom: "Kg",
        },
      ],
    },
  ];
}

export function seedLocalMasterData(options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const currentVersion = localStorage.getItem(LOCAL_MASTER_SEED_FLAG);

  if (!force && currentVersion === LOCAL_MASTER_SEED_VERSION) {
    return { seeded: false, message: "Local master data already seeded." };
  }

  const items = buildLocalItemsSeed();
  const operations = buildLocalOperationsSeed();
  const fgItemId = getGsv7ItemIdByCode(GSV7_ITEMS.FG_GSV7.code);
  const skus = buildLocalSkuSeed(fgItemId);
  const skuOperations = buildLocalSkuOperationSeed(fgItemId);
  const boms = buildLocalBomSeed(fgItemId);

  localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(operations));
  localStorage.setItem(SKU_STORAGE_KEY, JSON.stringify(skus));
  localStorage.setItem(SKU_OPERATION_STORAGE_KEY, JSON.stringify(skuOperations));
  localStorage.setItem(BOM_STORAGE_KEY, JSON.stringify(boms));

  localStorage.removeItem(GSV7_FLOW_STORAGE_FLAG);
  seedGsv7DemoFlowMapping();
  setGsv7DemoVisible(true);

  localStorage.setItem(LOCAL_MASTER_SEED_FLAG, LOCAL_MASTER_SEED_VERSION);

  return {
    seeded: true,
    message: "Seeded GSV7 demo data for items, SKUs, operations, SKU mappings, and BOMs.",
    counts: {
      items: items.length,
      skus: skus.length,
      operations: operations.length,
      skuOperations: skuOperations.length,
      boms: boms.length,
    },
  };
}
