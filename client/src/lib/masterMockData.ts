
export interface Location {
    id: string;
    name: string;
}

export interface Operation {
    id: string;
    name: string;
}

export interface WorkCenter {
    id: string;
    name: string;
}

export interface Department {
    id: string;
    name: string;
}

export interface Bin {
    id: string;
    name: string;
    category?: string;
}

export interface Warehouse {
    id: string;
    name: string;
    bins: Bin[];
}

export interface Material {
    id: string;
    name: string;
    type: 'RM' | 'SFG' | 'FG' | 'Consumables';
}

export interface Transporter {
    id: string;
    name: string;
}

// Mock Data Constants

export const mockLocations: Location[] = [
    { id: "loc-1", name: "Jinja" },
    { id: "loc-2", name: "Kampala" },
];

export const mockOperations: Operation[] = [
    { id: "op-1", name: "Lead Generation & Purification" },
    { id: "op-2", name: "Case Creation" },
    { id: "op-3", name: "Grid Creation & Oxidization" },
    { id: "op-4", name: "Assembly line & Packaging" },
];

export const mockWorkCenters: WorkCenter[] = [
    { id: "wc-1", name: "Lead Furnace Center" },
    { id: "wc-2", name: "Plastic Casing Center" },
    { id: "wc-3", name: "Grid Generation Center" },
    { id: "wc-4", name: "Assembly Line" },
    { id: "wc-5", name: "Service Center" },
];

export const mockDepartments: Department[] = [
    { id: "dept-1", name: "Service Center" },
    { id: "dept-2", name: "Warranty Service" },
    { id: "dept-3", name: "Technical Support" },
    { id: "dept-4", name: "Customer Service" },
    { id: "dept-5", name: "Quality Assurance" },
    { id: "dept-6", name: "Production" },
    { id: "dept-7", name: "Inventory" },
];

export const mockWarehouses: Warehouse[] = [
    {
        id: "wh-1",
        name: "Jinja WH",
        bins: [
            { id: "bin-1", name: "Bin1", category: "Scrap Battery" },
            { id: "bin-2", name: "Bin2", category: "Purified Lead" },
            { id: "bin-3", name: "Bin3", category: "Grid" },
            { id: "bin-4", name: "Bin4", category: "Terminals" },
            { id: "bin-5", name: "Bin5", category: "Connectors" },
        ],
    },
];

export const mockRawMaterials: Material[] = [
    { id: "rm-1", name: "Scrap Battery", type: "RM" },
    { id: "rm-2", name: "Plastic Pallets", type: "RM" },
    { id: "rm-3", name: "Acid Type A", type: "RM" },
    { id: "rm-4", name: "Acid Type B", type: "RM" },
    { id: "rm-5", name: "Acid Type C", type: "RM" },
];

export const mockSemiFinishedGoods: Material[] = [
    { id: "sfg-1", name: "Purified Lead", type: "SFG" },
    { id: "sfg-2", name: "Battery Cases", type: "SFG" },
    { id: "sfg-3", name: "Battery Lids", type: "SFG" },
    { id: "sfg-4", name: "Separators", type: "SFG" },
    { id: "sfg-5", name: "Terminals", type: "SFG" },
    { id: "sfg-6", name: "Connectors", type: "SFG" },
];

export const mockFinishedGoods: Material[] = [
    { id: "fg-1", name: "GSV 7", type: "FG" },
    { id: "fg-2", name: "GSV 8", type: "FG" },
    { id: "fg-3", name: "GSMX 2.5", type: "FG" },
    { id: "fg-4", name: "GSMx 6.5", type: "FG" },
    { id: "fg-5", name: "SMF 20", type: "FG" },
    { id: "fg-6", name: "SMF 40", type: "FG" },
    { id: "fg-7", name: "MF N 40", type: "FG" },
    { id: "fg-8", name: "MF NS 60", type: "FG" },
];

export const mockConsumables: Material[] = [
    { id: "con-1", name: "Safety Gloves", type: "Consumables" },
    { id: "con-2", name: "Mask (N95)", type: "Consumables" },
    { id: "con-3", name: "Cutting Oil", type: "Consumables" },
    { id: "con-4", name: "Cleaning Solvent", type: "Consumables" },
    { id: "con-5", name: "Packaging Tape", type: "Consumables" },
];

export const allMockMaterials = [...mockRawMaterials, ...mockSemiFinishedGoods, ...mockFinishedGoods, ...mockConsumables];

export const mockTransporters: Transporter[] = [
    { id: "trans-1", name: "Swift Logistics" },
    { id: "trans-2", name: "Express Cargo" },
    { id: "trans-3", name: "Global Freight" },
    { id: "trans-4", name: "Metro Transport" },
    { id: "trans-5", name: "Prime Movers" },
];

export interface Customer {
    id: string;
    name: string;
    contactPerson: string;
    mobileNo: string;
    billingAddress: string;
    shippingAddress: string;
}

export const mockCustomers: Customer[] = [
    {
        id: "cust-1",
        name: "Acme Corp",
        contactPerson: "John Doe",
        mobileNo: "9876543210",
        billingAddress: "123 Business St, New York, NY 10001",
        shippingAddress: "123 Business St, New York, NY 10001"
    },
    {
        id: "cust-2",
        name: "TechStart Inc",
        contactPerson: "Jane Smith",
        mobileNo: "9876543211",
        billingAddress: "456 Tech Ave, San Francisco, CA 94102",
        shippingAddress: "456 Tech Ave, San Francisco, CA 94102"
    },
    {
        id: "cust-3",
        name: "Global Industries",
        contactPerson: "Bob Johnson",
        mobileNo: "9876543212",
        billingAddress: "789 Industry Blvd, Chicago, IL 60601",
        shippingAddress: "789 Industry Blvd, Chicago, IL 60601"
    },
    {
        id: "cust-4",
        name: "Innovate Ltd",
        contactPerson: "Alice Brown",
        mobileNo: "9876543213",
        billingAddress: "321 Innovation Dr, Austin, TX 78701",
        shippingAddress: "321 Innovation Dr, Austin, TX 78701"
    },
    {
        id: "cust-5",
        name: "Prime Solutions",
        contactPerson: "Charlie Wilson",
        mobileNo: "9876543214",
        billingAddress: "654 Prime St, Seattle, WA 98101",
        shippingAddress: "654 Prime St, Seattle, WA 98101"
    }
];

export interface BaseMasterItem {
    id: number;
    name: string;
    code?: string;
    description?: string;
    status: "Active" | "Inactive";
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
    country?: string;
    state?: string;
    city_name?: string;
}

export const mockCountries: BaseMasterItem[] = [
    { id: 1, name: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 3, name: "United Kingdom", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 4, name: "Canada", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 5, name: "Australia", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

export const mockStates: BaseMasterItem[] = [
    { id: 1, name: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Gujarat", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 3, name: "California", country: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 4, name: "Texas", country: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 5, name: "London", country: "United Kingdom", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

export const mockCities: BaseMasterItem[] = [
    { id: 1, name: "Mumbai", state: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Pune", state: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 3, name: "Ahmedabad", state: "Gujarat", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 4, name: "Los Angeles", state: "California", country: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 5, name: "Houston", state: "Texas", country: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];
