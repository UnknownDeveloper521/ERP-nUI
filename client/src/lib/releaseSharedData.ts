// ============================================================================
// SHARED OPERATION RELEASE DATA
// ============================================================================
// This file contains shared data and types for Operation Releases used by both:
// - Production module (Material Release)
// - Inventory module (WH Receive)
// ============================================================================

export interface ProducedItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  qtyProduced: number;
}

export interface OperationRelease {
  id: number;
  releaseNo: string;
  releaseDate: string;
  releasedBy: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  batchIds: string[];
  status: "Issued to Warehouse" | "Received By Warehouse";
  items: ProducedItem[];
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
  batchDetails?: Array<{
    batchNo: string;
    shift: "Morning" | "Night";
    items: ProducedItem[];
  }>;
}

// ============================================================================
// MOCK DATA
// ============================================================================

export let mockReleaseRecords: OperationRelease[] = [
  {
    id: 1,
    releaseNo: "REL-2024-001",
    releaseDate: "2024-02-21",
    operation: "Lead Generation & Purification",
    workCenter: "Lead Furnace Center",
    warehouse: "Jinja WH",
    releasedBy: "John Doe",
    qcVerifiedBy: "Sarah QC",
    qcVerifiedOn: "2024-02-21",
    status: "Issued to Warehouse",
    batchIds: ["BT-PL-001", "BT-PL-002"],
    items: [
      { id: 101, itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG", qtyProduced: 950 },
    ],
    batchDetails: [
      {
        batchNo: "BT-PL-001",
        shift: "Morning",
        items: [{ id: 101, itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG", qtyProduced: 500 }]
      },
      {
        batchNo: "BT-PL-002",
        shift: "Night",
        items: [{ id: 101, itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG", qtyProduced: 450 }]
      }
    ]
  },
  {
    id: 2,
    releaseNo: "REL-2024-002",
    releaseDate: "2024-02-22",
    operation: "Case Creation",
    workCenter: "Plastic Casing Center",
    warehouse: "Jinja WH",
    releasedBy: "Mike Ross",
    status: "Received By Warehouse",
    batchIds: ["BT-BC-005"],
    items: [
      { id: 201, itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS", qtyProduced: 200 },
    ],
    batchDetails: [
      {
        batchNo: "BT-BC-005",
        shift: "Morning",
        items: [{ id: 201, itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS", qtyProduced: 200 }]
      }
    ]
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const addReleaseRecord = (record: OperationRelease): OperationRelease[] => {
  mockReleaseRecords.unshift(record);
  return [...mockReleaseRecords];
};

export const updateReleaseRecord = (id: number, updates: Partial<OperationRelease>): OperationRelease[] => {
  const index = mockReleaseRecords.findIndex(req => req.id === id);
  if (index !== -1) {
    mockReleaseRecords[index] = { ...mockReleaseRecords[index], ...updates };
  }
  return [...mockReleaseRecords];
};

export const getReleaseRecordById = (id: number): OperationRelease | undefined => {
  return mockReleaseRecords.find(req => req.id === id);
};
