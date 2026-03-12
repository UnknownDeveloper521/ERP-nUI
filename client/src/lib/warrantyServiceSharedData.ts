// ============================================================================
// SHARED WARRANTY SERVICE DATA
// ============================================================================
// This file contains shared data and types for Warranty Service Requests
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ServiceRequestStatus = "Draft" | "Submitted Request" | "Completed Request" | "Rejected Request";
export type ServiceAction = "Repair" | "Replace" | "";
export type WarrantyStatus = "Under Warranty" | "Expired";
export type ClaimStatus = "Accept" | "Reject" | "NA" | "";

export interface RepairItem {
    id: number;
    itemName: string;
    stock: number;
    qty: number;
    price: number;
    billable: boolean;
}

export interface ReplaceItem {
    id: number;
    itemName: string;
    newSerialNumber: string;
}

export interface ServiceRequestData {
    id: number;
    serviceRequestCode?: string;
    clientName: string;
    serialNumber: string;
    itemName?: string;
    batch: string;
    productionDate: string;
    invoiceDate: string;
    warrantyEndDate: string;
    warrantyStatus: WarrantyStatus;
    complaintDescription: string;
    claim: ClaimStatus;
    reason: string;
    status: ServiceRequestStatus;
    serviceAction: ServiceAction;
    repairItems: RepairItem[];
    replaceItems: ReplaceItem[];
    newSerialNumber?: string;
    labourCost?: number;
    labourBillable?: boolean;
    serviceDate?: string;
}

export interface SerialNumberData {
    serialNumber: string;
    itemName: string;
    batch: string;
    productionDate: string;
    invoiceDate: string;
    warrantyEndDate: string;
    clientName?: string;
}

// ============================================================================
// MOCK SERIAL NUMBERS - Empty array (no mock data)
// ============================================================================

export const MOCK_SERIAL_NUMBERS: SerialNumberData[] = [
    {
        serialNumber: "SN-2025-101",
        itemName: "UPS 1KVA",
        batch: "BATCH-2025-A",
        productionDate: "2025-01-15",
        invoiceDate: "2025-02-01",
        warrantyEndDate: "2027-02-01",
        clientName: "Green Energy Corp"
    },
    {
        serialNumber: "SN-2023-201",
        itemName: "Inverter Battery 200Ah",
        batch: "BATCH-2023-A",
        productionDate: "2023-04-20",
        invoiceDate: "2023-05-05",
        warrantyEndDate: "2024-05-05",
        clientName: "Power Systems Ltd"
    },
    {
        serialNumber: "SN-2025-103",
        itemName: "Inverter Battery 150Ah",
        batch: "BATCH-2025-C",
        productionDate: "2025-01-10",
        invoiceDate: "2025-02-01",
        warrantyEndDate: "2027-02-01",
        clientName: "ABC Electronics Ltd"
    },
    {
        serialNumber: "SN-2023-206",
        itemName: "UPS 1.5KVA",
        batch: "BATCH-2023-F",
        productionDate: "2023-06-15",
        invoiceDate: "2023-07-01",
        warrantyEndDate: "2024-07-01",
        clientName: "Smart Power Solutions"
    },
    {
        serialNumber: "SN-2025-107",
        itemName: "Solar Inverter 3KW",
        batch: "BATCH-2025-G",
        productionDate: "2025-02-01",
        invoiceDate: "2025-02-15",
        warrantyEndDate: "2027-02-15",
        clientName: "Future Tech Industries"
    },
    {
        serialNumber: "824056",
        itemName: "Industrial Inverter 5KW",
        batch: "BATCH-2025-Z",
        productionDate: "2025-06-10",
        invoiceDate: "2025-07-05",
        warrantyEndDate: "2028-07-05",
        clientName: "Adani Solar Ltd"
    },
    {
        serialNumber: "405912",
        itemName: "UPS 2KVA - Pro",
        batch: "BATCH-2023-X",
        productionDate: "2023-01-10",
        invoiceDate: "2023-01-25",
        warrantyEndDate: "2024-01-25",
        clientName: "Reliance Industries"
    }
];

// ============================================================================
// REPAIR ITEMS
// ============================================================================

export const REPAIR_ITEMS = [
    "Battery Lids",
    "Separators",
    "Terminals",
    "Connectors"
];

export const MOCK_STOCK_DATA: Record<string, number> = {
    "Battery Lids": 180,
    "Separators": 500,
    "Terminals": 350,
    "Connectors": 420
};

export const REPLACE_ITEMS = [
    "Inverter Battery 150Ah",
    "Solar Panel 300W",
    "UPS 1KVA",
    "Inverter Battery 200Ah",
    "Solar Inverter 5KW"
];

// ============================================================================
// DEFAULT MOCK DATA - Returns fresh data every time
// ============================================================================

export const getDefaultMockData = (): ServiceRequestData[] => {
    // Return 8 mock service requests - 2 for each status (1 under warranty, 1 expired)
    return [
        // Draft Status - 2 entries (1 under warranty, 1 expired)
        {
            id: 1001,
            serviceRequestCode: "SR-2026-001",
            clientName: "Green Energy Corp",
            serialNumber: "SN-2025-101",
            itemName: "UPS 1KVA",
            batch: "BATCH-2025-A",
            productionDate: "2025-01-15",
            invoiceDate: "2025-02-01",
            warrantyEndDate: "2027-02-01",
            warrantyStatus: "Under Warranty",
            complaintDescription: "UPS not switching to battery backup during power outage.",
            claim: "",
            reason: "",
            status: "Draft",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: "2026-03-05"
        },
        {
            id: 1002,
            serviceRequestCode: "SR-2026-002",
            clientName: "Power Systems Ltd",
            serialNumber: "SN-2023-201",
            itemName: "Inverter Battery 200Ah",
            batch: "BATCH-2023-A",
            productionDate: "2023-04-20",
            invoiceDate: "2023-05-05",
            warrantyEndDate: "2024-05-05",
            warrantyStatus: "Expired",
            complaintDescription: "Battery terminals showing signs of corrosion.",
            claim: "",
            reason: "",
            status: "Draft",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: "2026-03-06"
        },
        // Submitted Request Status - 2 entries (1 under warranty, 1 expired)
        {
            id: 1003,
            serviceRequestCode: "SR-2026-003",
            clientName: "ABC Electronics Ltd",
            serialNumber: "SN-2025-103",
            itemName: "Inverter Battery 150Ah",
            batch: "BATCH-2025-C",
            productionDate: "2025-01-10",
            invoiceDate: "2025-02-01",
            warrantyEndDate: "2027-02-01",
            warrantyStatus: "Under Warranty",
            complaintDescription: "Battery not holding charge properly. Backup time reduced significantly.",
            claim: "Accept",
            reason: "",
            status: "Submitted Request",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: "2026-03-07"
        },
        {
            id: 1004,
            serviceRequestCode: "SR-2026-004",
            clientName: "Industrial Solutions Inc",
            serialNumber: "SN-2023-202",
            itemName: "Solar Inverter 3KW",
            batch: "BATCH-2023-B",
            productionDate: "2023-03-25",
            invoiceDate: "2023-04-10",
            warrantyEndDate: "2024-04-10",
            warrantyStatus: "Expired",
            complaintDescription: "Inverter display showing error codes intermittently.",
            claim: "Accept",
            reason: "",
            status: "Submitted Request",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: "2026-03-07"
        },
        // Completed Request Status - 4 entries (1 under warranty repair, 1 under warranty reject+repair, 1 expired replace, 1 expired NA)
        {
            id: 1005,
            serviceRequestCode: "SR-2026-005",
            clientName: "Tech Innovations Pvt Ltd",
            serialNumber: "SN-2025-105",
            itemName: "Solar Panel 300W",
            batch: "BATCH-2025-E",
            productionDate: "2025-01-05",
            invoiceDate: "2025-01-20",
            warrantyEndDate: "2027-01-20",
            warrantyStatus: "Under Warranty",
            complaintDescription: "Panel output voltage fluctuating beyond normal range.",
            claim: "Accept",
            reason: "",
            status: "Completed Request",
            serviceAction: "Repair",
            repairItems: [
                {
                    id: 1,
                    itemName: "Terminals",
                    stock: 350,
                    qty: 10,
                    price: 75,
                    billable: false
                }
            ],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 150,
            labourBillable: false,
            serviceDate: "2026-03-08"
        },
        {
            id: 1006,
            serviceRequestCode: "SR-2026-006",
            clientName: "Renewable Energy Co",
            serialNumber: "SN-2023-203",
            itemName: "Inverter Battery 150Ah",
            batch: "BATCH-2023-C",
            productionDate: "2023-05-12",
            invoiceDate: "2023-06-28",
            warrantyEndDate: "2024-06-28",
            warrantyStatus: "Expired",
            complaintDescription: "Battery electrolyte level dropping rapidly.",
            claim: "NA",
            reason: "",
            status: "Completed Request",
            serviceAction: "Replace",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "SN-2026-NEW-001",
            labourCost: 200,
            labourBillable: true,
            serviceDate: "2026-03-09"
        },
        {
            id: 1009,
            serviceRequestCode: "SR-2026-009",
            clientName: "Smart Power Solutions",
            serialNumber: "SN-2023-206",
            itemName: "UPS 1.5KVA",
            batch: "BATCH-2023-F",
            productionDate: "2023-06-15",
            invoiceDate: "2023-07-01",
            warrantyEndDate: "2024-07-01",
            warrantyStatus: "Expired",
            complaintDescription: "UPS making unusual noise during operation. Customer inspection only.",
            claim: "NA",
            reason: "",
            status: "Completed Request",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: "2026-03-10"
        },
        {
            id: 1010,
            serviceRequestCode: "SR-2026-010",
            clientName: "Future Tech Industries",
            serialNumber: "SN-2025-107",
            itemName: "Solar Inverter 3KW",
            batch: "BATCH-2025-G",
            productionDate: "2025-02-01",
            invoiceDate: "2025-02-15",
            warrantyEndDate: "2027-02-15",
            warrantyStatus: "Under Warranty",
            complaintDescription: "Inverter efficiency below expected levels. Customer requested inspection despite warranty coverage.",
            claim: "Reject",
            reason: "Customer declined warranty claim but requested paid service",
            status: "Completed Request",
            serviceAction: "Repair",
            repairItems: [
                {
                    id: 1,
                    itemName: "Connectors",
                    stock: 420,
                    qty: 5,
                    price: 50,
                    billable: true
                }
            ],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 100,
            labourBillable: true,
            serviceDate: "2026-03-11"
        },
        // Rejected Request Status - 2 entries (both expired - rejected because warranty expired)
        {
            id: 1007,
            serviceRequestCode: "SR-2026-007",
            clientName: "Tech Solutions Inc",
            serialNumber: "SN-2023-204",
            itemName: "Solar Panel 250W",
            batch: "BATCH-2023-D",
            productionDate: "2023-05-15",
            invoiceDate: "2023-06-01",
            warrantyEndDate: "2024-06-01",
            warrantyStatus: "Expired",
            complaintDescription: "Panel efficiency dropped below 70%. Output voltage is inconsistent.",
            claim: "Reject",
            reason: "Warranty Expired - Customer declined billable service",
            status: "Rejected Request",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: ""
        },
        {
            id: 1008,
            serviceRequestCode: "SR-2026-008",
            clientName: "Metro Industries",
            serialNumber: "SN-2023-205",
            itemName: "UPS 2KVA",
            batch: "BATCH-2023-E",
            productionDate: "2023-04-10",
            invoiceDate: "2023-05-01",
            warrantyEndDate: "2024-05-01",
            warrantyStatus: "Expired",
            complaintDescription: "UPS battery backup time reduced to less than 5 minutes.",
            claim: "Reject",
            reason: "Warranty Expired - Customer declined billable service",
            status: "Rejected Request",
            serviceAction: "",
            repairItems: [],
            replaceItems: [],
            newSerialNumber: "",
            labourCost: 0,
            labourBillable: false,
            serviceDate: ""
        }
    ];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getNextServiceRequestCode = (existingRequests: ServiceRequestData[]): string => {
    const year = new Date().getFullYear();
    const count = existingRequests.length + 1;
    return `SR-${year}-${String(count).padStart(3, '0')}`;
};
