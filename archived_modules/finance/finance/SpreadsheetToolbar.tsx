import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  Percent, 
  Hash, 
  Calendar,
  Type,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CellFormat, CellPosition } from '@/types/spreadsheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface SpreadsheetToolbarProps {
  selectedCell: CellPosition | null;
  onFormatChange: (format: CellFormat) => void;
  onStyleChange: (style: 'bold' | 'italic' | 'underline' | 'alignLeft' | 'alignCenter' | 'alignRight') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function SpreadsheetToolbar({
  selectedCell,
  onFormatChange,
  onStyleChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: SpreadsheetToolbarProps) {
  const formatButtons = [
    { format: 'currency' as CellFormat, icon: DollarSign, label: 'Currency format' },
    { format: 'percentage' as CellFormat, icon: Percent, label: 'Percentage format' },
    { format: 'number' as CellFormat, icon: Hash, label: 'Number format' },
    { format: 'date' as CellFormat, icon: Calendar, label: 'Date format' },
    { format: 'text' as CellFormat, icon: Type, label: 'Text format' },
  ];

  const styleButtons = [
    { style: 'bold' as const, icon: Bold, label: 'Bold' },
    { style: 'italic' as const, icon: Italic, label: 'Italic' },
    { style: 'underline' as const, icon: Underline, label: 'Underline' },
  ];

  const alignButtons = [
    { style: 'alignLeft' as const, icon: AlignLeft, label: 'Align left' },
    { style: 'alignCenter' as const, icon: AlignCenter, label: 'Align center' },
    { style: 'alignRight' as const, icon: AlignRight, label: 'Align right' },
  ];

  return (
    <motion.div
      className="flex items-center gap-2 p-2 border-b border-border bg-background"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      <TooltipProvider>
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="h-8 w-8 p-0"
                >
                  <Undo className="h-4 w-4" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="h-8 w-8 p-0"
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Format buttons */}
        <div className="flex items-center gap-1">
          {formatButtons.map(({ format, icon: Icon, label }) => (
            <Tooltip key={format}>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFormatChange(format)}
                    disabled={!selectedCell}
                    className="h-8 w-8 p-0"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Style buttons */}
        <div className="flex items-center gap-1">
          {styleButtons.map(({ style, icon: Icon, label }) => (
            <Tooltip key={style}>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStyleChange(style)}
                    disabled={!selectedCell}
                    className="h-8 w-8 p-0"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Alignment buttons */}
        <div className="flex items-center gap-1">
          {alignButtons.map(({ style, icon: Icon, label }) => (
            <Tooltip key={style}>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStyleChange(style)}
                    disabled={!selectedCell}
                    className="h-8 w-8 p-0"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </motion.div>
  );
}
