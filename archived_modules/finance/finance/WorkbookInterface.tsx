import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { FormulaBar } from './FormulaBar';
import { SpreadsheetToolbar } from './SpreadsheetToolbar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Download, 
  Upload, 
  Share2, 
  Plus,
  FileSpreadsheet,
  History
} from 'lucide-react';
import { Cell, CellPosition, CellFormat, Sheet, cellKey } from '@/types/spreadsheet';
import { ModelingWorkspace } from '@/services/ModelingWorkspace';
import { FormulaEngine } from '@/services/FormulaEngine';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WorkbookInterfaceProps {
  workbookId: string;
}

export function WorkbookInterface({ workbookId }: WorkbookInterfaceProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [workbookName, setWorkbookName] = useState('');

  // Load workbook
  useEffect(() => {
    loadWorkbook();
  }, [workbookId]);

  const loadWorkbook = async () => {
    try {
      const workbook = await ModelingWorkspace.getWorkbook(workbookId);
      setSheets(workbook.sheets);
      setActiveSheetId(workbook.activeSheetId);
      setWorkbookName(workbook.name);
    } catch (error) {
      toast.error('Failed to load workbook');
      console.error(error);
    }
  };

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  const handleCellSelect = useCallback((position: CellPosition) => {
    setSelectedCell(position);
  }, []);

  const handleCellEdit = useCallback(async (position: CellPosition, value: string) => {
    if (!activeSheet) return;

    try {
      // Save to undo stack
      const oldCell = activeSheet.cells.get(cellKey(position.row, position.col));
      setUndoStack(prev => [...prev, { position, oldCell }]);
      setRedoStack([]);

      // Update cell in database
      await ModelingWorkspace.updateCell(
        activeSheet.id,
        position.row,
        position.col,
        value
      );

      // Reload workbook to get updated cells
      await loadWorkbook();

      toast.success('Cell updated');
    } catch (error) {
      toast.error('Failed to update cell');
      console.error(error);
    }
  }, [activeSheet]);

  const handleFormatChange = useCallback(async (format: CellFormat) => {
    if (!selectedCell || !activeSheet) return;

    try {
      const cell = activeSheet.cells.get(cellKey(selectedCell.row, selectedCell.col));
      if (cell) {
        await ModelingWorkspace.updateCell(
          activeSheet.id,
          selectedCell.row,
          selectedCell.col,
          cell.value?.toString() || '',
          format
        );
        await loadWorkbook();
        toast.success('Format applied');
      }
    } catch (error) {
      toast.error('Failed to apply format');
      console.error(error);
    }
  }, [selectedCell, activeSheet]);

  const handleStyleChange = useCallback((style: string) => {
    // Style changes would be implemented here
    toast.info('Style changes coming soon');
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    // Undo implementation
    toast.info('Undo functionality coming soon');
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    // Redo implementation
    toast.info('Redo functionality coming soon');
  }, [redoStack]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await ModelingWorkspace.createVersion(workbookId, 'Manual save');
      toast.success('Workbook saved');
    } catch (error) {
      toast.error('Failed to save workbook');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [workbookId]);

  const handleExport = useCallback(async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'excel') {
        blob = await ModelingWorkspace.exportToExcel(workbookId);
        filename = `${workbookName}.xlsx`;
      } else if (format === 'pdf') {
        blob = await ModelingWorkspace.exportToPDF(workbookId);
        filename = `${workbookName}.pdf`;
      } else {
        toast.info('CSV export coming soon');
        return;
      }

      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported to ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export workbook');
      console.error(error);
    }
  }, [workbookId, workbookName]);

  const handleAddSheet = useCallback(async () => {
    try {
      const sheetName = `Sheet${sheets.length + 1}`;
      await ModelingWorkspace.createSheet(workbookId, sheetName);
      await loadWorkbook();
      toast.success('Sheet added');
    } catch (error) {
      toast.error('Failed to add sheet');
      console.error(error);
    }
  }, [workbookId, sheets.length]);

  if (!activeSheet) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium">Loading workbook...</p>
        </div>
      </div>
    );
  }

  const selectedCellData = selectedCell 
    ? activeSheet.cells.get(cellKey(selectedCell.row, selectedCell.col))
    : undefined;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">{workbookName}</h1>
        </div>

        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </motion.div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm">
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Toolbar */}
      <SpreadsheetToolbar
        selectedCell={selectedCell}
        onFormatChange={handleFormatChange}
        onStyleChange={handleStyleChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Formula Bar */}
      <FormulaBar
        selectedCell={selectedCell}
        cell={selectedCellData}
        onCellEdit={handleCellEdit}
      />

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-hidden p-4">
        <SpreadsheetGrid
          cells={activeSheet.cells}
          rowCount={activeSheet.rowCount}
          colCount={activeSheet.colCount}
          selectedCell={selectedCell}
          onCellSelect={handleCellSelect}
          onCellEdit={handleCellEdit}
          onCellBlur={() => {}}
        />
      </div>

      {/* Sheet Tabs */}
      <motion.div
        className="border-t border-border bg-muted/30 p-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <Tabs value={activeSheetId} onValueChange={setActiveSheetId}>
            <TabsList className="bg-transparent">
              {sheets.map((sheet) => (
                <TabsTrigger
                  key={sheet.id}
                  value={sheet.id}
                  className="data-[state=active]:bg-background"
                >
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddSheet}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
