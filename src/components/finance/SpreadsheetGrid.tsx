import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cell, CellPosition, cellKey, colIndexToLetter, cellReference } from '@/types/spreadsheet';

interface SpreadsheetGridProps {
  cells: Map<string, Cell>;
  rowCount: number;
  colCount: number;
  selectedCell: CellPosition | null;
  onCellSelect: (position: CellPosition) => void;
  onCellEdit: (position: CellPosition, value: string) => void;
  onCellBlur: () => void;
}

const ROW_HEIGHT = 32;
const COL_WIDTH = 120;
const HEADER_HEIGHT = 32;
const HEADER_WIDTH = 50;

export function SpreadsheetGrid({
  cells,
  rowCount,
  colCount,
  selectedCell,
  onCellSelect,
  onCellEdit,
  onCellBlur
}: SpreadsheetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate visible range based on scroll position
  const visibleStartRow = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleEndRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + (containerRef.current?.clientHeight || 600)) / ROW_HEIGHT) + 1
  );
  const visibleStartCol = Math.floor(scrollLeft / COL_WIDTH);
  const visibleEndCol = Math.min(
    colCount,
    Math.ceil((scrollLeft + (containerRef.current?.clientWidth || 800)) / COL_WIDTH) + 1
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    const cell = cells.get(cellKey(row, col));
    if (cell?.readOnly) return;
    
    onCellSelect({ row, col });
    setEditingCell(null);
  }, [cells, onCellSelect]);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    const cell = cells.get(cellKey(row, col));
    if (cell?.readOnly) return;
    
    setEditingCell({ row, col });
    setEditValue(cell?.formula || cell?.value?.toString() || '');
  }, [cells]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) onCellSelect({ row: row - 1, col });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row < rowCount - 1) onCellSelect({ row: row + 1, col });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) onCellSelect({ row, col: col - 1 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < colCount - 1) onCellSelect({ row, col: col + 1 });
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) onCellSelect({ row, col: col - 1 });
        } else {
          if (col < colCount - 1) onCellSelect({ row, col: col + 1 });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (editingCell) {
          onCellEdit(editingCell, editValue);
          setEditingCell(null);
          if (row < rowCount - 1) onCellSelect({ row: row + 1, col });
        } else {
          handleCellDoubleClick(row, col);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setEditingCell(null);
        onCellBlur();
        break;
      case 'F2':
        e.preventDefault();
        handleCellDoubleClick(row, col);
        break;
      default:
        // Start editing on any alphanumeric key
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !editingCell) {
          const cell = cells.get(cellKey(row, col));
          if (!cell?.readOnly) {
            setEditingCell({ row, col });
            setEditValue(e.key);
          }
        }
    }
  }, [selectedCell, editingCell, editValue, rowCount, colCount, cells, onCellSelect, onCellEdit, onCellBlur, handleCellDoubleClick]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const formatCellValue = (cell: Cell | undefined): string => {
    if (!cell || cell.value === null) return '';
    
    if (cell.error) return cell.error;
    
    const value = cell.value;
    
    switch (cell.format) {
      case 'currency':
        return typeof value === 'number' 
          ? `PKR ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value.toString();
      case 'percentage':
        return typeof value === 'number'
          ? `${(value * 100).toFixed(2)}%`
          : value.toString();
      case 'number':
        return typeof value === 'number'
          ? value.toLocaleString('en-PK')
          : value.toString();
      case 'date':
        return value instanceof Date
          ? value.toLocaleDateString('en-PK')
          : value.toString();
      default:
        return value.toString();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto border border-border rounded-lg bg-background"
      style={{ height: '600px' }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Column headers */}
      <div
        className="sticky top-0 left-0 z-20 flex bg-muted border-b border-border"
        style={{ height: HEADER_HEIGHT }}
      >
        <div
          className="sticky left-0 z-30 flex items-center justify-center border-r border-border bg-muted"
          style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}
        />
        {Array.from({ length: colCount }, (_, i) => i).map((col) => (
          <div
            key={col}
            className="flex items-center justify-center border-r border-border font-medium text-xs text-muted-foreground"
            style={{
              width: COL_WIDTH,
              minWidth: COL_WIDTH,
              marginLeft: col === 0 ? scrollLeft : 0
            }}
          >
            {colIndexToLetter(col)}
          </div>
        ))}
      </div>

      {/* Grid content */}
      <div
        style={{
          height: rowCount * ROW_HEIGHT,
          width: colCount * COL_WIDTH + HEADER_WIDTH
        }}
      >
        {Array.from({ length: visibleEndRow - visibleStartRow }, (_, i) => visibleStartRow + i).map((row) => (
          <div
            key={row}
            className="flex"
            style={{
              position: 'absolute',
              top: row * ROW_HEIGHT + HEADER_HEIGHT,
              left: 0,
              height: ROW_HEIGHT
            }}
          >
            {/* Row header */}
            <div
              className="sticky left-0 z-10 flex items-center justify-center border-r border-b border-border bg-muted font-medium text-xs text-muted-foreground"
              style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}
            >
              {row + 1}
            </div>

            {/* Cells */}
            {Array.from({ length: visibleEndCol - visibleStartCol }, (_, i) => visibleStartCol + i).map((col) => {
              const cell = cells.get(cellKey(row, col));
              const isSelected = selectedCell?.row === row && selectedCell?.col === col;
              const isEditing = editingCell?.row === row && editingCell?.col === col;

              return (
                <motion.div
                  key={col}
                  className={`
                    flex items-center px-2 border-r border-b border-border cursor-cell
                    ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                    ${cell?.readOnly ? 'bg-muted/50' : 'hover:bg-accent/50'}
                    ${cell?.error ? 'text-destructive' : ''}
                  `}
                  style={{
                    width: COL_WIDTH,
                    minWidth: COL_WIDTH,
                    height: ROW_HEIGHT,
                    ...cell?.style
                  }}
                  onClick={() => handleCellClick(row, col)}
                  onDoubleClick={() => handleCellDoubleClick(row, col)}
                  whileHover={{ backgroundColor: cell?.readOnly ? undefined : 'hsl(var(--accent) / 0.5)' }}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        onCellEdit(editingCell, editValue);
                        setEditingCell(null);
                      }}
                      className="w-full h-full bg-transparent outline-none text-sm"
                    />
                  ) : (
                    <span className="text-sm truncate w-full">
                      {formatCellValue(cell)}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
