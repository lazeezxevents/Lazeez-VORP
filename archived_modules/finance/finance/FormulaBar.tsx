import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Cell, CellPosition, cellReference } from '@/types/spreadsheet';
import { motion } from 'framer-motion';

interface FormulaBarProps {
  selectedCell: CellPosition | null;
  cell: Cell | undefined;
  onCellEdit: (position: CellPosition, value: string) => void;
}

export function FormulaBar({ selectedCell, cell, onCellEdit }: FormulaBarProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (selectedCell && cell) {
      setValue(cell.formula || cell.value?.toString() || '');
    } else {
      setValue('');
    }
  }, [selectedCell, cell]);

  const handleSubmit = () => {
    if (selectedCell) {
      onCellEdit(selectedCell, value);
    }
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(cell?.formula || cell?.value?.toString() || '');
      setIsFocused(false);
    }
  };

  return (
    <motion.div
      className="flex items-center gap-3 p-3 border-b border-border bg-background"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Cell reference */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <span className="text-sm font-medium text-muted-foreground">Cell:</span>
        <span className="text-sm font-mono font-semibold">
          {selectedCell ? cellReference(selectedCell.row, selectedCell.col) : '-'}
        </span>
      </div>

      {/* Formula input */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">fx</span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          placeholder={selectedCell ? 'Enter value or formula (e.g., =SUM(A1:A10))' : 'Select a cell to edit'}
          disabled={!selectedCell || cell?.readOnly}
          className={`
            font-mono text-sm
            ${isFocused ? 'ring-2 ring-primary' : ''}
            ${cell?.error ? 'border-destructive' : ''}
          `}
        />
      </div>

      {/* Cell format indicator */}
      {cell && (
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className="text-xs text-muted-foreground">Format:</span>
          <span className="text-xs font-medium capitalize">
            {cell.format}
          </span>
        </div>
      )}
    </motion.div>
  );
}
