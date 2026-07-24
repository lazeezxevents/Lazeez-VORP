import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateIssue, useUpdateIssue, Issue, IssuePriority, IssueStatus } from "@/hooks/useIssues";
import { useVendors } from "@/hooks/useVendors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const issueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  vendor_id: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  project_id: z.string().optional(),
  project_task_id: z.string().optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;

interface IssueFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: Issue | null;
}

const priorities: { value: IssuePriority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statuses: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function IssueForm({ open, onOpenChange, issue }: IssueFormProps) {
  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();
  const { data: vendors } = useVendors();
  const { user, profile, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreateTask = hasPermission(PERMISSIONS.ISSUES.CREATE_TASK);
  const { data: employees = [] } = useQuery({
    queryKey: ["issue-assignees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["issue-projects"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("projects") as any).select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const isEditing = !!issue;
  const assignedBy = issue?.reporter?.full_name || issue?.reporter?.email || profile?.full_name || user?.email || "Current user";

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    values: {
      title: issue?.title || "",
      description: issue?.description || "",
      vendor_id: issue?.vendor_id || "none",
      priority: issue?.priority || "medium",
      status: issue?.status || "open",
      due_date: issue?.due_date ? issue.due_date.split("T")[0] : "",
      assigned_to: issue?.assigned_to || "none",
      project_id: issue?.project_id || "none",
      project_task_id: issue?.project_task_id || "none",
    },
  });
  const selectedProjectId = form.watch("project_id");
  const { data: projectTasks = [] } = useQuery({
    queryKey: ["issue-project-tasks", selectedProjectId],
    enabled: !!selectedProjectId && selectedProjectId !== "none",
    queryFn: async () => {
      const { data, error } = await (supabase.from("project_tasks") as any)
        .select("id, title, project_id, assigned_to")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const onSubmit = async (data: IssueFormData) => {
    const vendorId = data.vendor_id === "none" ? (isEditing ? null : undefined) : data.vendor_id;
    const assigneeId = data.assigned_to === "none" ? (isEditing ? null : undefined) : data.assigned_to;
    const projectId = data.project_id === "none" ? (isEditing ? null : undefined) : data.project_id;
    const taskId = data.project_task_id === "none" ? (isEditing ? null : undefined) : data.project_task_id;
    if (isEditing) {
      await updateIssue.mutateAsync({ 
        id: issue.id, 
        title: data.title,
        description: data.description || undefined,
        vendor_id: vendorId,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date || undefined,
        assigned_to: assigneeId,
        project_id: projectId,
        project_task_id: taskId,
      });
    } else {
      await createIssue.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        vendor_id: vendorId,
        priority: data.priority,
        due_date: data.due_date || undefined,
        assigned_to: assigneeId,
        project_id: projectId,
        project_task_id: taskId,
      });
    }
    onOpenChange(false);
    form.reset();
  };

  const isLoading = createIssue.isPending || updateIssue.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Issue" : "Report New Issue"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Vendor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No vendor</SelectItem>
                        {vendors?.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.full_name || employee.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select project</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); form.setValue("project_task_id", "none"); }} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((project: { id: string; name: string }) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_task_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>Project task (optional)</FormLabel>
                      {selectedProjectId !== "none" && canCreateTask && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => {
                            const taskTitle = prompt("Enter task title:");
                            if (taskTitle && selectedProjectId !== "none") {
                              (supabase.from("project_tasks") as any).insert({
                                project_id: selectedProjectId,
                                title: taskTitle,
                                assigned_to: form.getValues("assigned_to") === "none" ? null : form.getValues("assigned_to"),
                              }).select().single().then(({ data }) => {
                                if (data) {
                                  form.setValue("project_task_id", data.id);
                                  queryClient.invalidateQueries({ queryKey: ["issue-project-tasks", selectedProjectId] });
                                }
                              });
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Select onValueChange={field.onChange} value={field.value} disabled={selectedProjectId === "none"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={selectedProjectId === "none" ? "Choose a project first" : "Select project task"} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No linked task</SelectItem>
                        {projectTasks.map((task: { id: string; title: string }) => (
                          <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Assigned by</FormLabel>
                <FormControl>
                  <Input value={assignedBy} readOnly className="bg-muted/50 text-muted-foreground" />
                </FormControl>
              </FormItem>

              {isEditing && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed description of the issue..."
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Update Issue" : "Create Issue"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
