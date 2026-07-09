import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyHRInvitationSent } from "@/components/utils/notifications";

interface CreateInvitationInput {
  email: string;
  departmentId: string;
  roleId: string;
}

export function useInvitations() {
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_invitations")
        .select(`
          *,
          designation:role_id(display_name),
          department:department_id(name),
          inviter:invited_by(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createInvitation = useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      // Generate secure token
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("employee_invitations")
        .insert({
          email: input.email,
          department_id: input.departmentId,
          role_id: input.roleId,
          invitation_token: token,
          invited_by: userData?.user?.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to HR staff
      if (userData?.user?.id) {
        await notifyHRInvitationSent(userData.user.id, input.email);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create invitation");
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      // Generate new token
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      
      // Extend expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from("employee_invitations")
        .update({
          invitation_token: token,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation resent successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  const revokeInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("employee_invitations")
        .update({ status: 'revoked' })
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation revoked successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });

  return {
    invitations,
    isLoading,
    error,
    createInvitation: createInvitation.mutate,
    resendInvitation: resendInvitation.mutate,
    revokeInvitation: revokeInvitation.mutate,
    isCreating: createInvitation.isPending,
    isResending: resendInvitation.isPending,
    isRevoking: revokeInvitation.isPending,
  };
}
