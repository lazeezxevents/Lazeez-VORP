-- Finance Modeling Workspace Schema
-- Supports Excel-like spreadsheet functionality for financial modeling

-- Workbooks table
CREATE TABLE IF NOT EXISTS finance_workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shared_with UUID[] DEFAULT '{}',
  is_template BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}'
);

-- Sheets table
CREATE TABLE IF NOT EXISTS finance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES finance_workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 100,
  col_count INTEGER NOT NULL DEFAULT 26,
  frozen_rows INTEGER DEFAULT 0,
  frozen_cols INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workbook_id, name)
);

-- Cells table (stores only non-empty cells for efficiency)
CREATE TABLE IF NOT EXISTS finance_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES finance_sheets(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  value TEXT,
  formula TEXT,
  format TEXT NOT NULL DEFAULT 'general',
  style JSONB DEFAULT '{}',
  read_only BOOLEAN DEFAULT FALSE,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sheet_id, row_index, col_index)
);

-- Scenarios table (for what-if analysis)
CREATE TABLE IF NOT EXISTS finance_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES finance_workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  variables JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workbook_id, name)
);

-- Workbook versions (for version control)
CREATE TABLE IF NOT EXISTS finance_workbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES finance_workbooks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT,
  UNIQUE(workbook_id, version_number)
);

-- Indexes for performance
CREATE INDEX idx_finance_workbooks_created_by ON finance_workbooks(created_by);
CREATE INDEX idx_finance_workbooks_created_at ON finance_workbooks(created_at DESC);
CREATE INDEX idx_finance_sheets_workbook_id ON finance_sheets(workbook_id);
CREATE INDEX idx_finance_cells_sheet_id ON finance_cells(sheet_id);
CREATE INDEX idx_finance_cells_position ON finance_cells(sheet_id, row_index, col_index);
CREATE INDEX idx_finance_scenarios_workbook_id ON finance_scenarios(workbook_id);
CREATE INDEX idx_finance_workbook_versions_workbook_id ON finance_workbook_versions(workbook_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_finance_workbook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workbooks
CREATE TRIGGER update_finance_workbooks_timestamp
  BEFORE UPDATE ON finance_workbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_workbook_timestamp();

-- Trigger for cells
CREATE TRIGGER update_finance_cells_timestamp
  BEFORE UPDATE ON finance_cells
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_workbook_timestamp();

-- Function to create version snapshot
CREATE OR REPLACE FUNCTION create_workbook_version(
  p_workbook_id UUID,
  p_user_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_version_number INTEGER;
  v_snapshot JSONB;
  v_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM finance_workbook_versions
  WHERE workbook_id = p_workbook_id;

  -- Create snapshot
  SELECT jsonb_build_object(
    'workbook', row_to_json(w.*),
    'sheets', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'sheet', row_to_json(s.*),
          'cells', (
            SELECT jsonb_agg(row_to_json(c.*))
            FROM finance_cells c
            WHERE c.sheet_id = s.id
          )
        )
      )
      FROM finance_sheets s
      WHERE s.workbook_id = p_workbook_id
    )
  )
  INTO v_snapshot
  FROM finance_workbooks w
  WHERE w.id = p_workbook_id;

  -- Insert version
  INSERT INTO finance_workbook_versions (
    workbook_id,
    version_number,
    snapshot,
    created_by,
    comment
  ) VALUES (
    p_workbook_id,
    v_version_number,
    v_snapshot,
    p_user_id,
    p_comment
  )
  RETURNING id INTO v_version_id;

  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE finance_workbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_workbook_versions ENABLE ROW LEVEL SECURITY;

-- Workbooks: Users can see their own workbooks and shared workbooks
CREATE POLICY finance_workbooks_select ON finance_workbooks
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY finance_workbooks_insert ON finance_workbooks
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY finance_workbooks_update ON finance_workbooks
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY finance_workbooks_delete ON finance_workbooks
  FOR DELETE
  USING (created_by = auth.uid());

-- Sheets: Access based on workbook access
CREATE POLICY finance_sheets_all ON finance_sheets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM finance_workbooks w
      WHERE w.id = workbook_id
      AND (w.created_by = auth.uid() OR auth.uid() = ANY(w.shared_with))
    )
  );

-- Cells: Access based on sheet access
CREATE POLICY finance_cells_all ON finance_cells
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM finance_sheets s
      JOIN finance_workbooks w ON w.id = s.workbook_id
      WHERE s.id = sheet_id
      AND (w.created_by = auth.uid() OR auth.uid() = ANY(w.shared_with))
    )
  );

-- Scenarios: Access based on workbook access
CREATE POLICY finance_scenarios_all ON finance_scenarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM finance_workbooks w
      WHERE w.id = workbook_id
      AND (w.created_by = auth.uid() OR auth.uid() = ANY(w.shared_with))
    )
  );

-- Versions: Read-only access based on workbook access
CREATE POLICY finance_workbook_versions_select ON finance_workbook_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM finance_workbooks w
      WHERE w.id = workbook_id
      AND (w.created_by = auth.uid() OR auth.uid() = ANY(w.shared_with))
    )
  );

CREATE POLICY finance_workbook_versions_insert ON finance_workbook_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_workbooks w
      WHERE w.id = workbook_id
      AND (w.created_by = auth.uid() OR auth.uid() = ANY(w.shared_with))
    )
  );
