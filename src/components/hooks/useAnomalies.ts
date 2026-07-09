import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnomalyDetector, AnomalySeverity, AnomalyStatus, AnomalyType } from "@/services/AnomalyDetector";
import { toast } from "sonner";

/**
 * Fetch all anomalies with optional filters
 */
export function useAnomalies(filters?: {
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  type?: AnomalyType;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["anomalies", filters],
    queryFn: async () => {
      return await AnomalyDetector.getAnomalies(filters);
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Detect anomalies in recent transactions
 */
export function useDetectAnomalies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await AnomalyDetector.detectAnomalies();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      if (data.length > 0) {
        toast.success(`Detected ${data.length} anomalies`);
      } else {
        toast.info("No anomalies detected");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to detect anomalies: ${error.message}`);
    },
  });
}

/**
 * Auto-detect and record anomalies
 */
export function useAutoDetectAnomalies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await AnomalyDetector.autoDetectAndRecord();
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      if (count > 0) {
        toast.success(`Detected and recorded ${count} anomalies`);
      } else {
        toast.info("No new anomalies detected");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to auto-detect anomalies: ${error.message}`);
    },
  });
}

/**
 * Analyze a specific transaction for anomalies
 */
export function useAnalyzeTransaction() {
  return useMutation({
    mutationFn: async (transactionId: string) => {
      return await AnomalyDetector.analyzeTransaction(transactionId);
    },
    onSuccess: (result) => {
      if (result.isAnomaly) {
        toast.warning(`Anomaly detected: ${result.description}`);
      } else {
        toast.success("No anomaly detected");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to analyze transaction: ${error.message}`);
    },
  });
}

/**
 * Update anomaly status
 */
export function useUpdateAnomalyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      anomalyId,
      status,
      investigatedBy,
      resolutionNotes,
    }: {
      anomalyId: string;
      status: AnomalyStatus;
      investigatedBy?: string;
      resolutionNotes?: string;
    }) => {
      return await AnomalyDetector.updateAnomalyStatus(anomalyId, status, investigatedBy, resolutionNotes);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      toast.success(`Anomaly marked as ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update anomaly status: ${error.message}`);
    },
  });
}

/**
 * Get anomaly statistics
 */
export function useAnomalyStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["anomaly-stats", startDate, endDate],
    queryFn: async () => {
      return await AnomalyDetector.getAnomalyStats(startDate, endDate);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get open anomalies (for alerts)
 */
export function useOpenAnomalies() {
  return useQuery({
    queryKey: ["anomalies", "open"],
    queryFn: async () => {
      return await AnomalyDetector.getAnomalies({ status: "open" });
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Get critical anomalies (for urgent alerts)
 */
export function useCriticalAnomalies() {
  return useQuery({
    queryKey: ["anomalies", "critical"],
    queryFn: async () => {
      return await AnomalyDetector.getAnomalies({ severity: "critical", status: "open" });
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}
