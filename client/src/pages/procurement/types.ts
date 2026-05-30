export interface Vendor {
    id: number;
    name: string;
    email: string;
    phone: string;
    city: string;
    paymentTerms: string;
    status: "Active" | "Inactive";
}

export interface PurchaseOrder {
    id: number;
    poNumber: string;
    vendorId: number;
    date: string;
    dueDate: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
    status: "Pending" | "Confirmed" | "Delivered" | "Paid";
    notes: string;
}

// --- Material Requisition (MR) Types ---

export type MRStatus = 'Draft' | 'Submitted' | 'Approved' | 'Processing' | 'Partially Fulfilled' | 'Fulfilled' | 'Closed' | 'Cancelled' | 'Rejected';
export type MRPriority = 'Normal' | 'Urgent';
export type Department = 'Production' | 'Maintenance' | 'Stores' | 'Admin' | 'Quality' | 'Operations' | 'Facilities' | 'Engineering' | 'IT Department' | 'Warehouse' | 'R&D Lab' | 'Manufacturing';
export type SuggestedAction = 'Issue from Stock' | 'Purchase Required';

export type MRRole = 'Requester' | 'Department Head' | 'Procurement' | 'Stores' | 'Admin';
export type MRQueueType = 'My Requests' | 'For Approval' | 'MR Review & Fulfillment' | 'To Procure' | 'Issue Requests' | 'Fulfillment Tracker' | 'MR History';

export interface MRItem {
    id: string;
    itemId: string;
    itemName: string;
    description?: string;
    uom: string;
    quantity: number;
    availableStock: number;
    estimatedCost?: number;
    suggestedAction: SuggestedAction;
    preferredSupplier?: string;
    remarks?: string;

    // Fulfillment Fields
    issuedQty?: number;
    orderedQty?: number;
    pendingQty?: number; // Computed: quantity - (issuedQty + orderedQty)
    lineStatus?: 'Pending' | 'Issued' | 'Ordered' | 'Fulfilled' | 'Partial' | 'Completed';
}

export interface MaterialRequisition {
    id: number;
    mrNumber: string;
    mrDate: string;
    requestingDepartment: Department;
    priority: MRPriority;
    requiredByDate: string;
    costCenter?: string;
    purpose?: string;
    status: MRStatus;

    requesterName: string;
    assignedTo?: string; // "Procurement Team" or "Stores Team"

    items: MRItem[];

    // Timestamps
    createdAt?: string;
    submittedAt?: string;
    approvedAt?: string;

    // Linked Documents (Mock)
    linkedPO?: string;
    linkedVendorName?: string;
    linkedStockIssueNo?: string;

    // Workflow Fields
    rejectReason?: string;
    returnReason?: string; // ADDED: Reason for returning MR
    approvalRemarks?: string; // ADDED: Remarks from approver
    lastUpdated?: string; // ADDED: Last update timestamp for approval tracking
    procurementStatus?: "Not Started" | "Processing" | "Waiting Vendor" | "PO Created" | "In Progress" | "Completed";
    assignedBuyer?: string;
    internalNotes?: string;
    
    // ADDED: Fulfillment Planning Data
    fulfillmentPlan?: {
        linePlans: Record<string, {
            itemId: string;
            qtyToIssue: number;
            qtyToProcure: number;
            planningNotes: string;
            stockAvailable: number;
            qtyAlreadyFulfilled: number;
            qtyRemaining: number;
        }>;
        status: 'PENDING' | 'PLANNED' | 'ISSUE_CREATED' | 'PROCURE_CREATED' | 'ISSUE_AND_PROCURE_CREATED';
        lastUpdated?: string;
    };
}

// --- To Procure Types ---

export type ToProcureStatus = 'Pending' | 'RFQ Created' | 'RFQ Sent' | 'PO Created' | 'Completed';
export type ToProcureLineStatus = 'Pending' | 'RFQ Requested' | 'PO Requested' | 'Completed';
export type ToProcureMode = 'RFQ' | 'PO';

// Line item within a To Procure MR
export interface ToProcureLine {
    id: string;
    itemId: string;
    itemName: string;
    uom: string;
    qtyToProcure: number;
    deadline: string; // Line-specific deadline or fallback to MR required by
    vendorId?: number; // Selected vendor
    mode?: ToProcureMode; // RFQ or PO
    lineStatus: ToProcureLineStatus;
    notes?: string;
}

// MR-grouped To Procure requirement
export interface ToProcureRequirement {
    id: number;
    mrNumber: string;
    mrId: number;
    department: Department;
    requester: string;
    requiredBy: string;
    priority: MRPriority;
    status: ToProcureStatus;
    notes?: string;
    totalProcureLines: number; // Count of lines
    lines: ToProcureLine[];
}

// --- Issue Request Types ---
// Issue Requests are generated from MR fulfillment planning for items to be issued from stock

export type IssueRequestStatus = 'Pending' | 'Partially Issued' | 'Issued Complete' | 'Cancelled';

export interface IssueRequestLine {
    id: string;
    itemId: string;
    itemName: string;
    uom: string;
    qtyToIssue: number;
    issuedQty: number; // Total issued so far
    balance: number; // Computed: qtyToIssue - issuedQty
    warehouseBin?: string;
    remarks?: string;
    issueDate?: string;
    // Temporary field for current issue transaction (Storekeeper input)
    issuedQtyThisTime?: number;
}

export interface IssueRequest {
    id: number;
    issueReqNo: string;
    mrNumber: string;
    mrId: number;
    department: Department;
    requester: string;
    requiredBy: string;
    status: IssueRequestStatus;
    createdBy: string; // Procurement user who generated this
    createdDate: string;
    lines: IssueRequestLine[];
    totalLines: number; // Computed: lines.length
    qtyPending: number; // Computed: sum of all line balances
}

// --- Fulfillment Tracker Types ---
// Fulfillment Tracker provides end-to-end visibility for MR fulfillment
// Shows combined view of Issue Requests, Purchase Orders, and GRN (Goods Receipt Notes)

export type TrackerOverallStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
export type TrackerLineStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';

export interface TrackerLine {
    id: string;
    itemId: string;
    itemName: string;
    uom: string;
    qtyRequested: number;
    issuedQty: number; // From Issue Requests
    poQty: number; // From Purchase Orders
    grnQty: number; // From Goods Receipt Notes (inventory receipts)
    balance: number; // Computed: qtyRequested - (issuedQty + grnQty)
    status: TrackerLineStatus; // Computed based on balance
}

export interface FulfillmentTrackerSummary {
    id: number;
    mrNumber: string;
    mrId: number;
    department: Department;
    requester: string;
    requiredBy: string;
    totalLines: number;
    issuedLines: number; // Count of lines with issuedQty > 0
    procuredLines: number; // Count of lines with poQty > 0
    pendingLines: number; // Count of lines with balance > 0
    overallStatus: TrackerOverallStatus;
}

export interface FulfillmentTrackerDetail {
    id: number;
    mrNumber: string;
    mrId: number;
    department: Department;
    requester: string;
    requiredBy: string;
    overallStatus: TrackerOverallStatus;
    lines: TrackerLine[];
}

// --- MR History Types ---
// MR History: Archive + audit view of completed/terminated MRs
// Read-only. No edits, no create, view-only.

export type MRHistoryStatus = 'FULFILLED' | 'CLOSED' | 'REJECTED' | 'CANCELLED';
export type MRHistoryLineStatus = 'COMPLETED' | 'NOT_COMPLETED' | 'Completed';

export interface MRAuditEvent {
    label: string;
    by?: string;
    date: string;
}

export interface MRHistoryLine {
    id: string;
    itemId: string;
    itemName: string;
    uom: string;
    qtyRequested: number;
    issuedQty: number;
    grnQty: number;
    finalBalance: number; // Computed: qtyRequested - (issuedQty + grnQty)
    lineStatus: MRHistoryLineStatus;
}

export interface MRHistorySummary {
    id: number;
    mrNumber: string;
    mrId: number;
    department: Department;
    requester: string;
    requestDate: string;
    requiredBy: string;
    priority: MRPriority;
    totalLines: number;
    fulfilledLines: number; // Count of lines with finalBalance = 0
    status: MRHistoryStatus;
    closedDate: string;
}

export interface MRHistoryDetail {
    id: number;
    mrNumber: string;
    mrId: number;
    requestDate: string;
    department: Department;
    requester: string;
    requiredBy: string;
    priority: MRPriority;
    status: MRHistoryStatus;
    closedDate: string;
    purpose?: string;
    lines: MRHistoryLine[];
    auditTrail: MRAuditEvent[];
}
