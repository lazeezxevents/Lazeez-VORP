import { supabase } from '@/integrations/supabase/client';
import { Cell, Sheet, Workbook, Scenario, cellKey } from '@/types/spreadsheet';
import { FormulaEngine } from './FormulaEngine';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export class ModelingWorkspace {
  /**
   * Create a new workbook
   */
  static async createWorkbook(
    name: string,
    description?: string,
    isTemplate = false
  ): Promise<string> {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error('Workbook name is required');
    }
    if (name.length > 200) {
      throw new Error('Workbook name must be less than 200 characters');
    }
    if (description && description.length > 1000) {
      throw new Error('Description must be less than 1000 characters');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Create workbook
    const { data: workbook, error: workbookError } = await supabase
      .from('finance_workbooks')
      .insert({
        name,
        description,
        created_by: user.id,
        is_template: isTemplate
      })
      .select('id')
      .single();

    if (workbookError) throw workbookError;

    // Create default sheet
    await this.createSheet(workbook.id, 'Sheet1');

    return workbook.id;
  }

  /**
   * Create a new sheet in a workbook
   */
  static async createSheet(
    workbookId: string,
    name: string,
    rowCount = 100,
    colCount = 26
  ): Promise<string> {
    // Validate inputs
    if (!workbookId || workbookId.trim().length === 0) {
      throw new Error('Workbook ID is required');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Sheet name is required');
    }
    if (name.length > 100) {
      throw new Error('Sheet name must be less than 100 characters');
    }
    if (!/^[a-zA-Z0-9\s-_]+$/.test(name)) {
      throw new Error('Sheet name contains invalid characters');
    }
    if (rowCount < 1 || rowCount > 10000) {
      throw new Error('Row count must be between 1 and 10000');
    }
    if (colCount < 1 || colCount > 100) {
      throw new Error('Column count must be between 1 and 100');
    }

    // Get current sheet count for position
    const { count } = await supabase
      .from('finance_sheets')
      .select('*', { count: 'exact', head: true })
      .eq('workbook_id', workbookId);

    const { data: sheet, error } = await supabase
      .from('finance_sheets')
      .insert({
        workbook_id: workbookId,
        name,
        position: count || 0,
        row_count: rowCount,
        col_count: colCount
      })
      .select('id')
      .single();

    if (error) throw error;

    return sheet.id;
  }

  /**
   * Update a cell value
   */
  static async updateCell(
    sheetId: string,
    row: number,
    col: number,
    value: string,
    format: string = 'general'
  ): Promise<void> {
    // Validate inputs
    if (!sheetId || sheetId.trim().length === 0) {
      throw new Error('Sheet ID is required');
    }
    if (row < 0 || row > 9999) {
      throw new Error('Row must be between 0 and 9999');
    }
    if (col < 0 || col > 99) {
      throw new Error('Column must be between 0 and 99');
    }
    if (value && value.length > 10000) {
      throw new Error('Cell value too large (max 10000 characters)');
    }
    const validFormats = ['general', 'currency', 'percentage', 'number', 'date', 'text'];
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid format: ${format}`);
    }

    // Check if it's a formula
    const isFormula = value.startsWith('=');
    
    let cellValue: string | number | boolean | null = value;
    let formula: string | undefined;
    let error: string | undefined;

    if (isFormula) {
      formula = value;
      
      // Get all cells in the sheet for formula evaluation
      const { data: cells } = await supabase
        .from('finance_cells')
        .select('*')
        .eq('sheet_id', sheetId);

      const cellMap = new Map<string, Cell>();
      cells?.forEach(c => {
        cellMap.set(cellKey(c.row_index, c.col_index), {
          value: this.parseValue(c.value),
          formula: c.formula || undefined,
          format: c.format as any,
          style: c.style as any,
          readOnly: c.read_only,
          error: c.error || undefined
        });
      });

      // Evaluate formula
      const engine = new FormulaEngine(cellMap);
      try {
        const result = engine.evaluate(formula, row, col);
        cellValue = result;
        
        // Get dependent cells that need recalculation
        const dependents = engine.getDependents(row, col);
        
        // Recalculate dependent cells
        for (const depKey of dependents) {
          const [depRow, depCol] = depKey.split(',').map(Number);
          const depCell = cellMap.get(depKey);
          if (depCell?.formula) {
            const depResult = engine.evaluate(depCell.formula, depRow, depCol);
            await this.updateCellValue(sheetId, depRow, depCol, depResult);
          }
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'Formula error';
        cellValue = null;
      }
    } else {
      // Parse non-formula value
      cellValue = this.parseValue(value);
    }

    // Upsert cell
    const { error: upsertError } = await supabase
      .from('finance_cells')
      .upsert({
        sheet_id: sheetId,
        row_index: row,
        col_index: col,
        value: cellValue?.toString() || null,
        formula,
        format,
        error
      }, {
        onConflict: 'sheet_id,row_index,col_index'
      });

    if (upsertError) throw upsertError;
  }

  /**
   * Update cell value only (used for recalculation)
   */
  private static async updateCellValue(
    sheetId: string,
    row: number,
    col: number,
    value: any
  ): Promise<void> {
    await supabase
      .from('finance_cells')
      .update({ value: value?.toString() || null })
      .eq('sheet_id', sheetId)
      .eq('row_index', row)
      .eq('col_index', col);
  }

  /**
   * Parse string value to appropriate type
   */
  private static parseValue(value: string): string | number | boolean | null {
    if (!value || value === '') return null;
    
    // Try boolean
    if (value === 'TRUE') return true;
    if (value === 'FALSE') return false;
    
    // Try number
    const num = parseFloat(value);
    if (!isNaN(num) && value === num.toString()) return num;
    
    // Return as string
    return value;
  }

  /**
   * Get workbook with all sheets and cells
   */
  static async getWorkbook(workbookId: string): Promise<Workbook> {
    const { data: workbook, error: workbookError } = await supabase
      .from('finance_workbooks')
      .select('*')
      .eq('id', workbookId)
      .single();

    if (workbookError) throw workbookError;

    const { data: sheets, error: sheetsError } = await supabase
      .from('finance_sheets')
      .select('*')
      .eq('workbook_id', workbookId)
      .order('position');

    if (sheetsError) throw sheetsError;

    const sheetData: Sheet[] = [];

    for (const sheet of sheets || []) {
      const { data: cells } = await supabase
        .from('finance_cells')
        .select('*')
        .eq('sheet_id', sheet.id);

      const cellMap = new Map<string, Cell>();
      cells?.forEach(c => {
        cellMap.set(cellKey(c.row_index, c.col_index), {
          value: this.parseValue(c.value),
          formula: c.formula || undefined,
          format: c.format as any,
          style: c.style as any,
          readOnly: c.read_only,
          error: c.error || undefined
        });
      });

      sheetData.push({
        id: sheet.id,
        name: sheet.name,
        cells: cellMap,
        rowCount: sheet.row_count,
        colCount: sheet.col_count,
        frozenRows: sheet.frozen_rows || undefined,
        frozenCols: sheet.frozen_cols || undefined
      });
    }

    return {
      id: workbook.id,
      name: workbook.name,
      sheets: sheetData,
      activeSheetId: sheetData[0]?.id || '',
      created_at: workbook.created_at,
      updated_at: workbook.updated_at,
      created_by: workbook.created_by,
      shared_with: workbook.shared_with
    };
  }

  /**
   * Import data from CSV
   */
  static async importCSV(sheetId: string, csvData: string): Promise<void> {
    const rows = csvData.split('\n').map(row => row.split(','));
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const value = row[colIndex].trim();
        if (value) {
          await this.updateCell(sheetId, rowIndex, colIndex, value);
        }
      }
    }
  }

  /**
   * Export workbook to Excel
   */
  static async exportToExcel(workbookId: string): Promise<Blob> {
    const workbook = await this.getWorkbook(workbookId);
    
    const wb = XLSX.utils.book_new();

    for (const sheet of workbook.sheets) {
      const data: any[][] = [];
      
      // Convert cell map to 2D array
      for (let row = 0; row < sheet.rowCount; row++) {
        const rowData: any[] = [];
        for (let col = 0; col < sheet.colCount; col++) {
          const cell = sheet.cells.get(cellKey(row, col));
          rowData.push(cell?.value ?? '');
        }
        data.push(rowData);
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Export workbook to PDF
   */
  static async exportToPDF(workbookId: string): Promise<Blob> {
    const workbook = await this.getWorkbook(workbookId);
    
    const doc = new jsPDF();
    let isFirstSheet = true;

    for (const sheet of workbook.sheets) {
      if (!isFirstSheet) {
        doc.addPage();
      }
      isFirstSheet = false;

      // Add sheet name as title
      doc.setFontSize(16);
      doc.text(sheet.name, 14, 15);

      // Prepare table data
      const tableData: any[][] = [];
      for (let row = 0; row < Math.min(sheet.rowCount, 50); row++) {
        const rowData: any[] = [];
        for (let col = 0; col < Math.min(sheet.colCount, 10); col++) {
          const cell = sheet.cells.get(cellKey(row, col));
          rowData.push(cell?.value?.toString() ?? '');
        }
        tableData.push(rowData);
      }

      // Add table
      (doc as any).autoTable({
        head: [],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8 },
        margin: { top: 25 }
      });
    }

    return doc.output('blob');
  }

  /**
   * Create a scenario
   */
  static async createScenario(
    workbookId: string,
    name: string,
    description: string,
    variables: Record<string, any>
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: scenario, error } = await supabase
      .from('finance_scenarios')
      .insert({
        workbook_id: workbookId,
        name,
        description,
        variables,
        created_by: user.id
      })
      .select('id')
      .single();

    if (error) throw error;

    return scenario.id;
  }

  /**
   * Create a version snapshot
   */
  static async createVersion(workbookId: string, comment?: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('create_workbook_version', {
      p_workbook_id: workbookId,
      p_user_id: user.id,
      p_comment: comment
    });

    if (error) throw error;

    return data;
  }

  /**
   * Share workbook with users
   */
  static async shareWorkbook(workbookId: string, userIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('finance_workbooks')
      .update({ shared_with: userIds })
      .eq('id', workbookId);

    if (error) throw error;
  }
}
