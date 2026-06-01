import { mockDepartments, mockLocations } from "@/lib/masterMockData";
import { MOCK_ITEM_TYPE, MOCK_UOM, seedLocalMasterData } from "@/lib/localMasterSeed";

interface StoreRef {
  isLoaded: boolean;
  isLoading: boolean;
  setCommonData: (data: Record<string, unknown>) => void;
  setLoading: (isLoading: boolean) => void;
  setLoaded?: (isLoaded: boolean) => void;
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
  status_name: name,
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
    const productionPlanStatuses = [
      { id: 1, value_name: "To Do", value_code: "TO_DO", code: "TO_DO", name: "To Do" },
      { id: 2, value_name: "In Progress", value_code: "IN_PROGRESS", code: "IN_PROGRESS", name: "In Progress" },
      { id: 3, value_name: "Completed", value_code: "COMPLETED", code: "COMPLETED", name: "Completed" },
      { id: 4, value_name: "Overdue", value_code: "OVERDUE", code: "OVERDUE", name: "Overdue" },
    ];
    const mrStatuses = [
      { id: 1, value_name: "Requested to Warehouse", value_code: "REQUESTED", code: "REQUESTED", name: "Requested to Warehouse" },
      { id: 2, value_name: "Issued by Warehouse", value_code: "ISSUED", code: "ISSUED", name: "Issued by Warehouse" },
      { id: 3, value_name: "Received by Production", value_code: "RECEIVED", code: "RECEIVED", name: "Received by Production" },
    ];
    const batchStatuses = [
      { id: 1, value_name: "Batch Created", value_code: "BATCH_CREATED", code: "BATCH_CREATED", name: "Batch Created" },
      { id: 2, value_name: "Sent for QC", value_code: "SENT_QC", code: "SENT_QC", name: "Sent for QC" },
      { id: 3, value_name: "Verified QC", value_code: "VERIFIED_QC", code: "VERIFIED_QC", name: "Verified QC" },
      { id: 4, value_name: "Batch Closed", value_code: "BATCH_CLOSED", code: "BATCH_CLOSED", name: "Batch Closed" },
    ];
    const quotationStatuses = [
      { id: 1, value_name: "Draft Quote", value_code: "DRAFT", code: "DRAFT", name: "Draft Quote" },
      { id: 2, value_name: "Submitted Quote", value_code: "SUBMITTED", code: "SUBMITTED", name: "Submitted Quote" },
      { id: 3, value_name: "Expired Quotations", value_code: "EXPIRED", code: "EXPIRED", name: "Expired Quotations" },
      { id: 4, value_name: "Converted to SO", value_code: "CONVERTED", code: "CONVERTED", name: "Converted to SO" },
    ];
    const salesOrderStatuses = [
      { id: 1, value_name: "Draft", value_code: "DRAFT", code: "DRAFT", name: "Draft" },
      { id: 2, value_name: "Invoice Pending", value_code: "INV_PENDING", code: "INV_PENDING", name: "Invoice Pending" },
      { id: 3, value_name: "Invoiced", value_code: "INVOICED", code: "INVOICED", name: "Invoiced" },
      { id: 4, value_name: "Dispatch Pending", value_code: "DISP_PENDING", code: "DISP_PENDING", name: "Dispatch Pending" },
      { id: 5, value_name: "Dispatched", value_code: "DISPATCHED", code: "DISPATCHED", name: "Dispatched" },
      { id: 6, value_name: "Close", value_code: "CLOSE", code: "CLOSE", name: "Close" },
    ];
    const invoicingStatuses = [
      { id: 1, value_name: "Draft", value_code: "DRAFT", code: "DRAFT", name: "Draft" },
      { id: 2, value_name: "Open", value_code: "OPEN", code: "OPEN", name: "Open" },
      { id: 3, value_name: "Partially Paid", value_code: "PARTIAL", code: "PARTIAL", name: "Partially Paid" },
      { id: 4, value_name: "Closed", value_code: "CLOSED", code: "CLOSED", name: "Closed" },
      { id: 5, value_name: "Overdue", value_code: "OVERDUE", code: "OVERDUE", name: "Overdue" },
      { id: 6, value_name: "Cancelled", value_code: "CANCELLED", code: "CANCELLED", name: "Cancelled" },
    ];
    const dispatchStatuses = [
      { id: 1, value_name: "Pending", value_code: "PENDING", code: "PENDING", name: "Pending" },
      { id: 2, value_name: "Partial", value_code: "PARTIAL", code: "PARTIAL", name: "Partial" },
      { id: 3, value_name: "Completed", value_code: "COMPLETED", code: "COMPLETED", name: "Completed" },
    ];
    const materialReleaseStatuses = [
      { id: 1, value_name: "Draft", value_code: "DRAFT", code: "DRAFT", name: "Draft" },
      { id: 2, value_name: "Issued to Warehouse", value_code: "ISSUED", code: "ISSUED", name: "Issued to Warehouse" },
      { id: 3, value_name: "Received By Warehouse", value_code: "RECEIVED", code: "RECEIVED", name: "Received By Warehouse" },
    ];

    const entityValues = [
      ...departments,
      ...locations,
      ...leaveTypes,
      ...currencies,
      ...itemTypes,
      ...uoms,
      ...mrStatuses,
      ...batchStatuses,
      ...quotationStatuses,
      ...materialReleaseStatuses,
    ];

    store.setCommonData({
      entityValues,
      departments,
      locations,
      leaveTypes,
      currencies,
      itemTypes,
      uoms,
      productionPlanStatuses,
      mrStatuses,
      batchStatuses,
      quotationStatuses,
      salesOrderStatuses,
      invoicingStatuses,
      dispatchStatuses,
      materialReleaseStatuses: materialReleaseStatuses,
    });
    store.setLoaded?.(true);
  } finally {
    store.setLoading(false);
  }
}
