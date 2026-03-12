import { Vendor, PurchaseOrder, MaterialRequisition, MRStatus, MRQueueType, MRRole, MRItem, ToProcureRequirement, ToProcureLine, ToProcureStatus, ToProcureLineStatus, ToProcureMode, IssueRequest, IssueRequestLine, IssueRequestStatus, FulfillmentTrackerSummary, FulfillmentTrackerDetail as FulfillmentTrackerDetailType, TrackerLine, TrackerOverallStatus, TrackerLineStatus, MRHistorySummary, MRHistoryDetail, MRHistoryLine, MRHistoryStatus, MRHistoryLineStatus, MRAuditEvent } from "./types";

// Re-export types for convenience
export type { MaterialRequisition, MRStatus, MRQueueType, MRRole, MRItem, ToProcureRequirement, ToProcureLine, ToProcureStatus, ToProcureLineStatus, ToProcureMode, IssueRequest, IssueRequestLine, IssueRequestStatus, FulfillmentTrackerSummary, TrackerLine, TrackerOverallStatus, TrackerLineStatus, MRHistorySummary, MRHistoryDetail, MRHistoryLine, MRHistoryStatus, MRHistoryLineStatus, MRAuditEvent };
export type FulfillmentTrackerDetail = FulfillmentTrackerDetailType;

export const initialVendors: Vendor[] = [
    { id: 1, name: "Global Supplies Ltd", email: "sales@globalsupplies.com", phone: "+91-22-1234-5678", city: "Mumbai", paymentTerms: "Net 30", status: "Active" },
    { id: 2, name: "Premium Chemicals Inc", email: "orders@premiumchem.com", phone: "+91-80-2222-3333", city: "Bangalore", paymentTerms: "Net 45", status: "Active" },
    { id: 3, name: "Industrial Equipment Co", email: "sales@indequip.com", phone: "+91-33-4444-5555", city: "Kolkata", paymentTerms: "Net 15", status: "Active" },
    { id: 4, name: "Regional Traders", email: "contact@regionaltraders.com", phone: "+91-40-6666-7777", city: "Hyderabad", paymentTerms: "Net 30", status: "Inactive" },
];

export const initialPOs: PurchaseOrder[] = [
    { id: 1, poNumber: "PO-2025-001", vendorId: 1, date: "2025-11-15", dueDate: "2025-12-15", itemName: "Packaging Materials", quantity: 500, unit: "Boxes", unitPrice: 150, totalAmount: 75000, status: "Confirmed", notes: "Standard packaging" },
    { id: 2, poNumber: "PO-2025-002", vendorId: 2, date: "2025-11-18", dueDate: "2025-12-03", itemName: "Lime Powder", quantity: 100, unit: "MT", unitPrice: 5000, totalAmount: 500000, status: "Pending", notes: "High purity required" },
    { id: 3, poNumber: "PO-2025-003", vendorId: 1, date: "2025-11-20", dueDate: "2025-12-05", itemName: "Bags", quantity: 10000, unit: "Bags", unitPrice: 12, totalAmount: 120000, status: "Delivered", notes: "Express delivery" },
    { id: 4, poNumber: "PO-2025-004", vendorId: 3, date: "2025-11-22", dueDate: "2025-12-22", itemName: "Processing Equipment", quantity: 2, unit: "Units", unitPrice: 850000, totalAmount: 1700000, status: "Paid", notes: "Installation included" },
];

// ========================================
// NEW MOCK DATA FOR 7 TABS TESTING
// ========================================

export const initialMRs: MaterialRequisition[] = [
    // TAB 1: DRAFT
    {
        id: 201,
        mrNumber: "MR-2025-201",
        mrDate: "2025-02-13",
        requestingDepartment: "Engineering",
        priority: "Normal",
        requiredByDate: "2025-02-25",
        status: "Draft",
        requesterName: "Alex Thompson",
        assignedTo: "Procurement Team",
        items: [
            { id: "20101", itemId: "tool1", itemName: "Precision Screwdriver Set", uom: "Set", quantity: 5, availableStock: 8, estimatedCost: 750, suggestedAction: "Issue from Stock", pendingQty: 5, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 },
            { id: "20102", itemId: "tool2", itemName: "Digital Multimeter", uom: "Units", quantity: 3, availableStock: 0, estimatedCost: 4500, suggestedAction: "Purchase Required", pendingQty: 3, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: new Date().toISOString(),
        procurementStatus: "Not Started"
    },
    // REJECTED MR - For testing Edit MR prompt
    {
        id: 209,
        mrNumber: "MR-2025-209",
        mrDate: "2025-02-12",
        requestingDepartment: "Maintenance",
        priority: "Urgent",
        requiredByDate: "2025-02-18",
        status: "Rejected",
        requesterName: "Admin User",
        assignedTo: "Procurement Team",
        items: [
            { id: "20901", itemId: "tool2", itemName: "Hydraulic Pump", uom: "Units", quantity: 5, availableStock: 0, estimatedCost: 30000, suggestedAction: "Purchase Required", pendingQty: 5, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: "2025-02-12T08:00:00Z",
        submittedAt: "2025-02-12T09:00:00Z",
        rejectReason: "Budget not approved for this quarter. Please resubmit in Q2 with proper budget allocation approval from Finance Department.",
        procurementStatus: "Not Started"
    },
    // TAB 2: APPROVALS
    {
        id: 202,
        mrNumber: "MR-2025-202",
        mrDate: "2025-02-12",
        requestingDepartment: "IT Department",
        priority: "Urgent",
        requiredByDate: "2025-02-18",
        status: "Submitted",
        requesterName: "Maria Garcia",
        assignedTo: "Procurement Team",
        items: [
            { id: "20201", itemId: "net1", itemName: "Network Switches", uom: "Units", quantity: 4, availableStock: 0, estimatedCost: 32000, suggestedAction: "Purchase Required", pendingQty: 4, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 },
            { id: "20202", itemId: "net2", itemName: "Cat6 Ethernet Cables", uom: "Meters", quantity: 200, availableStock: 50, estimatedCost: 6000, suggestedAction: "Purchase Required", pendingQty: 200, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: "2025-02-12T08:00:00Z",
        submittedAt: "2025-02-12T09:30:00Z",
        procurementStatus: "Not Started"
    },
    // TAB 3: MR REVIEW & FULFILLMENT
    {
        id: 203,
        mrNumber: "MR-2025-203",
        mrDate: "2025-02-10",
        requestingDepartment: "R&D Lab",
        priority: "Normal",
        requiredByDate: "2025-02-28",
        status: "Approved",
        requesterName: "Dr. Chen Wei",
        assignedTo: "Procurement Team",
        items: [
            { id: "20301", itemId: "lab1", itemName: "Laboratory Glassware Set", uom: "Set", quantity: 2, availableStock: 0, estimatedCost: 8500, suggestedAction: "Purchase Required", pendingQty: 2, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 },
            { id: "20302", itemId: "lab2", itemName: "Chemical Reagents Kit", uom: "Kit", quantity: 5, availableStock: 0, estimatedCost: 15000, suggestedAction: "Purchase Required", pendingQty: 5, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: "2025-02-10T07:00:00Z",
        submittedAt: "2025-02-10T08:00:00Z",
        approvedAt: "2025-02-11T10:00:00Z",
        procurementStatus: "Not Started"
    },
    // TAB 4: TO PROCURE
    {
        id: 204,
        mrNumber: "MR-2025-204",
        mrDate: "2025-02-11",
        requestingDepartment: "Manufacturing",
        priority: "Urgent",
        requiredByDate: "2025-02-20",
        status: "Approved",
        requesterName: "Robert Brown",
        assignedTo: "Procurement Team",
        items: [
            { id: "20401", itemId: "cnc1", itemName: "CNC Machine Tools", uom: "Set", quantity: 1, availableStock: 0, estimatedCost: 45000, suggestedAction: "Purchase Required", pendingQty: 1, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 },
            { id: "20402", itemId: "cnc2", itemName: "Cutting Fluid", uom: "Liters", quantity: 100, availableStock: 20, estimatedCost: 8000, suggestedAction: "Purchase Required", pendingQty: 100, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: "2025-02-11T06:00:00Z",
        submittedAt: "2025-02-11T07:00:00Z",
        approvedAt: "2025-02-11T14:00:00Z",
        procurementStatus: "Not Started"
    },
    // TAB 5: ISSUE REQUESTS
    {
        id: 205,
        mrNumber: "MR-2025-205",
        mrDate: "2025-02-13",
        requestingDepartment: "Warehouse",
        priority: "Normal",
        requiredByDate: "2025-02-19",
        status: "Approved",
        requesterName: "David Martinez",
        assignedTo: "Stores Team",
        items: [
            { id: "20501", itemId: "wh1", itemName: "Pallet Jacks", uom: "Units", quantity: 2, availableStock: 5, estimatedCost: 18000, suggestedAction: "Issue from Stock", pendingQty: 2, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 },
            { id: "20502", itemId: "wh2", itemName: "Safety Vests", uom: "Pieces", quantity: 50, availableStock: 150, estimatedCost: 2500, suggestedAction: "Issue from Stock", pendingQty: 50, lineStatus: "Pending", issuedQty: 0, orderedQty: 0 }
        ],
        createdAt: "2025-02-13T07:00:00Z",
        submittedAt: "2025-02-13T08:00:00Z",
        approvedAt: "2025-02-13T11:00:00Z",
        procurementStatus: "Not Started"
    },
    // TAB 6: FULFILLMENT TRACKER
    {
        id: 206,
        mrNumber: "MR-2025-206",
        mrDate: "2025-02-09",
        requestingDepartment: "Operations",
        priority: "Urgent",
        requiredByDate: "2025-02-17",
        status: "Partially Fulfilled",
        requesterName: "Lisa Anderson",
        assignedTo: "Procurement Team",
        items: [
            { id: "20601", itemId: "ops1", itemName: "Industrial Fans", uom: "Units", quantity: 8, availableStock: 3, estimatedCost: 24000, suggestedAction: "Purchase Required", issuedQty: 3, pendingQty: 5, lineStatus: "Partial", orderedQty: 5 },
            { id: "20602", itemId: "ops2", itemName: "LED Work Lights", uom: "Units", quantity: 20, availableStock: 20, estimatedCost: 6000, suggestedAction: "Issue from Stock", issuedQty: 20, pendingQty: 0, lineStatus: "Completed", orderedQty: 0 }
        ],
        createdAt: "2025-02-09T06:00:00Z",
        submittedAt: "2025-02-09T07:00:00Z",
        approvedAt: "2025-02-09T10:00:00Z",
        procurementStatus: "In Progress",
        linkedStockIssueNo: "ISS-2025-206"
    },
    // TAB 7: MR HISTORY
    {
        id: 207,
        mrNumber: "MR-2025-207",
        mrDate: "2025-02-05",
        requestingDepartment: "Facilities",
        priority: "Normal",
        requiredByDate: "2025-02-15",
        status: "Fulfilled",
        requesterName: "James Wilson",
        assignedTo: "Procurement Team",
        items: [
            { id: "20701", itemId: "fac1", itemName: "Office Chairs", uom: "Units", quantity: 10, availableStock: 0, estimatedCost: 35000, suggestedAction: "Purchase Required", issuedQty: 0, pendingQty: 0, lineStatus: "Completed", orderedQty: 10 },
            { id: "20702", itemId: "fac2", itemName: "Desk Lamps", uom: "Units", quantity: 15, availableStock: 15, estimatedCost: 4500, suggestedAction: "Issue from Stock", issuedQty: 15, pendingQty: 0, lineStatus: "Completed", orderedQty: 0 }
        ],
        createdAt: "2025-02-05T08:00:00Z",
        submittedAt: "2025-02-05T09:00:00Z",
        approvedAt: "2025-02-05T14:00:00Z",
        procurementStatus: "Completed",
        linkedStockIssueNo: "ISS-2025-207",
        linkedPO: "PO-2025-207"
    },
];

// To Procure Requirements
export const initialToProcureRequirements: ToProcureRequirement[] = [
    {
        id: 1,
        mrNumber: "MR-2025-204",
        mrId: 204,
        department: "Manufacturing",
        requester: "Robert Brown",
        requiredBy: "2025-02-20",
        priority: "Urgent",
        status: "Pending",
        notes: "CNC tools and cutting fluid needed",
        totalProcureLines: 2,
        lines: [
            {
                id: "line-1-1",
                itemId: "cnc1",
                itemName: "CNC Machine Tools",
                uom: "Set",
                qtyToProcure: 1,
                deadline: "2025-02-20",
                vendorId: undefined,
                mode: undefined,
                lineStatus: "Pending",
                notes: "High precision tools required"
            },
            {
                id: "line-1-2",
                itemId: "cnc2",
                itemName: "Cutting Fluid",
                uom: "Liters",
                qtyToProcure: 100,
                deadline: "2025-02-20",
                vendorId: undefined,
                mode: undefined,
                lineStatus: "Pending",
                notes: "Biodegradable type preferred"
            }
        ]
    },
    {
        id: 2,
        mrNumber: "MR-2025-203",
        mrId: 203,
        department: "R&D Lab",
        requester: "Dr. Chen Wei",
        requiredBy: "2025-02-28",
        priority: "Normal",
        status: "PO Created",
        notes: "Laboratory supplies",
        totalProcureLines: 2,
        lines: [
            {
                id: "line-2-1",
                itemId: "lab1",
                itemName: "Laboratory Glassware Set",
                uom: "Set",
                qtyToProcure: 2,
                deadline: "2025-02-28",
                vendorId: 2,
                mode: "PO",
                lineStatus: "PO Requested",
                notes: "Borosilicate glass required"
            },
            {
                id: "line-2-2",
                itemId: "lab2",
                itemName: "Chemical Reagents Kit",
                uom: "Kit",
                qtyToProcure: 5,
                deadline: "2025-02-28",
                vendorId: 2,
                mode: "PO",
                lineStatus: "PO Requested",
                notes: "Analytical grade"
            }
        ]
    }
];

export const mockProductList = [
    { id: "tool1", name: "Precision Screwdriver Set", uom: "Set", stock: 8 },
    { id: "tool2", name: "Digital Multimeter", uom: "Units", stock: 0 },
    { id: "net1", name: "Network Switches", uom: "Units", stock: 0 },
    { id: "net2", name: "Cat6 Ethernet Cables", uom: "Meters", stock: 50 },
    { id: "lab1", name: "Laboratory Glassware Set", uom: "Set", stock: 0 },
    { id: "lab2", name: "Chemical Reagents Kit", uom: "Kit", stock: 0 },
    { id: "cnc1", name: "CNC Machine Tools", uom: "Set", stock: 0 },
    { id: "cnc2", name: "Cutting Fluid", uom: "Liters", stock: 20 },
    { id: "wh1", name: "Pallet Jacks", uom: "Units", stock: 5 },
    { id: "wh2", name: "Safety Vests", uom: "Pieces", stock: 150 },
    { id: "ops1", name: "Industrial Fans", uom: "Units", stock: 3 },
    { id: "ops2", name: "LED Work Lights", uom: "Units", stock: 20 },
    { id: "fac1", name: "Office Chairs", uom: "Units", stock: 0 },
    { id: "fac2", name: "Desk Lamps", uom: "Units", stock: 15 },
];

// Issue Requests
export const initialIssueRequests: IssueRequest[] = [
    {
        id: 1,
        issueReqNo: "ISS-2025-205",
        mrNumber: "MR-2025-205",
        mrId: 205,
        department: "Warehouse",
        requester: "David Martinez",
        requiredBy: "2025-02-19",
        status: "Pending",
        createdBy: "Procurement Manager",
        createdDate: "2025-02-13",
        totalLines: 2,
        qtyPending: 52,
        lines: [
            {
                id: "line-1-1",
                itemId: "wh1",
                itemName: "Pallet Jacks",
                uom: "Units",
                qtyToIssue: 2,
                issuedQty: 0,
                balance: 2,
                warehouseBin: undefined,
                remarks: "",
                issueDate: undefined,
                issuedQtyThisTime: 0
            },
            {
                id: "line-1-2",
                itemId: "wh2",
                itemName: "Safety Vests",
                uom: "Pieces",
                qtyToIssue: 50,
                issuedQty: 0,
                balance: 50,
                warehouseBin: undefined,
                remarks: "",
                issueDate: undefined,
                issuedQtyThisTime: 0
            }
        ]
    },
    {
        id: 2,
        issueReqNo: "ISS-2025-206",
        mrNumber: "MR-2025-206",
        mrId: 206,
        department: "Operations",
        requester: "Lisa Anderson",
        requiredBy: "2025-02-17",
        status: "Partially Issued",
        createdBy: "Procurement Team",
        createdDate: "2025-02-09",
        totalLines: 2,
        qtyPending: 0,
        lines: [
            {
                id: "line-2-1",
                itemId: "ops1",
                itemName: "Industrial Fans",
                uom: "Units",
                qtyToIssue: 3,
                issuedQty: 3,
                balance: 0,
                warehouseBin: "WH-A-01",
                remarks: "Issued complete",
                issueDate: "2025-02-10",
                issuedQtyThisTime: 0
            },
            {
                id: "line-2-2",
                itemId: "ops2",
                itemName: "LED Work Lights",
                uom: "Units",
                qtyToIssue: 20,
                issuedQty: 20,
                balance: 0,
                warehouseBin: "WH-B-03",
                remarks: "Full quantity issued",
                issueDate: "2025-02-10",
                issuedQtyThisTime: 0
            }
        ]
    },
    {
        id: 3,
        issueReqNo: "ISS-2025-207",
        mrNumber: "MR-2025-207",
        mrId: 207,
        department: "Facilities",
        requester: "James Wilson",
        requiredBy: "2025-02-15",
        status: "Issued Complete",
        createdBy: "Procurement Manager",
        createdDate: "2025-02-05",
        totalLines: 1,
        qtyPending: 0,
        lines: [
            {
                id: "line-3-1",
                itemId: "fac2",
                itemName: "Desk Lamps",
                uom: "Units",
                qtyToIssue: 15,
                issuedQty: 15,
                balance: 0,
                warehouseBin: "WH-A-05",
                remarks: "Full quantity issued",
                issueDate: "2025-02-06",
                issuedQtyThisTime: 0
            }
        ]
    }
];

export const warehouseBins = [
    "WH-A-01", "WH-A-02", "WH-A-03", "WH-A-04", "WH-A-05", "WH-A-06",
    "WH-B-01", "WH-B-02", "WH-B-03", "WH-B-04",
    "WH-C-01", "WH-C-02", "WH-C-03",
    "WH-D-01", "WH-D-02"
];

// Fulfillment Tracker
export const fulfillmentTrackerSummaries: FulfillmentTrackerSummary[] = [
    {
        id: 1,
        mrNumber: "MR-2025-206",
        mrId: 206,
        department: "Operations",
        requester: "Lisa Anderson",
        requiredBy: "2025-02-17",
        totalLines: 2,
        issuedLines: 2,
        procuredLines: 1,
        pendingLines: 1,
        overallStatus: "IN_PROGRESS"
    },
    {
        id: 2,
        mrNumber: "MR-2025-205",
        mrId: 205,
        department: "Warehouse",
        requester: "David Martinez",
        requiredBy: "2025-02-19",
        totalLines: 2,
        issuedLines: 0,
        procuredLines: 0,
        pendingLines: 2,
        overallStatus: "OPEN"
    },
    {
        id: 3,
        mrNumber: "MR-2025-207",
        mrId: 207,
        department: "Facilities",
        requester: "James Wilson",
        requiredBy: "2025-02-15",
        totalLines: 2,
        issuedLines: 1,
        procuredLines: 1,
        pendingLines: 0,
        overallStatus: "COMPLETED"
    }
];

export const fulfillmentTrackerDetails: FulfillmentTrackerDetail[] = [
    {
        id: 1,
        mrNumber: "MR-2025-206",
        mrId: 206,
        department: "Operations",
        requester: "Lisa Anderson",
        requiredBy: "2025-02-17",
        overallStatus: "IN_PROGRESS",
        lines: [
            {
                id: "line-1-1",
                itemId: "ops1",
                itemName: "Industrial Fans",
                uom: "Units",
                qtyRequested: 8,
                issuedQty: 3,
                poQty: 5,
                grnQty: 0,
                balance: 8,
                status: "IN_PROGRESS"
            },
            {
                id: "line-1-2",
                itemId: "ops2",
                itemName: "LED Work Lights",
                uom: "Units",
                qtyRequested: 20,
                issuedQty: 20,
                poQty: 0,
                grnQty: 20,
                balance: 0,
                status: "COMPLETED"
            }
        ]
    },
    {
        id: 2,
        mrNumber: "MR-2025-205",
        mrId: 205,
        department: "Warehouse",
        requester: "David Martinez",
        requiredBy: "2025-02-19",
        overallStatus: "OPEN",
        lines: [
            {
                id: "line-2-1",
                itemId: "wh1",
                itemName: "Pallet Jacks",
                uom: "Units",
                qtyRequested: 2,
                issuedQty: 0,
                poQty: 0,
                grnQty: 0,
                balance: 2,
                status: "OPEN"
            },
            {
                id: "line-2-2",
                itemId: "wh2",
                itemName: "Safety Vests",
                uom: "Pieces",
                qtyRequested: 50,
                issuedQty: 0,
                poQty: 0,
                grnQty: 0,
                balance: 50,
                status: "OPEN"
            }
        ]
    },
    {
        id: 3,
        mrNumber: "MR-2025-207",
        mrId: 207,
        department: "Facilities",
        requester: "James Wilson",
        requiredBy: "2025-02-15",
        overallStatus: "COMPLETED",
        lines: [
            {
                id: "line-3-1",
                itemId: "fac1",
                itemName: "Office Chairs",
                uom: "Units",
                qtyRequested: 10,
                issuedQty: 0,
                poQty: 10,
                grnQty: 10,
                balance: 0,
                status: "COMPLETED"
            },
            {
                id: "line-3-2",
                itemId: "fac2",
                itemName: "Desk Lamps",
                uom: "Units",
                qtyRequested: 15,
                issuedQty: 15,
                poQty: 0,
                grnQty: 15,
                balance: 0,
                status: "COMPLETED"
            }
        ]
    }
];

// MR History
export const mrHistorySummaries: MRHistorySummary[] = [
    {
        id: 1,
        mrNumber: "MR-2025-207",
        mrId: 207,
        department: "Facilities",
        requester: "James Wilson",
        requestDate: "2025-02-05",
        requiredBy: "2025-02-15",
        priority: "Normal",
        totalLines: 2,
        fulfilledLines: 2,
        status: "FULFILLED",
        closedDate: "2025-02-12"
    },
    {
        id: 2,
        mrNumber: "MR-2025-191",
        mrId: 191,
        department: "Engineering",
        requester: "Tech Lead",
        requestDate: "2025-01-28",
        requiredBy: "2025-02-10",
        priority: "Normal",
        totalLines: 3,
        fulfilledLines: 2,
        status: "CLOSED",
        closedDate: "2025-02-11"
    },
    {
        id: 3,
        mrNumber: "MR-2025-185",
        mrId: 185,
        department: "IT Department",
        requester: "IT Manager",
        requestDate: "2025-01-25",
        requiredBy: "2025-02-05",
        priority: "Urgent",
        totalLines: 2,
        fulfilledLines: 0,
        status: "REJECTED",
        closedDate: "2025-01-27"
    },
    {
        id: 4,
        mrNumber: "MR-2025-178",
        mrId: 178,
        department: "Operations",
        requester: "Operations Manager",
        requestDate: "2025-01-20",
        requiredBy: "2025-02-01",
        priority: "Normal",
        totalLines: 1,
        fulfilledLines: 0,
        status: "CANCELLED",
        closedDate: "2025-01-22"
    }
];

export const mrHistoryDetails: MRHistoryDetail[] = [
    {
        id: 1,
        mrNumber: "MR-2025-207",
        mrId: 207,
        requestDate: "2025-02-05",
        department: "Facilities",
        requester: "James Wilson",
        requiredBy: "2025-02-15",
        priority: "Normal",
        status: "FULFILLED",
        closedDate: "2025-02-12",
        purpose: "Office furniture and lighting",
        lines: [
            {
                id: "line-1-1",
                itemId: "fac1",
                itemName: "Office Chairs",
                uom: "Units",
                qtyRequested: 10,
                issuedQty: 0,
                grnQty: 10,
                finalBalance: 0,
                lineStatus: "COMPLETED"
            },
            {
                id: "line-1-2",
                itemId: "fac2",
                itemName: "Desk Lamps",
                uom: "Units",
                qtyRequested: 15,
                issuedQty: 15,
                grnQty: 15,
                finalBalance: 0,
                lineStatus: "COMPLETED"
            }
        ],
        auditTrail: [
            { label: "MR Created", by: "James Wilson", date: "2025-02-05 08:00" },
            { label: "MR Submitted", by: "James Wilson", date: "2025-02-05 09:00" },
            { label: "Approved by Department Head", by: "Facilities Manager", date: "2025-02-05 14:00" },
            { label: "Fulfillment Planning Completed", by: "Procurement Team", date: "2025-02-06 10:00" },
            { label: "Issue Request Created", by: "Procurement Team", date: "2025-02-06 10:30" },
            { label: "PO Created", by: "Procurement Manager", date: "2025-02-06 11:00" },
            { label: "Stock Issued", by: "Storekeeper", date: "2025-02-06 15:00" },
            { label: "GRN Completed", by: "Stores Manager", date: "2025-02-10 16:00" },
            { label: "MR Fulfilled", by: "System", date: "2025-02-12 09:00" }
        ]
    },
    {
        id: 2,
        mrNumber: "MR-2025-191",
        mrId: 191,
        requestDate: "2025-01-28",
        department: "Engineering",
        requester: "Tech Lead",
        requiredBy: "2025-02-10",
        priority: "Normal",
        status: "CLOSED",
        closedDate: "2025-02-11",
        purpose: "Engineering tools and equipment",
        lines: [
            {
                id: "line-2-1",
                itemId: "tool1",
                itemName: "Precision Screwdriver Set",
                uom: "Set",
                qtyRequested: 5,
                issuedQty: 5,
                grnQty: 5,
                finalBalance: 0,
                lineStatus: "COMPLETED"
            },
            {
                id: "line-2-2",
                itemId: "tool2",
                itemName: "Digital Multimeter",
                uom: "Units",
                qtyRequested: 3,
                issuedQty: 0,
                grnQty: 2,
                finalBalance: 1,
                lineStatus: "NOT_COMPLETED"
            },
            {
                id: "line-2-3",
                itemId: "tool3",
                itemName: "Soldering Station",
                uom: "Units",
                qtyRequested: 2,
                issuedQty: 2,
                grnQty: 2,
                finalBalance: 0,
                lineStatus: "COMPLETED"
            }
        ],
        auditTrail: [
            { label: "MR Created", by: "Tech Lead", date: "2025-01-28 09:00" },
            { label: "MR Submitted", by: "Tech Lead", date: "2025-01-28 10:00" },
            { label: "Approved by Department Head", by: "Engineering Manager", date: "2025-01-29 11:00" },
            { label: "Fulfillment Planning Completed", by: "Procurement Manager", date: "2025-01-30 14:00" },
            { label: "Issue Request Created", by: "Procurement Manager", date: "2025-01-30 14:30" },
            { label: "Partial Stock Issued", by: "Storekeeper", date: "2025-02-01 10:00" },
            { label: "PO Created", by: "Procurement Manager", date: "2025-02-02 09:00" },
            { label: "Partial GRN", by: "Stores Manager", date: "2025-02-08 15:00" },
            { label: "MR Manually Closed", by: "Tech Lead", date: "2025-02-11 10:00" }
        ]
    },
    {
        id: 3,
        mrNumber: "MR-2025-185",
        mrId: 185,
        requestDate: "2025-01-25",
        department: "IT Department",
        requester: "IT Manager",
        requiredBy: "2025-02-05",
        priority: "Urgent",
        status: "REJECTED",
        closedDate: "2025-01-27",
        purpose: "Network infrastructure upgrade",
        lines: [
            {
                id: "line-3-1",
                itemId: "net1",
                itemName: "Network Switches",
                uom: "Units",
                qtyRequested: 10,
                issuedQty: 0,
                grnQty: 0,
                finalBalance: 10,
                lineStatus: "NOT_COMPLETED"
            },
            {
                id: "line-3-2",
                itemId: "net2",
                itemName: "Cat6 Ethernet Cables",
                uom: "Meters",
                qtyRequested: 500,
                issuedQty: 0,
                grnQty: 0,
                finalBalance: 500,
                lineStatus: "NOT_COMPLETED"
            }
        ],
        auditTrail: [
            { label: "MR Created", by: "IT Manager", date: "2025-01-25 08:00" },
            { label: "MR Submitted", by: "IT Manager", date: "2025-01-25 09:00" },
            { label: "Rejected by Department Head", by: "IT Director", date: "2025-01-27 10:00" }
        ]
    },
    {
        id: 4,
        mrNumber: "MR-2025-178",
        mrId: 178,
        requestDate: "2025-01-20",
        department: "Operations",
        requester: "Operations Manager",
        requiredBy: "2025-02-01",
        priority: "Normal",
        status: "CANCELLED",
        closedDate: "2025-01-22",
        purpose: "Equipment maintenance - no longer needed",
        lines: [
            {
                id: "line-4-1",
                itemId: "ops1",
                itemName: "Industrial Fans",
                uom: "Units",
                qtyRequested: 5,
                issuedQty: 0,
                grnQty: 0,
                finalBalance: 5,
                lineStatus: "NOT_COMPLETED"
            }
        ],
        auditTrail: [
            { label: "MR Created", by: "Operations Manager", date: "2025-01-20 10:00" },
            { label: "MR Cancelled", by: "Operations Manager", date: "2025-01-22 09:00" }
        ]
    }
];
