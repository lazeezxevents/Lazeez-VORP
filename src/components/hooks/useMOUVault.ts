import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type MOUDocumentType = "new" | "legacy";
export type MOUExtractionStatus = "pending" | "processing" | "completed" | "failed";
export type MOURevisionType = "amendment" | "renewal" | "termination";

export interface MOUVaultItem {
  id: string;
  vendor_id: string;
  mou_id: string | null;
  document_name: string;
  document_url: string;
  document_type: MOUDocumentType;
  signed_date: string | null;
  termination_notice_days: number;
  termination_deadline: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  extracted_terms: Record<string, unknown> | null;
  extraction_status: MOUExtractionStatus;
  extraction_confidence: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string } | null;
  // New fields
  has_auto_renewal?: boolean;
  renewal_period_days?: number;
  party_1_name?: string | null;
  party_1_business?: string | null;
  party_2_name?: string | null;
  party_2_business?: string | null;
  mou_purpose?: string | null;
  renewal_count?: number;
  last_renewal_date?: string | null;
  // Branching fields
  parent_vault_id?: string | null;
  version_number?: number;
}

export interface MOUVaultRevision {
  id: string;
  vault_id: string;
  revision_type: MOURevisionType;
  revision_date: string;
  notes: string | null;
  document_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateVaultItemInput {
  vendor_id: string;
  document_name: string;
  document_url: string;
  document_type: MOUDocumentType;
  mou_id?: string;
  parent_vault_id?: string;
  version_number?: number;
}

export interface UpdateVaultItemInput {
  id: string;
  signed_date?: string;
  termination_notice_days?: number;
  effective_start_date?: string;
  effective_end_date?: string;
  extracted_terms?: Record<string, unknown>;
  extraction_status?: MOUExtractionStatus;
  extraction_confidence?: number;
  has_auto_renewal?: boolean;
  renewal_period_days?: number;
  party_1_name?: string;
  party_1_business?: string;
  party_2_name?: string;
  party_2_business?: string;
  mou_purpose?: string;
}

export function useMOUVault() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mou-vault"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mou_vault")
        .select(`
          *,
          vendor:vendors(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as MOUVaultItem[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("mou-vault-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mou_vault",
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["mou-vault"] });

          if (payload.eventType === "INSERT") {
            toast.info("New MOU document uploaded");
          } else if (payload.eventType === "UPDATE") {
            const newData = payload.new as MOUVaultItem;
            if (newData.extraction_status === "completed") {
              toast.success("AI extraction completed", {
                description: newData.document_name,
              });
            } else if (newData.extraction_status === "failed") {
              toast.error("AI extraction failed", {
                description: newData.document_name,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useMOUVaultByVendor(vendorId?: string) {
  return useQuery({
    queryKey: ["mou-vault", "vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from("mou_vault")
        .select(`
          *,
          vendor:vendors(name)
        `)
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as MOUVaultItem[];
    },
    enabled: !!vendorId,
  });
}

export function useMOUVaultRevisions(vaultId?: string) {
  return useQuery({
    queryKey: ["mou-vault-revisions", vaultId],
    queryFn: async () => {
      if (!vaultId) return [];

      const { data, error } = await supabase
        .from("mou_vault_revisions")
        .select("*")
        .eq("vault_id", vaultId)
        .order("revision_date", { ascending: false });

      if (error) throw error;
      return data as MOUVaultRevision[];
    },
    enabled: !!vaultId,
  });
}

export function useUploadToVault() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateVaultItemInput) => {
      // Branching fields are now stored in database columns
      const { parent_vault_id, version_number, ...coreInput } = input;

      const { data, error } = await supabase
        .from("mou_vault")
        .insert({
          ...coreInput,
          parent_vault_id: parent_vault_id || null,
          version_number: version_number || 1,
          uploaded_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      toast.success("Document uploaded to vault");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}

export function useTriggerExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaultId, documentUrl }: { vaultId: string; documentUrl: string }) => {
      if (!isGroqConfigured()) {
        throw new Error("Groq API key missing. Please check your .env configuration.");
      }

      // First update status to processing
      await supabase
        .from("mou_vault")
        .update({ extraction_status: "processing" })
        .eq("id", vaultId);

      try {
        // 1. Fetch PDF content
        let pdfText = "";
        let arrayBuffer: ArrayBuffer;

        // Determine the storage path - documentUrl may be a bare path (e.g. "vendorId/123.pdf")
        // or a full Supabase public URL containing "/storage/v1/object/public/mou-vault/"
        let storagePath = documentUrl;
        if (documentUrl.includes('/storage/v1/object/public/mou-vault/')) {
          storagePath = decodeURIComponent(documentUrl.split('/storage/v1/object/public/mou-vault/')[1]);
        }

        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('mou-vault')
          .download(storagePath);

        if (downloadError) throw new Error(`Failed to download document: ${downloadError.message}`);
        arrayBuffer = await fileBlob.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          pdfText += pageText + "\n";
        }

        // 2. Groq Extraction Call
        const systemPrompt = `You are a Legal AI Assistant. Extract the key terms from the following MOU document text into a structured JSON format.

MANDATORY JSON STRUCTURE (fill missing with null):
{
  "signed_date": "YYYY-MM-DD or null",
  "effective_start_date": "YYYY-MM-DD or null",
  "effective_end_date": "YYYY-MM-DD or null",
  "termination_notice_days": number or 30,
  "has_auto_renewal": boolean,
  "renewal_period_days": number or null,
  "party_1_name": "string",
  "party_2_name": "string",
  "mou_purpose": "string summary"
}`;

        const jsonResult = await callGroq(systemPrompt, `Document Text:\n\n${pdfText.substring(0, 50000)}`, true);

        // Fetch vendor status if available
        let vendorStatus: string | null = null;
        let vendorUpdatedDate: string | null = null;

        const { data: vaultRecord } = await supabase
          .from("mou_vault")
          .select("vendor_id, vendor:vendors(status, updated_at)")
          .eq("id", vaultId)
          .single();

        if (vaultRecord?.vendor) {
          const v = vaultRecord.vendor as any;
          vendorStatus = v.status;
          vendorUpdatedDate = v.updated_at ? v.updated_at.split("T")[0] : null;
        }

        // Determine effective end date (if vendor is terminated/left, force end date to termination date)
        let finalEndDate = jsonResult.effective_end_date || null;
        if ((vendorStatus === "terminated" || vendorStatus === "left") && vendorUpdatedDate) {
          finalEndDate = vendorUpdatedDate;
        }

        // 3. Update the vault record with extracted data
        const { error: updateError } = await supabase
          .from("mou_vault")
          .update({
            extraction_status: "completed",
            extraction_confidence: 1.0, // 100% confidence
            signed_date: jsonResult.signed_date || null,
            effective_start_date: jsonResult.effective_start_date || null,
            effective_end_date: finalEndDate,
            termination_notice_days: jsonResult.termination_notice_days || 30,
            has_auto_renewal: jsonResult.has_auto_renewal || false,
            renewal_period_days: jsonResult.renewal_period_days || null,
            party_1_name: jsonResult.party_1_name || null,
            party_2_name: jsonResult.party_2_name || null,
            mou_purpose: jsonResult.mou_purpose || null,
            extracted_terms: { ...jsonResult, vendor_status_at_extraction: vendorStatus }
          })
          .eq("id", vaultId);

        if (updateError) throw updateError;

        return { success: true };

      } catch (err: any) {
        // Failed extraction fallback
        await supabase
          .from("mou_vault")
          .update({ extraction_status: "failed" })
          .eq("id", vaultId);

        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      toast.info("AI extraction started");
    },
    onError: (error: Error) => {
      toast.error(`Failed to start extraction: ${error.message}`);
    },
  });
}

export function useUpdateVaultItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateVaultItemInput) => {
      // Calculate termination deadline if dates are provided
      const updateData: Record<string, unknown> = { ...input };

      if (input.effective_end_date && input.termination_notice_days) {
        const endDate = new Date(input.effective_end_date);
        const deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() - input.termination_notice_days);
        updateData.termination_deadline = deadline.toISOString().split("T")[0];
      }

      const { data, error } = await supabase
        .from("mou_vault")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      toast.success("Vault item updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useRenewMOU() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      vaultId,
      notes,
      renewalPeriodDays
    }: {
      vaultId: string;
      notes?: string;
      renewalPeriodDays: number;
    }) => {
      // Get current vault item
      const { data: vaultItem, error: fetchError } = await supabase
        .from("mou_vault")
        .select("*")
        .eq("id", vaultId)
        .single();

      if (fetchError || !vaultItem) throw new Error("Vault item not found");

      const currentEndDate = vaultItem.effective_end_date
        ? new Date(vaultItem.effective_end_date)
        : new Date();

      const newEndDate = addDays(currentEndDate, renewalPeriodDays);
      const newTerminationDeadline = addDays(newEndDate, -(vaultItem.termination_notice_days || 90));

      // Update the vault item
      const { error: updateError } = await supabase
        .from("mou_vault")
        .update({
          effective_end_date: newEndDate.toISOString().split("T")[0],
          termination_deadline: newTerminationDeadline.toISOString().split("T")[0],
          renewal_count: (vaultItem.renewal_count || 0) + 1,
          last_renewal_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", vaultId);

      if (updateError) throw updateError;

      // Create a revision record
      const { error: revisionError } = await supabase
        .from("mou_vault_revisions")
        .insert({
          vault_id: vaultId,
          revision_type: "renewal",
          revision_date: new Date().toISOString().split("T")[0],
          notes: notes || `Renewed for ${renewalPeriodDays} days`,
          created_by: user!.id,
        });

      if (revisionError) throw revisionError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      queryClient.invalidateQueries({ queryKey: ["mou-vault-revisions"] });
      toast.success("MOU renewed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to renew: ${error.message}`);
    },
  });
}

export function useTerminateMOU() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      vaultId,
      vendorId,
      notes
    }: {
      vaultId: string;
      vendorId: string;
      notes?: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];

      // 1. Update MOU Vault item
      const { error: vaultError } = await supabase
        .from("mou_vault")
        .update({
          effective_end_date: today,
          extraction_status: "completed",
        })
        .eq("id", vaultId);

      if (vaultError) throw vaultError;

      // 2. Update Vendor status in Vendor Directory to 'left'
      if (vendorId) {
        const { error: vendorError } = await supabase
          .from("vendors")
          .update({
            status: "left",
            updated_at: new Date().toISOString(),
          })
          .eq("id", vendorId);

        if (vendorError) console.error("Failed to update vendor status:", vendorError);
      }

      // 3. Create revision record
      const { error: revisionError } = await supabase
        .from("mou_vault_revisions")
        .insert({
          vault_id: vaultId,
          revision_type: "termination",
          revision_date: today,
          notes: notes || "MOU terminated and vendor status set to Left",
          created_by: user?.id,
        });

      if (revisionError) console.error("Failed to log termination revision:", revisionError);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("MOU Terminated & Vendor status set to Left");
    },
    onError: (error: Error) => {
      toast.error(`Failed to terminate MOU: ${error.message}`);
    },
  });
}

export function useAddRevision() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      vaultId,
      revisionType,
      notes,
      documentUrl,
    }: {
      vaultId: string;
      revisionType: MOURevisionType;
      notes?: string;
      documentUrl?: string;
    }) => {
      const { data, error } = await supabase
        .from("mou_vault_revisions")
        .insert({
          vault_id: vaultId,
          revision_type: revisionType,
          revision_date: new Date().toISOString().split("T")[0],
          notes,
          document_url: documentUrl,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault-revisions"] });
      toast.success("Revision recorded");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add revision: ${error.message}`);
    },
  });
}

export function useDeleteVaultItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mou_vault")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mou-vault"] });
      toast.success("Document removed from vault");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}
