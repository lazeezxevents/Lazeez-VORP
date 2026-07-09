import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ModelingWorkspace } from "@/services/ModelingWorkspace";
import { toast } from "sonner";

/**
 * Fetch all workbooks for the current user
 */
export function useWorkbooks() {
  return useQuery({
    queryKey: ["workbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_workbooks")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch a single workbook with all sheets and cells
 */
export function useWorkbook(workbookId: string) {
  return useQuery({
    queryKey: ["workbooks", workbookId],
    queryFn: async () => {
      return await ModelingWorkspace.getWorkbook(workbookId);
    },
    enabled: !!workbookId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Create a new workbook
 */
export function useCreateWorkbook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      isTemplate = false,
    }: {
      name: string;
      description?: string;
      isTemplate?: boolean;
    }) => {
      return await ModelingWorkspace.createWorkbook(name, description, isTemplate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      toast.success("Workbook created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create workbook: ${error.message}`);
    },
  });
}

/**
 * Create a new sheet in a workbook
 */
export function useCreateSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workbookId,
      name,
      rowCount = 100,
      colCount = 26,
    }: {
      workbookId: string;
      name: string;
      rowCount?: number;
      colCount?: number;
    }) => {
      return await ModelingWorkspace.createSheet(workbookId, name, rowCount, colCount);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workbooks", variables.workbookId] });
      toast.success("Sheet created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sheet: ${error.message}`);
    },
  });
}

/**
 * Update a cell value
 */
export function useUpdateCell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sheetId,
      row,
      col,
      value,
      format = "general",
    }: {
      sheetId: string;
      row: number;
      col: number;
      value: string;
      format?: string;
    }) => {
      return await ModelingWorkspace.updateCell(sheetId, row, col, value, format);
    },
    onSuccess: (_, variables) => {
      // Invalidate the workbook query to refresh all sheets
      queryClient.invalidateQueries({ queryKey: ["workbooks"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update cell: ${error.message}`);
    },
  });
}

/**
 * Import CSV data into a sheet
 */
export function useImportCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sheetId, csvData }: { sheetId: string; csvData: string }) => {
      return await ModelingWorkspace.importCSV(sheetId, csvData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      toast.success("CSV imported successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to import CSV: ${error.message}`);
    },
  });
}

/**
 * Export workbook to Excel
 */
export function useExportToExcel() {
  return useMutation({
    mutationFn: async (workbookId: string) => {
      return await ModelingWorkspace.exportToExcel(workbookId);
    },
    onError: (error: Error) => {
      toast.error(`Failed to export to Excel: ${error.message}`);
    },
  });
}

/**
 * Export workbook to PDF
 */
export function useExportToPDF() {
  return useMutation({
    mutationFn: async (workbookId: string) => {
      return await ModelingWorkspace.exportToPDF(workbookId);
    },
    onError: (error: Error) => {
      toast.error(`Failed to export to PDF: ${error.message}`);
    },
  });
}

/**
 * Create a scenario
 */
export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workbookId,
      name,
      description,
      variables,
    }: {
      workbookId: string;
      name: string;
      description: string;
      variables: Record<string, any>;
    }) => {
      return await ModelingWorkspace.createScenario(workbookId, name, description, variables);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workbooks", variables.workbookId] });
      toast.success("Scenario created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create scenario: ${error.message}`);
    },
  });
}

/**
 * Create a version snapshot
 */
export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workbookId, comment }: { workbookId: string; comment?: string }) => {
      return await ModelingWorkspace.createVersion(workbookId, comment);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workbooks", variables.workbookId] });
      toast.success("Version saved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save version: ${error.message}`);
    },
  });
}

/**
 * Share workbook with users
 */
export function useShareWorkbook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workbookId, userIds }: { workbookId: string; userIds: string[] }) => {
      return await ModelingWorkspace.shareWorkbook(workbookId, userIds);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workbooks", variables.workbookId] });
      toast.success("Workbook shared successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to share workbook: ${error.message}`);
    },
  });
}
