import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type AppRole = "admin" | "ops_manager" | "employee";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  department_id: string | null;
  designation_id: string | null;
  is_approved: boolean;
  admin_approved_by?: string | null;
  admin_approved_at?: string | null;
  hr_approved_by?: string | null;
  hr_approved_at?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isManager: boolean;
  isApproved: boolean;
  permissions: string[];
  hasPermission: (slug: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, departmentId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileOptimistic: (updates: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const initialFetchDone = useRef(false);
  const fetchInProgress = useRef(false);
  const isManagerRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Get the initial session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Immediate override for Master Admin for speed
          if (currentSession.user.email === "highypestudio@gmail.com") {
            setRole("admin");
          }
          await fetchUserData(currentSession.user.id);
          initialFetchDone.current = true;
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (mounted) setIsLoading(false);
      }
    }

    initializeAuth();

    // Set up auth state listener - only handle CHANGES after initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Skip INITIAL_SESSION - we already handle it in initializeAuth
        if (event === "INITIAL_SESSION") return;

        console.log("Auth event:", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid state update conflicts
          setTimeout(async () => {
            if (mounted) {
              await fetchUserData(newSession.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    // Absolute safety timeout - 8s max wait before forcing progress
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Force role synchronization for Master Admin
  useEffect(() => {
    if (user?.email === "highypestudio@gmail.com") {
      if (role !== "admin") {
        setRole("admin");
      }
      if (profile && !profile.is_approved) {
        setProfile(prev => prev ? { ...prev, is_approved: true } : null);
      }
    }
  }, [user, role, profile]);

  async function fetchUserData(userId: string) {
    if (!userId || fetchInProgress.current) return;
    fetchInProgress.current = true;

    try {
      // Fetch Profile and Role in parallel for speed
      const profilePromise = supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const rolePromise = supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      const deptPromise = (supabase.from("departments" as any) as any).select("id").eq("manager_id", userId).limit(1);

      const [profileResult, roleResult, deptResult] = await Promise.all([
        profilePromise,
        rolePromise,
        deptPromise
      ]);

      let userProfile = null;
      if (profileResult.data) {
        userProfile = profileResult.data as unknown as Profile;
        setProfile(userProfile);
      }

      let userRole: AppRole | null = null;
      if (roleResult.data) {
        userRole = roleResult.data.role as AppRole;
        setRole(userRole);
      }

      // Check for manager role
      if (deptResult.data && deptResult.data.length > 0) {
        isManagerRef.current = true;
      } else {
        isManagerRef.current = false;
      }

      // MASTER ADMIN OVERRIDE
      const activeEmail = profileResult.data?.email;
      const isMasterAdmin = activeEmail === "highypestudio@gmail.com";
      if (isMasterAdmin) {
        setRole("admin");
        userRole = "admin";
        if (profileResult.data) {
          setProfile(prev => prev ? { ...prev, is_approved: true } : null);
        }
      }

      // Fetch Permissions
      if (userRole === "admin") {
        // Admins get everything - we can just fetch all slugs or handle it in hasPermission
        const { data: allPerms } = await supabase.from("app_permissions").select("slug");
        if (allPerms) setPermissions(allPerms.map(p => p.slug));
      } else if (userProfile?.designation_id || (userProfile as any).custom_role_id) {
        const customRoleId = (userProfile as any).custom_role_id || userProfile?.designation_id;
        if (customRoleId) {
          const { data: rolePerms } = await supabase
            .from("role_permissions")
            .select("app_permissions(slug)")
            .eq("role_id", customRoleId);
          
          if (rolePerms) {
            const slugs = (rolePerms as any[]).map(rp => rp.app_permissions?.slug).filter(Boolean);
            setPermissions(slugs);
          }
        }
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error("Unexpected error in fetchUserData:", error);
    } finally {
      fetchInProgress.current = false;
      setIsLoading(false);
    }
  }

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setIsLoading(false);
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, departmentId?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          department_id: departmentId,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      queryClient.clear();
    } catch (error) {
      console.error("Supabase signOut error:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.removeItem("supabase.auth.token");

      try {
        const dbs = await window.indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (e) {
        console.warn("IndexedDB clear failed", e);
      }

      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);

      window.location.assign("/");
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      fetchInProgress.current = false; // Allow re-fetch
      await fetchUserData(user.id);
    }
  };

  const updateProfileOptimistic = (updates: Partial<Profile>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const isMasterAdmin = user?.email === "highypestudio@gmail.com";
  const isHR = role === "admin" || profile?.department === "HR" || isMasterAdmin;
  const isManager = role === "admin" || role === "ops_manager" || isManagerRef.current;
  const isStaff = isManager || isHR || isMasterAdmin;
  const isAdmin = role === "admin" || isMasterAdmin;
  const isApproved = (profile?.is_approved ?? false) || isMasterAdmin;

  const hasPermission = (slug: string) => {
    if (isAdmin) return true;
    
    // Check for exact permission match
    if (permissions.includes(slug)) return true;
    
    // Check for wildcard permissions
    // Format: module.resource.action
    const parts = slug.split('.');
    if (parts.length < 2) return false;
    
    const [module, resource, action] = parts;
    
    // Check for full wildcard (*.*.*)
    if (permissions.includes('*.*.*')) return true;
    
    // Check for module wildcard (e.g., vendors.*.*)
    if (permissions.includes(`${module}.*.*`)) return true;
    
    // Check for resource wildcard (e.g., vendors.payments.*)
    if (resource && permissions.includes(`${module}.${resource}.*`)) return true;
    
    // Check for module-level wildcard (e.g., vendors.*)
    if (permissions.includes(`${module}.*`)) return true;
    
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isStaff,
        isAdmin,
        isHR,
        isManager,
        isApproved,
        permissions,
        hasPermission,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfileOptimistic,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
