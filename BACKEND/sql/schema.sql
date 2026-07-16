-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- EMPLOYEES
-- ========================================
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sl_no           INTEGER NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  pf_number       TEXT NOT NULL,
  token_no        TEXT NOT NULL,
  designation     TEXT NOT NULL,
  present_batch   TEXT NOT NULL,
  group_type      TEXT NOT NULL,           -- 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  address         TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  date_of_birth   TEXT,
  date_of_joining TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive'
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_is_deleted ON employees (is_deleted);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);

-- ========================================
-- TRAINS
-- ========================================
CREATE TABLE IF NOT EXISTS trains (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_number     TEXT NOT NULL,
  train_name       TEXT NOT NULL,
  category         TEXT NOT NULL,           -- 'Vande Bharat' | 'Rajdhani' | 'Shatabdi' | ...
  paired_train_id  UUID REFERENCES trains(id),
  status           TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive'
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trains_is_deleted ON trains (is_deleted);
CREATE INDEX IF NOT EXISTS idx_trains_status ON trains (status);

-- ========================================
-- DUTY SHEETS
-- days is stored as JSONB: array of 14 DutyDay objects
-- (date, dayName, isRestDay, actualIsRest, rosteredSlots[], rosteredHours,
--  actualSlots[], actualHours, extraHours, description, leave)
-- ========================================
CREATE TABLE IF NOT EXISTS duty_sheets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  train_ids             UUID[] NOT NULL DEFAULT '{}',
  manual_train_note     TEXT,
  period_start_date     TEXT NOT NULL,      -- 'yyyy-MM-dd'
  period_end_date       TEXT NOT NULL,      -- 'yyyy-MM-dd'
  days                  JSONB NOT NULL,
  total_actual_hours    NUMERIC(6,2) NOT NULL,
  total_rostered_hours  NUMERIC(6,2) NOT NULL,
  statutory_hours       NUMERIC(6,2) NOT NULL DEFAULT 104,
  deduction_type        TEXT,
  deduction_hours       NUMERIC(6,2) NOT NULL DEFAULT 0,
  ot_payable            NUMERIC(6,2) NOT NULL,
  is_draft              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duty_sheets_employee_id ON duty_sheets (employee_id);
CREATE INDEX IF NOT EXISTS idx_duty_sheets_is_draft ON duty_sheets (is_draft);
CREATE INDEX IF NOT EXISTS idx_duty_sheets_period ON duty_sheets (period_start_date, period_end_date);

-- ========================================
-- Auto-update updated_at on every UPDATE
-- ========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trains_updated_at ON trains;
CREATE TRIGGER trg_trains_updated_at
  BEFORE UPDATE ON trains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_duty_sheets_updated_at ON duty_sheets;
CREATE TRIGGER trg_duty_sheets_updated_at
  BEFORE UPDATE ON duty_sheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
