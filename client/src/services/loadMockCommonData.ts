import { mockDepartments, mockLocations } from "@/lib/masterMockData";

interface StoreRef {
  isLoaded: boolean;
  isLoading: boolean;
  setCommonData: (data: Record<string, unknown>) => void;
  setLoading: (isLoading: boolean) => void;
}

const toEntity = (name: string, entityTypeName: string, id: number) => ({
  id,
  value_name: name,
  name,
  entity_type_name: entityTypeName,
  code: String(id),
});

export function loadMockCommonData(store: StoreRef) {
  if (store.isLoading || store.isLoaded) return;

  store.setLoading(true);

  try {
    const departments = mockDepartments.map((d, i) =>
      toEntity(d.name, "department", i + 1)
    );
    const locations = mockLocations.map((l, i) =>
      toEntity(l.name, "location", i + 100)
    );
    const leaveTypes = [
      toEntity("Annual Leave", "leave type", 201),
      toEntity("Sick Leave", "leave type", 202),
    ];
    const currencies = [
      { ...toEntity("Ugandan Shilling", "currency", 301), code: "UGX" },
    ];
    const itemTypes = [
      toEntity("Raw Material", "item type", 401),
      toEntity("Finished Good", "item type", 402),
    ];
    const uoms = [
      toEntity("Pieces", "uom", 501),
      toEntity("Kilograms", "uom", 502),
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
