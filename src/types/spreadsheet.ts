// Spreadsheet types for Financial Modeling Workspace

export type CellValue = string | number | boolean | null;

export type CellFormat = 
  | 'general'
  | 'currency'
  | 'percentage'
  | 'number'
  | 'date'
  | 'text';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface Cell {
  value: CellValue;
  formula?: string;
  format: CellFormat;
  style?: CellStyle;
  error?: string;
  readOnly?: boolean;
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Map<string, Cell>; // key: "row,col"
  rowCount: number;
  colCount: number;
  frozenRows?: number;
  frozenCols?: number;
}

export interface Workbook {
  id: string;
  name: string;
  sheets: Sheet[];
  activeSheetId: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  shared_with?: string[];
}

export interface FormulaFunction {
  name: string;
  description: string;
  syntax: string;
  category: 'math' | 'statistical' | 'financial' | 'logical' | 'text' | 'date';
  execute: (...args: any[]) => CellValue;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, CellValue>;
  workbook_id: string;
  created_at: string;
}

// Helper function to convert cell position to key
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

// Helper function to convert column index to letter (0 -> A, 25 -> Z, 26 -> AA)
export function colIndexToLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

// Helper function to convert column letter to index (A -> 0, Z -> 25, AA -> 26)
export function colLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + letter.charCodeAt(i) - 64;
  }
  return index - 1;
}

// Helper function to format cell reference (0, 0 -> A1)
export function cellReference(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}
