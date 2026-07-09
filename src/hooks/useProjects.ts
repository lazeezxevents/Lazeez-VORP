import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: 'planning' | 'active' | 'completed' | 'on_hold';
    vendor_id: string | null;
    created_by: string;
    manager_id: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    key_prefix: string;
    next_key_number: number;
    vendors?: { name: string } | null;
    manager?: { full_name: string | null; email: string } | null;
}

export interface ProjectTask {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high' | 'critical';
    issue_type: 'epic' | 'story' | 'task' | 'subtask' | 'bug';
    issue_key: string | null;
    parent_id: string | null;
    assigned_to: string | null;
    sprint_id: string | null;
    milestone_id: string | null;
    created_by: string;
    start_date: string | null;
    due_date: string | null;
    order_index: number;
    estimated_hours: number;
    actual_hours: number;
    labels: string[];
    created_at: string;
    updated_at: string;
    assignee?: { full_name: string | null; email: string } | null;
    subtasks?: ProjectTask[];
    links?: { id: string; target_id: string; link_type: string; target?: ProjectTask }[];
}

export function useProjects() {
    const queryClient = useQueryClient();
    const { user, isAdmin, isStaff } = useAuth();

    // Fetch all projects
    const { data: projects = [], isLoading: isProjectsLoading } = useQuery({
        queryKey: ["projects"],
        queryFn: async () => {
            if (!user) return [];

            let query = supabase
                .from("projects")
                .select("*, vendors(name)")
                .order("created_at", { ascending: false });

            // Only admins see EVERYTHING. 
            // Others (including managers/staff) only see projects where they are manager or assigned.
            if (!isAdmin) {
                // First get project IDs where user has tasks
                const { data: taskProjects } = await supabase
                    .from("project_tasks")
                    .select("project_id")
                    .eq("assigned_to", user.id);

                const assignedProjectIds = (taskProjects || []).map(tp => tp.project_id);

                // Construct filter: manager_id = user.id OR id is in assignedProjectIds
                if (assignedProjectIds.length > 0) {
                    query = query.or(`manager_id.eq.${user.id},id.in.(${assignedProjectIds.join(',')})`);
                } else {
                    query = query.eq('manager_id', user.id);
                }
            }

            const [projectsRes, profilesRes] = await Promise.all([
                query,
                supabase
                    .from("profiles")
                    .select("id, full_name, email"),
            ]);

            if (projectsRes.error) throw projectsRes.error;
            const profiles = profilesRes.data || [];

            // Merge manager profile info
            return (projectsRes.data || []).map((p: any) => ({
                ...p,
                manager: p.manager_id
                    ? profiles.find(pr => pr.id === p.manager_id) || null
                    : null,
            })) as Project[];
        },
        enabled: !!user,
    });

    // Create Project
    const createProject = useMutation({
        mutationFn: async (newProject: Partial<Project>) => {
            const { data, error } = await supabase
                .from("projects")
                .insert({ ...newProject, created_by: user?.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Project created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create project: ${error.message}`);
        },
    });

    // Update Project
    const updateProject = useMutation({
        mutationFn: async (updates: Partial<Project> & { id: string }) => {
            const { id, vendors, manager, ...rest } = updates as any;
            const { error } = await supabase
                .from("projects")
                .update(rest)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Project updated");
        },
        onError: (error: Error) => {
            toast.error(`Failed to update project: ${error.message}`);
        },
    });

    // Delete Project
    const deleteProject = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("projects").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Project deleted");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete project: ${error.message}`);
        },
    });

    return { projects, isProjectsLoading, createProject, updateProject, deleteProject };
}

export function useProjectTasks(projectId?: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Fetch tasks for a specific project
    const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
        queryKey: ["project-tasks", projectId],
        queryFn: async () => {
            if (!projectId) return [];

            const [tasksRes, profilesRes, linksRes] = await Promise.all([
                supabase
                    .from("project_tasks")
                    .select("*")
                    .eq("project_id", projectId)
                    .order("order_index", { ascending: true }),
                supabase
                    .from("profiles")
                    .select("id, full_name, email"),
                supabase
                    .from("issue_links")
                    .select("*")
            ]);

            if (tasksRes.error) throw tasksRes.error;
            const profiles = profilesRes.data || [];
            const links = linksRes?.data || [];
            const allTasks = (tasksRes.data || []).map((t: any) => ({
                ...t,
                assignee: t.assigned_to
                    ? profiles.find(p => p.id === t.assigned_to) || null
                    : null,
            })) as ProjectTask[];

            // Hydrate links and subtasks
            return allTasks.map(t => ({
                ...t,
                subtasks: allTasks.filter(st => st.parent_id === t.id),
                links: links
                    .filter(l => l.source_id === t.id)
                    .map(l => ({
                        ...l,
                        target: allTasks.find(at => at.id === l.target_id)
                    }))
            }));
        },
        enabled: !!projectId,
    });

    // Real-time subscription for live task updates
    useEffect(() => {
        if (!projectId) return;

        const tasksChannel = supabase
            .channel(`project-tasks-${projectId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "project_tasks",
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
                }
            )
            .subscribe();

        const linksChannel = supabase
            .channel(`issue-links-${projectId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "issue_links",
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(linksChannel);
        };
    }, [projectId, queryClient]);

    // Create Task
    const createTask = useMutation({
        mutationFn: async (newTask: Partial<ProjectTask>) => {
            const maxOrder = tasks.length > 0
                ? Math.max(...tasks.map(t => t.order_index)) + 1
                : 0;

            const { data, error } = await supabase
                .from("project_tasks")
                .insert({
                    ...newTask,
                    project_id: projectId,
                    created_by: user?.id,
                    order_index: maxOrder,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
            toast.success("Task added");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create task: ${error.message}`);
        },
    });

    // Update Task Status/Order
    const updateTask = useMutation({
        mutationFn: async (updates: Partial<ProjectTask> & { id: string }) => {
            const { assignee, ...rest } = updates as any;
            const { error } = await supabase
                .from("project_tasks")
                .update(rest)
                .eq("id", updates.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
        },
    });

    // Delete Task
    const deleteTask = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("project_tasks").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
            toast.success("Task deleted");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete task: ${error.message}`);
        },
    });

    // Link Issues
    const linkIssues = useMutation({
        mutationFn: async ({ source_id, target_id, link_type }: { source_id: string; target_id: string; link_type: string }) => {
            const { error } = await supabase
                .from("issue_links")
                .insert({ source_id, target_id, link_type });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
            toast.success("Issues linked");
        },
    });

    // Unlink Issues
    const unlinkIssues = useMutation({
        mutationFn: async (linkId: string) => {
            const { error } = await supabase.from("issue_links").delete().eq("id", linkId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
            toast.success("Link removed");
        },
    });

    return { tasks, isTasksLoading, createTask, updateTask, deleteTask, linkIssues, unlinkIssues };
}
