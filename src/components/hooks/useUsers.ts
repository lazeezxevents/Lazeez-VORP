import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type AppRole = "admin" | "ops_manager" | "employee";

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  department_id: string | null;
  designation_id: string | null;
  designation?: { name: string } | null;
  role: AppRole | null;
  custom_role_id?: string | null;
  created_at: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  description: string | null;
  head_id: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  business_unit_id: string | null;
  created_at: string;
}

export interface Designation {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  main_role: 'admin' | 'manager' | 'employee';
  department_id?: string | null;
  permissions?: Record<string, boolean>;
}

export interface EmployeeVendorAssignment {
  id: string;
  employee_id: string;
  vendor_id: string;
  assigned_by: string | null;
  assigned_at: string;
  vendor?: { id: string; name: string };
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch designations
      const { data: designations } = await supabase
        .from("designations")
        .select("id, name");

      // Merge profiles with roles and designations
      const usersWithRoles = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        const p = profile as any;
        const designation = designations?.find((d) => d.id === p.designation_id);
        return {
          ...profile,
          department_id: p.department_id,
          role: userRole?.role as AppRole | null,
          designation: designation ? { name: designation.name } : null,
        } as UserWithRole;
      });

      return usersWithRoles;
    },
  });
}

export function useCustomRoles() {
  return useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("custom_roles" as any) as any)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as CustomRole[];
    },
  });
}

export function useDesignations() {
  return useQuery({
    queryKey: ["custom-roles"],  // Updated cache key
    queryFn: async () => {
      const { data, error } = await (supabase.from("custom_roles" as any) as any)
        .select("id, name, display_name, description, main_role")
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data as CustomRole[];
    },
  });
}

export function useBusinessUnits() {
  return useQuery({
    queryKey: ["business-units"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("business_units" as any) as any)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as BusinessUnit[];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("departments" as any) as any)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Department[];
    },
  });
}

export function useCreateDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("designations")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      toast.success("Designation created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create designation: ${error.message}`);
    },
  });
}

export function useDeleteDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("designations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      toast.success("Designation deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete designation: ${error.message}`);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole | string }) => {
      const isBaseRole = ["admin", "ops_manager", "employee"].includes(role);

      if (isBaseRole) {
        // Base role: clear custom_role_id, set user_roles.role
        await supabase.from("profiles").update({ custom_role_id: null } as any).eq("id", userId);

        const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
          if (error) throw error;
        }
      } else {
        // Custom role UUID: set custom_role_id, set user_roles.role to 'employee' (base access)
        const { error: profileError } = await supabase.from("profiles").update({ custom_role_id: role } as any).eq("id", userId);
        if (profileError) throw profileError;

        const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("user_roles").update({ role: "employee" as any }).eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "employee" as any });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User role updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      ...updates
    }: {
      userId: string;
      full_name?: string;
      phone?: string;
      department?: string;
      department_id?: string | null;
      designation_id?: string | null;
      avatar_url?: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
}

export function useEmployeeVendorAssignments(employeeId?: string) {
  return useQuery({
    queryKey: ["employee-vendor-assignments", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("employee_vendor_assignments")
        .select(`
          *,
          vendor:vendors(id, name)
        `)
        .eq("employee_id", employeeId)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data as EmployeeVendorAssignment[];
    },
    enabled: !!employeeId,
  });
}

export function useAssignVendorToEmployee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      employeeId,
      vendorId,
    }: {
      employeeId: string;
      vendorId: string;
    }) => {
      const { error } = await supabase.from("employee_vendor_assignments").insert({
        employee_id: employeeId,
        vendor_id: vendorId,
        assigned_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vendor-assignments"] });
      toast.success("Vendor assigned successfully");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("This vendor is already assigned to this employee");
      } else {
        toast.error(`Failed to assign vendor: ${error.message}`);
      }
    },
  });
}

export function useRemoveVendorAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("employee_vendor_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vendor-assignments"] });
      toast.success("Vendor assignment removed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove assignment: ${error.message}`);
    },
  });
}

export function useManagers() {
  return useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      // Fetch users with manager or admin roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "ops_manager"]);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      const managerIds = roles.map(r => r.user_id);

      // Fetch profiles for these managers
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department, department_id")
        .in("id", managerIds)
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      return profiles || [];
    },
  });
}

