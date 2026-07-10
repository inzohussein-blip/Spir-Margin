// Domain types mirroring the Supabase schema (see supabase/migrations).
// For a fully generated version run `npm run types` against a live project.

export type CompanyRole = "parent" | "supplier" | "customer";
export type ProductType = "device" | "spare_part" | "kit";
export type LabStatus = "active" | "inactive";
export type DeviceStatus =
  | "in_stock"
  | "installed"
  | "in_maintenance"
  | "out_of_order"
  | "retired";
export type MovementType = "withdrawal" | "return" | "transfer_in";

export interface Lab {
  id: string;
  code: string;
  name: string;
  status: LabStatus;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  contact_name: string | null;
  phone: string | null;
  last_activity_at: string | null;
}

export interface ProfitSummary {
  total_profit: number;
  total_revenue: number;
  total_cost: number;
  sales_count: number;
}

export interface MaintenanceAlert {
  id: string;
  asset_code: string;
  serial_no: string | null;
  product_name: string;
  lab_name: string | null;
  status: DeviceStatus;
  next_maintenance_date: string | null;
  days_until_due: number | null;
}

export interface ExpiringKit {
  id: string;
  batch_no: string;
  product_name: string;
  warehouse_name: string | null;
  expiry_date: string;
  qty_available: number;
  days_until_expiry: number;
}

export interface ActiveLab extends Lab {
  device_count: number;
  total_withdrawn: number;
}
