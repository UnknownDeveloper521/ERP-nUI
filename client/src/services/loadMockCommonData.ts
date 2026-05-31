import { mockDepartments, mockLocations } from "@/lib/masterMockData";
import { MOCK_ITEM_TYPE, MOCK_UOM, seedLocalMasterData } from "@/lib/localMasterSeed";

interface StoreRef {
  isLoaded: boolean;
  isLoading: boolean;
  setCommonData: (data: Record<string, unknown>) => void;
  setLoading: (isLoading: boolean) => void;
}

const toEntity = (
  name: string,
  entityTypeName: string,
  id: number,
  code?: string,
) => ({
  id,
  value_name: name,
  name,
  entity_type_name: entityTypeName,
  code: code ?? String(id),
  value_code: code ?? String(id),
});

export function loadMockCommonData(store: StoreRef) {
  seedLocalMasterData();

  if (store.isLoading || store.isLoaded) return;

  store.setLoading(true);

  try {
    const departments = mockDepartments.map((d, i) =>
      toEntity(d.name, "department", i + 1),
    );
    const locations = mockLocations.map((l, i) =>
      toEntity(l.name, "location", i + 100),
    );
    const leaveTypes = [
      toEntity("Annual Leave", "leave type", 201),
      toEntity("Sick Leave", "leave type", 202),
    ];
    const currencies = [
      { ...toEntity("Ugandan Shilling", "currency", 301, "UGX") },
    ];
    const itemTypes = [
      toEntity("Raw Material", "item type", MOCK_ITEM_TYPE.RM, "RM"),
      toEntity("Semi Finished Good", "item type", MOCK_ITEM_TYPE.SFG, "SFG"),
      toEntity("Finished Good", "item type", MOCK_ITEM_TYPE.FG, "FG"),
      toEntity("Consumables", "item type", MOCK_ITEM_TYPE.CONSUMABLES, "Consumables"),
    ];
    const uoms = [
      toEntity("Pieces", "uom", MOCK_UOM.NOS, "NOS"),
      toEntity("Kilograms", "uom", MOCK_UOM.KG, "KG"),
      toEntity("Litres", "uom", MOCK_UOM.LTR, "LTR"),
    ];

    const entityValues = [
      ...departments,
      ...locations,
      ...leaveTypes,
      ...currencies,
      ...itemTypes,
      ...uoms,
    ];

    store.setCommonData({
      entityValues,
      departments,
      locations,
      leaveTypes,
      currencies,
      itemTypes,
      uoms,
    });
  } finally {
    store.setLoading(false);
  }
}
