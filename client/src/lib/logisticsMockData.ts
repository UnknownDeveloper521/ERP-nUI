
import { addDays, subDays, subHours } from "date-fns";

export type VehicleType = "truck" | "tanker" | "tractor";
export type DocumentType = "cane" | "sugar" | "molasses" | "bagasse" | "press_mud" | "raw_material" | "fuel" | "chemicals" | "other";
export type MovementType = "inward" | "outward";
export type TripStatus = "gate_in" | "weigh_in_1" | "yard" | "weigh_in_2" | "gate_out" | "cancelled";

export interface Vehicle {
  id: string;
  vehicle_no: string;
  vehicle_type: VehicleType;
  capacity_mt: number;
  transporter_id: string;
  owner_name: string;
  is_active: boolean;
}

export interface Transporter {
  id: string;
  name: string;
  gst_no?: string;
  contact_person: string;
  phone: string;
  address: string;
  is_active: boolean;
}

export interface WeighbridgeTrip {
  id: string;
  trip_no: string;
  vehicle_id: string;
  transporter_id: string;
  movement_type: MovementType;
  document_type: DocumentType;
  linked_document_ref: string;
  status: TripStatus;
  gross_weight?: number;
  tare_weight?: number;
  net_weight?: number;
  weigh_in_time?: string;
  weigh_out_time?: string;
  gate_in_time: string;
  gate_out_time?: string;
  remarks?: string;
}

// Mock Data
export const mockTransporters: Transporter[] = [
  {
    id: "t1",
    name: "RK Logistics Pvt Ltd",
    gst_no: "24AAACR1234A1Z5",
    contact_person: "Rajesh Kumar",
    phone: "9876543210",
    address: "Plot 12, GIDC, Ahmedabad",
    is_active: true,
  },
  {
    id: "t2",
    name: "Speedy Transports",
    gst_no: "24BBBCR5678B1Z9",
    contact_person: "Suresh Patel",
    phone: "9988776655",
    address: "Sector 4, Gandhinagar",
    is_active: true,
  },
  {
    id: "t3",
    name: "Global Carriers",
    gst_no: "24CCCRC9012C1Z3",
    contact_person: "Amit Shah",
    phone: "9123456780",
    address: "Ring Road, Surat",
    is_active: true,
  },
];

export const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    vehicle_no: "GJ-01-AB-1234",
    vehicle_type: "truck",
    capacity_mt: 20,
    transporter_id: "t1",
    owner_name: "Rajesh Kumar",
    is_active: true,
  },
  {
    id: "v2",
    vehicle_no: "GJ-18-XY-9876",
    vehicle_type: "tanker",
    capacity_mt: 15,
    transporter_id: "t2",
    owner_name: "Suresh Patel",
    is_active: true,
  },
  {
    id: "v3",
    vehicle_no: "GJ-05-CD-4567",
    vehicle_type: "tractor",
    capacity_mt: 10,
    transporter_id: "t3",
    owner_name: "Amit Shah",
    is_active: true,
  },
  {
    id: "v4",
    vehicle_no: "MH-12-EF-4321",
    vehicle_type: "truck",
    capacity_mt: 25,
    transporter_id: "t1",
    owner_name: "Rajesh Kumar",
    is_active: true,
  },
];

export const mockTrips: WeighbridgeTrip[] = [
  {
    id: "trip-001",
    trip_no: "TRIP-2025-001",
    vehicle_id: "v1",
    transporter_id: "t1",
    movement_type: "inward",
    document_type: "cane",
    linked_document_ref: "CT-1001",
    status: "gate_in",
    gate_in_time: new Date().toISOString(),
  },
  {
    id: "trip-002",
    trip_no: "TRIP-2025-002",
    vehicle_id: "v2",
    transporter_id: "t2",
    movement_type: "outward",
    document_type: "molasses",
    linked_document_ref: "SO-5002",
    status: "weigh_in_1",
    gate_in_time: subHours(new Date(), 2).toISOString(),
    weigh_in_time: subHours(new Date(), 1).toISOString(),
    tare_weight: 8.5, // First weighment for outward is tare (empty)
  },
  {
    id: "trip-003",
    trip_no: "TRIP-2025-003",
    vehicle_id: "v3",
    transporter_id: "t3",
    movement_type: "inward",
    document_type: "raw_material",
    linked_document_ref: "PO-9001",
    status: "weigh_in_2",
    gate_in_time: subHours(new Date(), 4).toISOString(),
    weigh_in_time: subHours(new Date(), 3).toISOString(),
    gross_weight: 12.5, // First weighment for inward is gross (loaded)
    weigh_out_time: subHours(new Date(), 1).toISOString(),
    tare_weight: 4.5, // Second weighment
    net_weight: 8.0,
  },
  {
    id: "trip-004",
    trip_no: "TRIP-2025-004",
    vehicle_id: "v4",
    transporter_id: "t1",
    movement_type: "outward",
    document_type: "sugar",
    linked_document_ref: "SO-5005",
    status: "gate_out",
    gate_in_time: subDays(new Date(), 1).toISOString(),
    weigh_in_time: subDays(new Date(), 1).toISOString(),
    tare_weight: 9.0,
    weigh_out_time: subDays(new Date(), 1).toISOString(),
    gross_weight: 29.0,
    net_weight: 20.0,
    gate_out_time: subDays(new Date(), 1).toISOString(),
  }
];

// Helper to simulate API calls
export const getTrips = () => Promise.resolve(mockTrips);
export const getTrip = (id: string) => Promise.resolve(mockTrips.find(t => t.id === id));
export const getVehicles = () => Promise.resolve(mockVehicles);
export const getTransporters = () => Promise.resolve(mockTransporters);
