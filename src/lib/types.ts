// Domain types — mirror the schema in src/lib/schema.sql

export type Branch = {
  id: number;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  active: 0 | 1;
  created_at: string;
};

export type Flavour = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  low_stock_threshold: number;
  active: 0 | 1;
  notes: string | null;
  created_at: string;
};

export type ProductionBatch = {
  id: number;
  flavour_id: number;
  quantity: number;
  produced_at: string;
  notes: string | null;
  created_at: string;
};

export type Delivery = {
  id: number;
  branch_id: number;
  delivered_at: string;
  notes: string | null;
  created_at: string;
};

export type DeliveryItem = {
  id: number;
  delivery_id: number;
  flavour_id: number;
  quantity: number;
};

export type StockCheck = {
  id: number;
  branch_id: number;
  checked_at: string;
  notes: string | null;
  created_at: string;
};

export type StockCheckItem = {
  id: number;
  stock_check_id: number;
  flavour_id: number;
  quantity_remaining: number;
};

// Derived view types used by the dashboard / reports

export type BranchStockRow = {
  branch_id: number;
  branch_name: string;
  flavour_id: number;
  flavour_name: string;
  unit: string;
  delivered_total: number;     // total ever delivered to this branch
  last_check_remaining: number | null;
  last_checked_at: string | null;
  estimated_remaining: number; // best guess at what's still on site
  is_low: boolean;             // estimated_remaining <= low_stock_threshold
};

export type FlavourSellThroughRow = {
  flavour_id: number;
  flavour_name: string;
  period: string;              // YYYY-MM
  delivered: number;
  sold: number;                // sell-through implied by stock checks
};
