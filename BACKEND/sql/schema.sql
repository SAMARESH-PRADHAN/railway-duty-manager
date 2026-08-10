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



-- ========================================
-- BATCHES (Roster Duty Set)
-- ========================================
CREATE TABLE IF NOT EXISTS batches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,       -- e.g. 'A BATCH', 'VANDE BHARAT'
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batches_is_deleted ON batches (is_deleted);

-- ========================================
-- BATCH ROSTER DAYS
-- One row per (batch, day_number 1..14). Holds the default rostered
-- timings for that day of the 14-day cycle, applied to any employee
-- in this batch when a new duty sheet is generated.
-- slots stored as JSONB: [{ "from": "08:00", "to": "16:00" }, ...]
-- ========================================
CREATE TABLE IF NOT EXISTS batch_roster_days (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  day_number   INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 14),
  is_rest_day  BOOLEAN NOT NULL DEFAULT FALSE,
  slots        JSONB NOT NULL DEFAULT '[]',
  UNIQUE (batch_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_batch_roster_days_batch_id ON batch_roster_days (batch_id);




-- ========================================
-- DESIGNATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS designations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- GROUP TYPES
-- ========================================
CREATE TABLE IF NOT EXISTS group_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_designations_updated_at ON designations;
CREATE TRIGGER trg_designations_updated_at
  BEFORE UPDATE ON designations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_group_types_updated_at ON group_types;
CREATE TRIGGER trg_group_types_updated_at
  BEFORE UPDATE ON group_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- seed the existing hardcoded values so nothing breaks on first run
-- INSERT INTO designations (name) VALUES
--   ('Asst'),('Tech-I'),('Tech-II'),('Tech-III'),('Sr.Tech'),('Helper')
-- ON CONFLICT (name) DO NOTHING;

-- INSERT INTO group_types (name) VALUES
--   ('A'),('B'),('C'),('D'),('E'),('F')
-- ON CONFLICT (name) DO NOTHING;

-- Link employees to a batch (nullable = falls back to designation-based default)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS roster_configured BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_pf_number_unique ON employees (pf_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_token_no_unique ON employees (token_no);
ALTER TABLE trains DROP COLUMN IF EXISTS category;
CREATE UNIQUE INDEX IF NOT EXISTS idx_designations_name_lower
  ON designations (LOWER(name)) WHERE is_deleted = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_types_name_lower
  ON group_types (LOWER(name)) WHERE is_deleted = FALSE;

UPDATE employees
SET designation = (designation::json ->> 'name')
WHERE designation LIKE '{%';
UPDATE employees
SET group_type = (group_type::json ->> 'name')
WHERE group_type LIKE '{%';

DROP TRIGGER IF EXISTS trg_batches_updated_at ON batches;
CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();