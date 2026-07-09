import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  VendorFinancialProfile,
  CreateVendorFinancialProfileInput,
  UpdateVendorFinancialProfileInput,
} from "@/components/finance/types";

/**
 * Custom hook for managing vendor financial profiles
 * 
 * Provides:
 * - Query for fetching vendor profile
 * - Mutation for creating profile
 * - Mutation for updating profile
 * - Mutation for updating commission rules
 * 
 * Requirements: 3.7, 6.9
 */

// Query key factory
const vendorProfileKeys = {
  all: ['vendor-financial-profiles'] as const,
  byVendor: (vendorId: string) => [...vendorProfileKeys.all, vendorId] as const,
};

/**
 * Fetch vendor financial profile by vendor ID
 */
export function useVendorFinancialProfile(vendorId: string | undefined) {
  return useQuery({
    queryKey: vendorProfileKeys.byVendor(vendorId || ''),
    queryFn: async () => {
      if (!vendorId) return null;

      const { data, error } = await supabase
        .from('finance_vendor_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is okay
          return null;
        }
        throw error;
      }

      return data as VendorFinancialProfile;
    },
    enabled: !!vendorId,
  });
}

/**
 * Create vendor financial profile
 */
export function useCreateVendorFinancialProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVendorFinancialProfileInput) => {
      const { data, error } = await supabase
        .from('finance_vendor_profiles')
        .insert({
          vendor_id: input.vendor_id,
          commission_model: input.commission_model || 'percentage',
          commission_rate: input.commission_rate || null,
          commission_rules: input.commission_rules || {},
          subscription_status: input.subscription_status || 'active',
          threshold_limit: input.threshold_limit || null,
          payment_terms: input.payment_terms || null,
          preferred_payment_method: input.preferred_payment_method || null,
          bank_details: input.bank_details || null,
          tax_id: input.tax_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as VendorFinancialProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vendorProfileKeys.byVendor(data.vendor_id) });
      toast.success("Vendor financial profile created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating vendor financial profile:", error);
      toast.error(`Failed to create profile: ${error.message}`);
    },
  });
}

/**
 * Update vendor financial profile
 */
export function useUpdateVendorFinancialProfile(vendorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateVendorFinancialProfileInput) => {
      const { data, error } = await supabase
        .from('finance_vendor_profiles')
        .update(input)
        .eq('vendor_id', vendorId)
        .select()
        .single();

      if (error) throw error;
      return data as VendorFinancialProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vendorProfileKeys.byVendor(data.vendor_id) });
      toast.success("Vendor financial profile updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating vendor financial profile:", error);
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
}

/**
 * Initialize vendor financial profile with defaults
 */
export function useInitializeVendorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { data, error } = await supabase
        .rpc('initialize_vendor_financial_profile', {
          p_vendor_id: vendorId,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vendorId) => {
      queryClient.invalidateQueries({ queryKey: vendorProfileKeys.byVendor(vendorId) });
      toast.success("Vendor financial profile initialized");
    },
    onError: (error: Error) => {
      console.error("Error initializing vendor profile:", error);
      toast.error(`Failed to initialize profile: ${error.message}`);
    },
  });
}
