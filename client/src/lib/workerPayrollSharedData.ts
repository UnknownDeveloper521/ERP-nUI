export type WorkerWageStatus = "Draft Wages" | "Submitted Wages" | "Paid Wages";

export interface WorkerWage {
    id: string;
    wagePeriod: string;
    registerDate: string;
    location: string;
    department: string;
    workcenter: string;
    operation: string;
    workerCategory: string;
    noOfWorkers: number;
    netWageAmount: number;
    totalWageAmount: number;
    status: WorkerWageStatus;
}

export interface WorkersWagePeriod {
    id: string;
    periodName: string; // e.g. "Feb-2026 (W1)"
    month: number; // 0-11
    year: number;
    startDate: string;
    endDate: string;
    status: "Open" | "Locked" | "Processed" | "Paid";
    notes?: string;
}

// Initial Mock Data
export const mockWorkerWages: WorkerWage[] = [
    {
        id: "ww-001",
        wagePeriod: "Jan-2026 (01-07)",
        registerDate: "2026-01-08",
        location: "Plant A",
        department: "Production",
        workcenter: "WC-01",
        operation: "Assembly",
        workerCategory: "Packaging",
        noOfWorkers: 15,
        netWageAmount: 500,
        totalWageAmount: 7500,
        status: "Submitted Wages"
    },
    {
        id: "ww-002",
        wagePeriod: "Jan-2026 (08-14)",
        registerDate: "2026-01-15",
        location: "Plant B",
        department: "Logistics",
        workcenter: "WC-02",
        operation: "Loading",
        workerCategory: "Helper",
        noOfWorkers: 10,
        netWageAmount: 450,
        totalWageAmount: 4500,
        status: "Draft Wages"
    }
];

export const mockWagePeriods: WorkersWagePeriod[] = [
    {
        id: "wwp-001",
        periodName: "Jan-2026 (01-07)",
        month: 0,
        year: 2026,
        startDate: "2026-01-01",
        endDate: "2026-01-07",
        status: "Open",
        notes: "First weekly wage period for workers"
    },
    {
        id: "wwp-002",
        periodName: "Jan-2026 (08-14)",
        month: 0,
        year: 2026,
        startDate: "2026-01-08",
        endDate: "2026-01-14",
        status: "Open"
    }
];

// Helper Functions
export const addWorkerWage = (wage: WorkerWage): WorkerWage[] => {
    mockWorkerWages.unshift(wage);
    return [...mockWorkerWages];
};

export const updateWorkerWage = (id: string, updates: Partial<WorkerWage>): WorkerWage[] => {
    const index = mockWorkerWages.findIndex(w => w.id === id);
    if (index !== -1) {
        mockWorkerWages[index] = { ...mockWorkerWages[index], ...updates };
    }
    return [...mockWorkerWages];
};

export const deleteWorkerWage = (id: string): WorkerWage[] => {
    const index = mockWorkerWages.findIndex(w => w.id === id);
    if (index !== -1) {
        mockWorkerWages.splice(index, 1);
    }
    return [...mockWorkerWages];
};
