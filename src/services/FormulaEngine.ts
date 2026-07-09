import { CellValue, Cell, cellKey, colLetterToIndex } from '@/types/spreadsheet';

interface CellReference {
  row: number;
  col: number;
}

interface CellRange {
  start: CellReference;
  end: CellReference;
}

export class FormulaEngine {
  private cells: Map<string, Cell>;
  private dependencies: Map<string, Set<string>>; // cell -> cells it depends on
  private dependents: Map<string, Set<string>>; // cell -> cells that depend on it

  constructor(cells: Map<string, Cell>) {
    this.cells = cells;
    this.dependencies = new Map();
    this.dependents = new Map();
  }

  /**
   * Evaluate a formula and return the result
   */
  evaluate(formula: string, row: number, col: number): CellValue {
    try {
      // Remove leading = sign
      const expression = formula.startsWith('=') ? formula.slice(1) : formula;

      // Track dependencies for this cell
      const cellId = cellKey(row, col);
      this.dependencies.set(cellId, new Set());

      // Parse and evaluate the expression
      const result = this.evaluateExpression(expression, row, col);

      return result;
    } catch (error) {
      return `#ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Parse and evaluate an expression
   */
  private evaluateExpression(expression: string, currentRow: number, currentCol: number): CellValue {
    // Handle function calls
    const functionMatch = expression.match(/^([A-Z]+)\((.*)\)$/);
    if (functionMatch) {
      const [, funcName, argsStr] = functionMatch;
      return this.evaluateFunction(funcName, argsStr, currentRow, currentCol);
    }

    // Handle cell references (e.g., A1, B2)
    const cellRefMatch = expression.match(/^([A-Z]+)(\d+)$/);
    if (cellRefMatch) {
      const [, colLetter, rowStr] = cellRefMatch;
      const refCol = colLetterToIndex(colLetter);
      const refRow = parseInt(rowStr) - 1;
      return this.getCellValue(refRow, refCol, currentRow, currentCol);
    }

    // Handle numeric literals
    const numMatch = expression.match(/^-?\d+(\.\d+)?$/);
    if (numMatch) {
      return parseFloat(expression);
    }

    // Handle string literals
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1);
    }

    // Handle boolean literals
    if (expression === 'TRUE') return true;
    if (expression === 'FALSE') return false;

    // Handle arithmetic expressions
    return this.evaluateArithmetic(expression, currentRow, currentCol);
  }

  /**
   * Evaluate arithmetic expressions
   */
  private evaluateArithmetic(expression: string, currentRow: number, currentCol: number): CellValue {
    // Simple arithmetic parser (supports +, -, *, /)
    // This is a simplified version - a production implementation would use a proper parser

    // Replace cell references with their values
    const processedExpr = expression.replace(/([A-Z]+\d+)/g, (match) => {
      const cellRefMatch = match.match(/^([A-Z]+)(\d+)$/);
      if (cellRefMatch) {
        const [, colLetter, rowStr] = cellRefMatch;
        const refCol = colLetterToIndex(colLetter);
        const refRow = parseInt(rowStr) - 1;
        const value = this.getCellValue(refRow, refCol, currentRow, currentCol);
        return typeof value === 'number' ? value.toString() : '0';
      }
      return '0';
    });

    try {
      // Evaluate the expression (using Function constructor for safety)
      // In production, use a proper expression parser
      const result = new Function(`return ${processedExpr}`)();
      return typeof result === 'number' ? result : 0;
    } catch {
      throw new Error('Invalid arithmetic expression');
    }
  }

  /**
   * Evaluate a function call
   */
  private evaluateFunction(funcName: string, argsStr: string, currentRow: number, currentCol: number): CellValue {
    const args = this.parseArguments(argsStr, currentRow, currentCol);

    switch (funcName) {
      case 'SUM':
        return this.sum(args);
      case 'AVERAGE':
        return this.average(args);
      case 'COUNT':
        return this.count(args);
      case 'MIN':
        return this.min(args);
      case 'MAX':
        return this.max(args);
      case 'IF':
        return this.if(args);
      case 'AND':
        return this.and(args);
      case 'OR':
        return this.or(args);
      case 'NPV':
        return this.npv(args);
      case 'IRR':
        return this.irr(args);
      case 'PMT':
        return this.pmt(args);
      default:
        throw new Error(`Unknown function: ${funcName}`);
    }
  }

  /**
   * Parse function arguments
   */
  private parseArguments(argsStr: string, currentRow: number, currentCol: number): CellValue[] {
    const args: CellValue[] = [];
    const parts = argsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      // Check if it's a range (e.g., A1:A10)
      const rangeMatch = part.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (rangeMatch) {
        const [, startCol, startRow, endCol, endRow] = rangeMatch;
        const range: CellRange = {
          start: { row: parseInt(startRow) - 1, col: colLetterToIndex(startCol) },
          end: { row: parseInt(endRow) - 1, col: colLetterToIndex(endCol) }
        };
        args.push(...this.getRangeValues(range, currentRow, currentCol));
      } else {
        // Single value or expression
        args.push(this.evaluateExpression(part, currentRow, currentCol));
      }
    }

    return args;
  }

  /**
   * Get values from a cell range
   */
  private getRangeValues(range: CellRange, currentRow: number, currentCol: number): CellValue[] {
    const values: CellValue[] = [];
    
    for (let row = range.start.row; row <= range.end.row; row++) {
      for (let col = range.start.col; col <= range.end.col; col++) {
        values.push(this.getCellValue(row, col, currentRow, currentCol));
      }
    }

    return values;
  }

  /**
   * Get a cell value and track dependency
   */
  private getCellValue(row: number, col: number, currentRow: number, currentCol: number): CellValue {
    const cellId = cellKey(row, col);
    const currentCellId = cellKey(currentRow, currentCol);

    // Track dependency
    this.dependencies.get(currentCellId)?.add(cellId);
    if (!this.dependents.has(cellId)) {
      this.dependents.set(cellId, new Set());
    }
    this.dependents.get(cellId)?.add(currentCellId);

    // Check for circular reference
    if (this.hasCircularReference(currentCellId, cellId)) {
      throw new Error('Circular reference detected');
    }

    const cell = this.cells.get(cellId);
    return cell?.value ?? 0;
  }

  /**
   * Check for circular references
   */
  private hasCircularReference(startCell: string, targetCell: string, visited = new Set<string>()): boolean {
    if (startCell === targetCell && visited.size > 0) {
      return true;
    }

    if (visited.has(targetCell)) {
      return false;
    }

    visited.add(targetCell);

    const deps = this.dependencies.get(targetCell);
    if (!deps) return false;

    for (const dep of deps) {
      if (this.hasCircularReference(startCell, dep, visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get cells that depend on a given cell
   */
  getDependents(row: number, col: number): string[] {
    const cellId = cellKey(row, col);
    return Array.from(this.dependents.get(cellId) || []);
  }

  // ===== FORMULA FUNCTIONS =====

  private sum(args: CellValue[]): number {
    return args.reduce((sum, val) => {
      const num = typeof val === 'number' ? val : 0;
      return sum + num;
    }, 0);
  }

  private average(args: CellValue[]): number {
    const numbers = args.filter(v => typeof v === 'number') as number[];
    if (numbers.length === 0) return 0;
    return this.sum(numbers) / numbers.length;
  }

  private count(args: CellValue[]): number {
    return args.filter(v => v !== null && v !== '').length;
  }

  private min(args: CellValue[]): number {
    const numbers = args.filter(v => typeof v === 'number') as number[];
    if (numbers.length === 0) return 0;
    return Math.min(...numbers);
  }

  private max(args: CellValue[]): number {
    const numbers = args.filter(v => typeof v === 'number') as number[];
    if (numbers.length === 0) return 0;
    return Math.max(...numbers);
  }

  private if(args: CellValue[]): CellValue {
    if (args.length < 3) throw new Error('IF requires 3 arguments');
    const condition = args[0];
    return condition ? args[1] : args[2];
  }

  private and(args: CellValue[]): boolean {
    return args.every(v => Boolean(v));
  }

  private or(args: CellValue[]): boolean {
    return args.some(v => Boolean(v));
  }

  /**
   * NPV - Net Present Value
   * NPV(rate, value1, value2, ...)
   */
  private npv(args: CellValue[]): number {
    if (args.length < 2) throw new Error('NPV requires at least 2 arguments');
    
    const rate = typeof args[0] === 'number' ? args[0] : 0;
    const cashFlows = args.slice(1).filter(v => typeof v === 'number') as number[];
    
    return cashFlows.reduce((npv, cashFlow, index) => {
      return npv + cashFlow / Math.pow(1 + rate, index + 1);
    }, 0);
  }

  /**
   * IRR - Internal Rate of Return
   * IRR(values, [guess])
   * Uses Newton-Raphson method
   */
  private irr(args: CellValue[]): number {
    const values = args.filter(v => typeof v === 'number') as number[];
    if (values.length < 2) throw new Error('IRR requires at least 2 values');

    let guess = 0.1; // 10% initial guess
    const maxIterations = 100;
    const tolerance = 0.00001;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < values.length; j++) {
        npv += values[j] / Math.pow(1 + guess, j);
        dnpv -= j * values[j] / Math.pow(1 + guess, j + 1);
      }

      const newGuess = guess - npv / dnpv;

      if (Math.abs(newGuess - guess) < tolerance) {
        return newGuess;
      }

      guess = newGuess;
    }

    throw new Error('IRR did not converge');
  }

  /**
   * PMT - Payment calculation
   * PMT(rate, nper, pv, [fv], [type])
   */
  private pmt(args: CellValue[]): number {
    if (args.length < 3) throw new Error('PMT requires at least 3 arguments');

    const rate = typeof args[0] === 'number' ? args[0] : 0;
    const nper = typeof args[1] === 'number' ? args[1] : 0;
    const pv = typeof args[2] === 'number' ? args[2] : 0;
    const fv = args.length > 3 && typeof args[3] === 'number' ? args[3] : 0;
    const type = args.length > 4 && typeof args[4] === 'number' ? args[4] : 0;

    if (rate === 0) {
      return -(pv + fv) / nper;
    }

    const pvif = Math.pow(1 + rate, nper);
    let pmt = (rate * (pv * pvif + fv)) / (pvif - 1);

    if (type === 1) {
      pmt /= (1 + rate);
    }

    return -pmt;
  }
}
