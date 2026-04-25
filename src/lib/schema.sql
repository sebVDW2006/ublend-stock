-- uBlend stock take database schema
-- All quantities are integers in the flavour's chosen unit (bottles, units, etc.)
-- All dates are stored as ISO 8601 text (YYYY-MM-DD or full datetime).

PRAGMA foreign_keys = ON;

-- ============================================================================
-- branches: client sites where uBlend products are delivered
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  address         TEXT,
  contact_name    TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- flavours: products uBlend produces
-- ============================================================================
CREATE TABLE IF NOT EXISTS flavours (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL UNIQUE,
  sku                   TEXT,
  unit                  TEXT    NOT NULL DEFAULT 'units', -- bottles, litres, etc.
  low_stock_threshold   INTEGER NOT NULL DEFAULT 10,      -- per-branch trigger for low-stock flag
  active                INTEGER NOT NULL DEFAULT 1,
  notes                 TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- production_batches: each batch produced in the factory
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  flavour_id    INTEGER NOT NULL REFERENCES flavours(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  produced_at   TEXT    NOT NULL,                         -- ISO date
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- deliveries: a drop to a branch (header). One delivery may include many flavours.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  delivered_at  TEXT    NOT NULL,                         -- ISO date
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id   INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  flavour_id    INTEGER NOT NULL REFERENCES flavours(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0)
);

-- ============================================================================
-- stock_checks: an on-site count of what is actually left at a branch
-- "sell-through" between two checks is computed as:
--   delivered between checks - (current remaining - previous remaining)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_checks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  checked_at    TEXT    NOT NULL,                         -- ISO date
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_check_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_check_id      INTEGER NOT NULL REFERENCES stock_checks(id) ON DELETE CASCADE,
  flavour_id          INTEGER NOT NULL REFERENCES flavours(id),
  quantity_remaining  INTEGER NOT NULL CHECK (quantity_remaining >= 0)
);

-- ============================================================================
-- fuel_fill_ups: petrol fill-up log for the vehicle
-- Receipt images are stored as data URLs so the feature works without
-- introducing a separate object storage dependency.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_fill_ups (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  filled_at               TEXT    NOT NULL,
  total_cost_pence        INTEGER NOT NULL CHECK (total_cost_pence >= 0),
  notes                   TEXT,
  receipt_image_data_url  TEXT,
  receipt_image_name      TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery     ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_flavour      ON delivery_items(flavour_id);
CREATE INDEX IF NOT EXISTS idx_stock_check_items_check     ON stock_check_items(stock_check_id);
CREATE INDEX IF NOT EXISTS idx_stock_check_items_flavour   ON stock_check_items(flavour_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_date      ON deliveries(branch_id, delivered_at);
CREATE INDEX IF NOT EXISTS idx_stock_checks_branch_date    ON stock_checks(branch_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_production_flavour_date     ON production_batches(flavour_id, produced_at);
CREATE INDEX IF NOT EXISTS idx_fuel_fill_ups_date          ON fuel_fill_ups(filled_at);
