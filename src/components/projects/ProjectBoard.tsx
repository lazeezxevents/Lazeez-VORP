import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { useProjects, useProjectTasks, Project, ProjectTask } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useVendors } from "@/hooks/useVendors";
import { useSprints, useMilestones, useActivityFeed, useWorkloadTracking } from "@/hooks/usePMSystem";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
    Plus, Search, MoreVertical, Clock, User, Briefcase, ChevronDown,
    Loader2, Trash2, CalendarDays, Flag, Building2, BarChart3,
    CheckCircle2, AlertTriangle, Users, Zap, Target, Activity,
    ArrowRight, Timer, TrendingUp, List, Link as LinkIcon, ExternalLink,
    LineChart, Edit3, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast } from "date-fns";

// ─── Column Config ───────────────────────────────────────────
const COLUMNS = [
    { id: 'todo', label: 'To Do', dotColor: 'bg-slate-400', bg: 'bg-slate-50/80 border-slate-200' },
    { id: 'in_progress', label: 'In Progress', dotColor: 'bg-blue-500', bg: 'bg-blue-50/80 border-blue-200' },
    { id: 'review', label: 'Review', dotColor: 'bg-amber-500', bg: 'bg-amber-50/80 border-amber-200' },
    { id: 'done', label: 'Done', dotColor: 'bg-emerald-500', bg: 'bg-emerald-50/80 border-emerald-200' },
] as const;

const PRIORITY_STYLES: Record<string, string> = {
    critical: 'border-red-300 text-red-700 bg-red-50',
    high: 'border-amber-300 text-amber-700 bg-amber-50',
    medium: 'border-blue-300 text-blue-700 bg-blue-50',
    low: 'border-slate-200 text-slate-600 bg-slate-50',
};

const STATUS_COLORS: Record<string, string> = {
    planning: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
};

const ISSUE_TYPE_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
    epic: { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    story: { icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    task: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    bug: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    subtask: { icon: ArrowRight, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

export default function ProjectBoard() {
    const { user, isStaff } = useAuth();
    const { projects, isProjectsLoading, createProject, updateProject, deleteProject } = useProjects();
    const { data: allUsers = [] } = useUsers();
    const { data: vendors = [] } = useVendors();
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const { tasks, isTasksLoading, createTask, updateTask, deleteTask } = useProjectTasks(selectedProjectId || undefined);
    const { sprints, createSprint, updateSprint, deleteSprint } = useSprints(selectedProjectId || undefined);
    const { milestones, createMilestone, updateMilestone } = useMilestones(selectedProjectId || undefined);
    const { data: activityFeed = [] } = useActivityFeed({ projectId: selectedProjectId || undefined, limit: 50 });
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("board");
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
    const [createSprintOpen, setCreateSprintOpen] = useState(false);
    const [createMilestoneOpen, setCreateMilestoneOpen] = useState(false);
    const [newSprintData, setNewSprintData] = useState({ name: "", goal: "", start_date: "", end_date: "" });
    const [newMilestoneData, setNewMilestoneData] = useState({ name: "", description: "", target_date: "" });
    const [linkData, setLinkData] = useState({ target_id: "", link_type: "relates_to" });
    const { linkIssues, unlinkIssues } = useProjectTasks(selectedProjectId || undefined);

    // Dialog States
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [createTaskOpen, setCreateTaskOpen] = useState(false);
    const [newProjectData, setNewProjectData] = useState({
        name: "", description: "", vendor_id: "", status: "planning" as Project['status'],
        start_date: "", end_date: "", manager_id: "", key_prefix: "LAZ"
    });
    const [newTaskData, setNewTaskData] = useState({
        title: "", description: "", priority: "medium" as ProjectTask['priority'],
        assigned_to: "", due_date: "", status: "todo" as ProjectTask['status'],
        issue_type: "task" as ProjectTask['issue_type'], parent_id: "" as string | null,
        sprint_id: "" as string | null, milestone_id: "" as string | null,
        start_date: ""
    });
    const [selectedSprintId, setSelectedSprintId] = useState<string | "all">("all");
    const [selectedPriority, setSelectedPriority] = useState<string | "all">("all");
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | "all">("all");
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);

    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        let baseTasks = tasks;
        // Filter out sub-tasks from main board/backlog (they show in detail view)
        if (activeTab === 'board' || activeTab === 'backlog') {
            baseTasks = tasks.filter(t => t.issue_type !== 'subtask');
        }

        if (activeTab === 'board' && selectedSprintId !== 'all') {
            baseTasks = baseTasks.filter(t => t.sprint_id === selectedSprintId);
        }

        if (selectedPriority !== 'all') {
            baseTasks = baseTasks.filter(t => t.priority === selectedPriority);
        }

        if (selectedAssigneeId !== 'all') {
            baseTasks = baseTasks.filter(t => t.assigned_to === (selectedAssigneeId === 'unassigned' ? null : selectedAssigneeId));
        }

        if (!searchQuery.trim()) return baseTasks;
        const q = searchQuery.toLowerCase();
        return baseTasks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.assignee?.full_name?.toLowerCase().includes(q) ||
            t.issue_key?.toLowerCase().includes(q)
        );
    }, [tasks, searchQuery, activeTab]);

    // Stats
    const taskStats = useMemo(() => {
        const byStatus = { todo: 0, in_progress: 0, review: 0, done: 0 };
        const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
        let overdue = 0;
        const now = new Date();
        filteredTasks.forEach(t => {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            if (t.due_date && new Date(t.due_date) < now && t.status !== 'done') overdue++;
        });
        const total = filteredTasks.length;
        const progress = total > 0 ? Math.round((byStatus.done / total) * 100) : 0;
        return { byStatus, byPriority, overdue, total, progress };
    }, [filteredTasks]);

    const { data: workload = [] } = useWorkloadTracking(selectedProjectId || undefined);

    // Handlers
    const toggleTaskSelection = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelection = new Set(selectedTasks);
        if (newSelection.has(taskId)) {
            newSelection.delete(taskId);
        } else {
            newSelection.add(taskId);
        }
        setSelectedTasks(newSelection);
    };

    const handleTaskUpdate = async (id: string, updates: Partial<ProjectTask>) => {
        // Automation Rules
        const finalUpdates = { ...updates };

        // Rule: If status moves to 'done', set actual_hours if empty
        if (updates.status === 'done') {
            const task = tasks.find(t => t.id === id);
            if (task && !task.actual_hours) {
                finalUpdates.actual_hours = task.estimated_hours || 1;
            }
        }

        // Rule: If issue_type is 'subtask' and status moves to 'done', check if parent should be updated (Future scope)

        await updateTask.mutateAsync({ id, ...finalUpdates });
    };

    const handleBulkUpdate = async (updates: Partial<ProjectTask>) => {
        if (selectedTasks.size === 0) return;
        setIsBulkUpdating(true);
        try {
            await Promise.all(Array.from(selectedTasks).map(id => handleTaskUpdate(id, updates)));
            setSelectedTasks(new Set());
            toast.success(`Updated ${selectedTasks.size} tasks`);
        } catch {
            toast.error("Failed to update some tasks");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
        handleTaskUpdate(draggableId, { status: destination.droppableId as ProjectTask['status'] });
    };

    const handleCreateProject = async () => {
        if (!newProjectData.name.trim() || createProject.isPending) return;
        try {
            await createProject.mutateAsync({
                name: newProjectData.name,
                description: newProjectData.description || null,
                vendor_id: newProjectData.vendor_id || null,
                status: newProjectData.status,
                manager_id: newProjectData.manager_id || null,
                start_date: newProjectData.start_date || null,
                end_date: newProjectData.end_date || null,
                key_prefix: newProjectData.key_prefix.toUpperCase().trim()
            });
            setNewProjectData({ name: "", description: "", vendor_id: "", status: "planning", start_date: "", end_date: "", manager_id: "", key_prefix: "LAZ" });
            setCreateProjectOpen(false);
        } catch { /* error handled by mutation onError */ }
    };

    const handleCreateTask = async () => {
        if (!newTaskData.title.trim() || createTask.isPending) return;
        try {
            await createTask.mutateAsync({
                title: newTaskData.title,
                description: newTaskData.description || null,
                priority: newTaskData.priority,
                assigned_to: newTaskData.assigned_to || null,
                due_date: newTaskData.due_date || null,
                status: newTaskData.status,
                issue_type: newTaskData.issue_type,
                parent_id: newTaskData.parent_id || null,
                sprint_id: newTaskData.sprint_id || null,
                milestone_id: newTaskData.milestone_id || null,
                start_date: newTaskData.start_date || null
            });
            setNewTaskData({
                title: "", description: "", priority: "medium", assigned_to: "", due_date: "",
                status: "todo", issue_type: "task", parent_id: "", sprint_id: "",
                milestone_id: "", start_date: ""
            });
            setCreateTaskOpen(false);
        } catch { /* error handled by mutation onError */ }
    };

    if (isProjectsLoading) {
        return (
            <DashboardLayout title="Projects">
                <div className="flex items-center justify-center h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Project Board" subtitle="Manage vendor operations, sprints, and team tasks.">
            <div className="space-y-4 h-full flex flex-col">
                {/* Top Bar: Project Selector + Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2 text-left justify-between min-w-[220px]">
                                    <div className="flex items-center gap-2 truncate">
                                        <Briefcase className="w-4 h-4 text-primary shrink-0" />
                                        <span className="truncate">{selectedProject?.name || "Select Project"}</span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[320px]">
                                {projects.map(p => (
                                    <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)} className="flex flex-col items-start gap-0.5 py-2">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{p.name}</span>
                                            <Badge className={cn("text-[9px] ml-2", STATUS_COLORS[p.status])}>{p.status}</Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{p.vendors?.name || "No Vendor"} · {p.manager?.full_name || "No Manager"}</span>
                                    </DropdownMenuItem>
                                ))}
                                {projects.length === 0 && <div className="px-2 py-4 text-center text-xs text-muted-foreground">No projects yet</div>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setCreateProjectOpen(true)}><Plus className="w-4 h-4 mr-2" />Create New Project</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedProject && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {(['planning', 'active', 'completed', 'on_hold'] as const).map(s => (
                                        <DropdownMenuItem key={s} onClick={() => updateProject.mutate({ id: selectedProject.id, status: s })} className="capitalize">{s === selectedProject.status ? `✓ ${s}` : s}</DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive gap-2" onClick={() => { deleteProject.mutate(selectedProject.id); setSelectedProjectId(null); }}>
                                        <Trash2 className="w-3.5 h-3.5" />Delete Project
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Search tasks..." className="pl-8 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        {activeTab === 'board' && (
                            <div className="flex items-center gap-2">
                                <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                                    <SelectTrigger className="h-9 w-[130px] text-[10px] font-semibold">
                                        <Zap className="w-3 h-3 text-amber-500 mr-2" />
                                        <SelectValue placeholder="Sprint" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sprints</SelectItem>
                                        {sprints.map(s => <SelectItem key={s.id} value={s.id} className="text-[10px]">{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                                    <SelectTrigger className="h-9 w-[110px] text-[10px] font-semibold">
                                        <Flag className="w-3 h-3 text-primary mr-2" />
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Priorities</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                                    <SelectTrigger className="h-9 w-[130px] text-[10px] font-semibold">
                                        <User className="w-3 h-3 text-primary mr-2" />
                                        <SelectValue placeholder="Assignee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Any Assignee</SelectItem>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {allUsers.map(u => <SelectItem key={u.id} value={u.id} className="text-[10px]">{u.full_name || u.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button size="sm" className="gap-1.5 h-9" onClick={() => setCreateProjectOpen(true)}><Plus className="w-4 h-4" />Project</Button>
                        {selectedProjectId && <Button size="sm" className="gap-1.5 h-9" onClick={() => setCreateTaskOpen(true)}><Plus className="w-4 h-4" />Task</Button>}
                    </div>
                </div>

                {!selectedProjectId ? (
                    /* ─── Empty State ───────────────────────────────── */
                    <div className="flex-1 flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                        <Briefcase className="w-14 h-14 text-muted-foreground/20 mb-4" />
                        <h3 className="text-lg font-semibold">No Project Selected</h3>
                        <p className="text-muted-foreground text-sm max-w-xs text-center mt-2">Select a project from the dropdown or create a new one to start managing tasks.</p>
                        <Button className="mt-5 gap-2" onClick={() => setCreateProjectOpen(true)}><Plus className="w-4 h-4" />Create Project</Button>
                    </div>
                ) : (
                    /* ─── Project Dashboard ─────────────────────────── */
                    <>
                        {/* Stats Bar */}
                        {tasks.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                                <Card className="col-span-2 sm:col-span-2 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="text-[10px] uppercase tracking-wider text-primary/60 font-semibold">Progress</p>
                                            <p className="text-2xl font-bold text-primary">{taskStats.progress}%</p>
                                            <div className="mt-1 bg-primary/20 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${taskStats.progress}%` }} />
                                            </div>
                                        </div>
                                        <TrendingUp className="w-8 h-8 text-primary/30" />
                                    </CardContent>
                                </Card>
                                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">To Do</p><p className="text-xl font-bold">{taskStats.byStatus.todo}</p></CardContent></Card>
                                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-blue-500 font-semibold">Active</p><p className="text-xl font-bold text-blue-600">{taskStats.byStatus.in_progress}</p></CardContent></Card>
                                <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-amber-500 font-semibold">Review</p><p className="text-xl font-bold text-amber-600">{taskStats.byStatus.review}</p></CardContent></Card>
                                {taskStats.overdue > 0 ? (
                                    <Card className="border-red-200 bg-red-50/50"><CardContent className="p-3"><p className="text-[10px] uppercase text-red-500 font-semibold">Overdue</p><p className="text-xl font-bold text-red-600">{taskStats.overdue}</p></CardContent></Card>
                                ) : (
                                    <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-emerald-500 font-semibold">Done</p><p className="text-xl font-bold text-emerald-600">{taskStats.byStatus.done}</p></CardContent></Card>
                                )}
                            </div>
                        )}

                        {/* Tabs: Board / Workload */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                            <TabsList className="w-fit">
                                <TabsTrigger value="board" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Board</TabsTrigger>
                                <TabsTrigger value="backlog" className="gap-1.5"><List className="w-3.5 h-3.5" />Backlog</TabsTrigger>
                                <TabsTrigger value="roadmap" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Roadmap</TabsTrigger>
                                <TabsTrigger value="workload" className="gap-1.5"><Users className="w-3.5 h-3.5" />Workload</TabsTrigger>
                                <TabsTrigger value="sprints" className="gap-1.5"><Zap className="w-3.5 h-3.5" />Sprints</TabsTrigger>
                                <TabsTrigger value="milestones" className="gap-1.5"><Target className="w-3.5 h-3.5" />Milestones</TabsTrigger>
                                <TabsTrigger value="activity" className="gap-1.5"><Activity className="w-3.5 h-3.5" />Activity</TabsTrigger>
                                <TabsTrigger value="reports" className="gap-1.5"><LineChart className="w-3.5 h-3.5" />Reports</TabsTrigger>
                            </TabsList>

                            {/* ─── Board Tab ─────────────────────────────── */}
                            <TabsContent value="board" className="flex-1 overflow-x-auto min-h-0 pb-4 mt-3">
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <div className="flex gap-3 h-full min-w-[900px]">
                                        {COLUMNS.map(column => {
                                            const colTasks = filteredTasks.filter(t => t.status === column.id);
                                            return (
                                                <div key={column.id} className={cn("flex-1 flex flex-col rounded-xl overflow-hidden min-h-[400px] border", column.bg)}>
                                                    <div className="px-3 py-2.5 flex items-center justify-between border-b border-inherit">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("w-2 h-2 rounded-full", column.dotColor)} />
                                                            <h4 className="font-semibold text-xs">{column.label}</h4>
                                                            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[9px] font-bold">{colTasks.length}</Badge>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6"
                                                            onClick={() => { setNewTaskData(p => ({ ...p, status: column.id as ProjectTask['status'] })); setCreateTaskOpen(true); }}>
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <Droppable droppableId={column.id}>
                                                        {(provided, snapshot) => (
                                                            <div {...provided.droppableProps} ref={provided.innerRef}
                                                                className={cn("flex-1 p-2 space-y-2 transition-colors overflow-y-auto", snapshot.isDraggingOver && "bg-primary/5")}>
                                                                {colTasks.map((task, index) => (
                                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                                        {(provided, snapshot) => (
                                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                                                className="group relative" onClick={(e) => {
                                                                                    if (e.metaKey || e.ctrlKey) {
                                                                                        toggleTaskSelection(task.id, e);
                                                                                    } else {
                                                                                        setSelectedTaskId(task.id);
                                                                                    }
                                                                                }}>
                                                                                <Card className={cn(
                                                                                    "shadow-sm border hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                                                                                    snapshot.isDragging && "shadow-lg rotate-1 scale-[1.02]",
                                                                                    selectedTasks.has(task.id) && "ring-2 ring-primary border-primary bg-primary/5"
                                                                                )}>
                                                                                    {selectedTasks.has(task.id) && (
                                                                                        <div className="absolute -top-1.5 -right-1.5 bg-primary text-white p-0.5 rounded-full z-10">
                                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                                        </div>
                                                                                    )}
                                                                                    <CardContent className="p-2.5 space-y-2">
                                                                                        <div className="flex justify-between items-start gap-1">
                                                                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                                                    {(() => {
                                                                                                        const config = ISSUE_TYPE_CONFIG[task.issue_type] || ISSUE_TYPE_CONFIG.task;
                                                                                                        const Icon = config.icon;
                                                                                                        return <Icon className={cn("w-3 h-3 shrink-0", config.color)} />;
                                                                                                    })()}
                                                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight leading-none truncate">
                                                                                                        {task.issue_key || 'T-XXX'}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <h5 className="text-xs font-semibold leading-snug line-clamp-2">{task.title}</h5>
                                                                                            </div>
                                                                                            <DropdownMenu>
                                                                                                <DropdownMenuTrigger asChild>
                                                                                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0">
                                                                                                        <MoreVertical className="w-3 h-3" />
                                                                                                    </Button>
                                                                                                </DropdownMenuTrigger>
                                                                                                <DropdownMenuContent align="end" className="w-36">
                                                                                                    <DropdownMenuItem className="text-destructive gap-2 text-xs" onClick={() => deleteTask.mutate(task.id)}>
                                                                                                        <Trash2 className="w-3 h-3" />Delete
                                                                                                    </DropdownMenuItem>
                                                                                                </DropdownMenuContent>
                                                                                            </DropdownMenu>
                                                                                        </div>
                                                                                        {task.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{task.description}</p>}
                                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                                            <Badge variant="outline" className={cn("text-[8px] uppercase tracking-wider py-0 px-1 font-bold", PRIORITY_STYLES[task.priority])}>{task.priority}</Badge>
                                                                                            {task.due_date && (
                                                                                                <span className={cn("text-[9px] font-medium flex items-center gap-0.5",
                                                                                                    isPast(new Date(task.due_date)) && task.status !== 'done' ? "text-red-600" : "text-muted-foreground")}>
                                                                                                    <Clock className="w-2.5 h-2.5" />{format(new Date(task.due_date), "MMM d")}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between pt-0.5">
                                                                                            {task.assignee ? (
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <Avatar className="h-5 w-5 border border-white">
                                                                                                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                                                                                                            {(task.assignee.full_name || task.assignee.email).charAt(0).toUpperCase()}
                                                                                                        </AvatarFallback>
                                                                                                    </Avatar>
                                                                                                    <span className="text-[9px] text-muted-foreground truncate max-w-[70px]">{task.assignee.full_name || task.assignee.email}</span>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/20 flex items-center justify-center">
                                                                                                    <User className="w-2.5 h-2.5 text-muted-foreground/30" />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </CardContent>
                                                                                </Card>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                ))}
                                                                {provided.placeholder}
                                                                {colTasks.length === 0 && !snapshot.isDraggingOver && (
                                                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                                                                        <p className="text-[10px]">Drop tasks here</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </DragDropContext>
                            </TabsContent>

                            {/* ─── Bulk Actions Toolbar ───────────────────── */}
                            {selectedTasks.size > 0 && (
                                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-slate-900/95 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 border border-white/10">
                                        <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                                            <Badge className="bg-primary text-white font-bold">{selectedTasks.size}</Badge>
                                            <span className="text-sm font-medium">Selected</span>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Move to</span>
                                                <div className="flex gap-1">
                                                    {COLUMNS.map(col => (
                                                        <Button key={col.id} size="sm" variant="ghost"
                                                            className="h-7 text-[10px] bg-white/5 hover:bg-white/20 px-2"
                                                            onClick={() => handleBulkUpdate({ status: col.id as any })}>
                                                            {col.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] bg-white/5 hover:bg-white/20">
                                                        <User className="w-3 h-3 mr-1" /> Assignee
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
                                                    <DropdownMenuItem onClick={() => handleBulkUpdate({ assigned_to: null })} className="hover:bg-white/10">Unassigned</DropdownMenuItem>
                                                    {allUsers.map(u => (
                                                        <DropdownMenuItem key={u.id} onClick={() => handleBulkUpdate({ assigned_to: u.id })} className="hover:bg-white/10">
                                                            {u.full_name || u.email}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400 hover:bg-red-500/20"
                                                onClick={() => {
                                                    if (confirm(`Delete ${selectedTasks.size} tasks?`)) {
                                                        Promise.all(Array.from(selectedTasks).map(id => deleteTask.mutateAsync(id))).then(() => setSelectedTasks(new Set()));
                                                    }
                                                }}>
                                                Delete
                                            </Button>
                                        </div>

                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-white" onClick={() => setSelectedTasks(new Set())}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ─── Reports Tab ────────────────────────────── */}
                            <TabsContent value="reports" className="mt-3 flex-1 min-h-0">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-y-auto pb-6">
                                    <Card className="p-6 border shadow-none bg-background/50">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold">Burndown Chart</h3>
                                                <p className="text-xs text-muted-foreground">Sprint progress tracking</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-bold border-emerald-500/20">On Track</Badge>
                                        </div>

                                        <div className="h-[250px] flex flex-col justify-end gap-1 relative">
                                            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
                                                {[...Array(5)].map((_, i) => <div key={i} className="border-t border-muted-foreground w-full" />)}
                                            </div>

                                            <div className="flex items-end justify-between h-full px-4 relative z-10">
                                                {/* Mock Burndown Visualization */}
                                                {[100, 85, 80, 65, 40, 35, 20].map((val, i) => (
                                                    <div key={i} className="flex flex-col items-center gap-2 group w-full">
                                                        <div className="w-[60%] bg-primary/20 rounded-t-sm group-hover:bg-primary/40 transition-all relative" style={{ height: `${val}%` }}>
                                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {val}h
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] text-muted-foreground font-bold">Day {i + 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Idea line */}
                                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                                <svg className="w-full h-full" overflow="visible">
                                                    <line x1="5%" y1="0%" x2="95%" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" className="text-muted-foreground opacity-30" />
                                                </svg>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-6 border shadow-none bg-background/50">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold">Priority Distribution</h3>
                                                <p className="text-xs text-muted-foreground">Task risk analysis</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {Object.entries(taskStats.byPriority).map(([p, count]) => (
                                                <div key={p} className="space-y-1.5">
                                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                                        <span className={PRIORITY_STYLES[p as any]}>{p}</span>
                                                        <span>{count} Issues</span>
                                                    </div>
                                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                        <div className={cn("h-full transition-all",
                                                            p === 'critical' ? 'bg-red-500' :
                                                                p === 'high' ? 'bg-amber-500' :
                                                                    p === 'medium' ? 'bg-blue-500' : 'bg-slate-400')}
                                                            style={{ width: `${(count / (tasks.length || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* ─── Roadmap Tab ────────────────────────────── */}
                            <TabsContent value="roadmap" className="mt-3 flex-1 min-h-0">
                                <Card className="h-full border shadow-none bg-background/50 overflow-hidden flex flex-col">
                                    <div className="p-4 border-b bg-muted/5 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold">Project Roadmap</h3>
                                            <p className="text-[10px] text-muted-foreground">Visualize timeline of epics and key tasks.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">Gantt View</Badge>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4">
                                        <div className="space-y-6 min-w-[1000px]">
                                            {/* Roadmap visualization logic */}
                                            {tasks.filter(t => t.issue_type === 'epic' || (t.start_date && t.due_date)).length === 0 ? (
                                                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                                                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                                    <p className="text-muted-foreground text-sm">No tasks with start/due dates to show on roadmap</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {tasks.filter(t => t.issue_type === 'epic' || (t.start_date && t.due_date))
                                                        .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
                                                        .map(task => {
                                                            const start = task.start_date ? new Date(task.start_date) : new Date();
                                                            const end = task.due_date ? new Date(task.due_date) : new Date();
                                                            const totalDays = 90; // View range: 90 days
                                                            const viewStart = new Date();
                                                            viewStart.setDate(viewStart.getDate() - 15); // Start 15 days ago

                                                            const diffStart = Math.max(0, Math.floor((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)));
                                                            const duration = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

                                                            const left = (diffStart / totalDays) * 100;
                                                            const width = (duration / totalDays) * 100;

                                                            return (
                                                                <div key={task.id} className="grid grid-cols-[250px_1fr] gap-4 items-center group">
                                                                    <div className="flex items-center gap-2 truncate pr-2 border-r">
                                                                        {(() => {
                                                                            const config = ISSUE_TYPE_CONFIG[task.issue_type] || ISSUE_TYPE_CONFIG.task;
                                                                            const Icon = config.icon;
                                                                            return <Icon className={cn("w-3.5 h-3.5 shrink-0", config.color)} />;
                                                                        })()}
                                                                        <div className="flex flex-col truncate">
                                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{task.issue_key}</span>
                                                                            <span className="text-xs font-semibold truncate group-hover:text-primary cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>{task.title}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative h-8 bg-muted/30 rounded-md overflow-hidden">
                                                                        <div
                                                                            className={cn(
                                                                                "absolute h-full rounded-md shadow-sm border border-white/20 flex items-center px-2 transition-all hover:scale-[1.01] cursor-pointer",
                                                                                task.issue_type === 'epic' ? 'bg-purple-500' :
                                                                                    task.priority === 'critical' || task.priority === 'high' ? 'bg-amber-500' : 'bg-primary'
                                                                            )}
                                                                            style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }}
                                                                            onClick={() => setSelectedTaskId(task.id)}
                                                                        >
                                                                            <span className="text-[9px] font-bold text-white truncate">{task.status.replace('_', ' ')}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Timeline Header (Months) */}
                                    <div className="p-3 border-t bg-muted/10 grid grid-cols-[250px_1fr] gap-4">
                                        <div />
                                        <div className="relative h-6 flex justify-between text-[9px] font-bold text-muted-foreground px-[2%]">
                                            <span>Earlier</span>
                                            <span>Current Period (90 Days)</span>
                                            <span>Future</span>
                                        </div>
                                    </div>
                                </Card>
                            </TabsContent>
                            20:
                            {/* ─── Backlog Tab ────────────────────────────── */}
                            <TabsContent value="backlog" className="mt-3">
                                <Card className="border-none shadow-none bg-transparent">
                                    <div className="space-y-1">
                                        {tasks.filter(t => t.status === 'todo').length === 0 && (
                                            <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                                                <List className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                                <p className="text-muted-foreground text-sm">Backlog is empty</p>
                                            </div>
                                        )}
                                        {tasks.filter(t => t.status === 'todo')
                                            .sort((a, b) => a.order_index - b.order_index)
                                            .map(task => (
                                                <div key={task.id}
                                                    onClick={() => setSelectedTaskId(task.id)}
                                                    className="flex items-center gap-3 p-2 bg-card border rounded-lg hover:border-primary/50 cursor-pointer group transition-all"
                                                >
                                                    <div className="flex items-center gap-2 min-w-[100px]">
                                                        {(() => {
                                                            const config = ISSUE_TYPE_CONFIG[task.issue_type] || ISSUE_TYPE_CONFIG.task;
                                                            const Icon = config.icon;
                                                            return <Icon className={cn("w-3.5 h-3.5 shrink-0", config.color)} />;
                                                        })()}
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{task.issue_key}</span>
                                                    </div>
                                                    <h4 className="text-xs font-semibold flex-1 truncate">{task.title}</h4>
                                                    <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100">
                                                        <Badge variant="outline" className={cn("text-[8px] uppercase font-bold", PRIORITY_STYLES[task.priority])}>
                                                            {task.priority}
                                                        </Badge>
                                                        {task.assignee ? (
                                                            <Avatar className="h-5 w-5">
                                                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                                                    {(task.assignee.full_name || task.assignee.email).charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        ) : <User className="w-3.5 h-3.5 text-muted-foreground/30" />}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </Card>
                            </TabsContent>

                            {/* ─── Workload Tab ──────────────────────────── */}
                            <TabsContent value="workload" className="mt-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {workload.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-muted-foreground">
                                            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm">No tasks assigned yet. Create and assign tasks to track workload.</p>
                                        </div>
                                    )}
                                    {workload.map(dev => (
                                        <Card key={dev.userId} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{dev.fullName?.charAt(0).toUpperCase() || dev.email.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-sm truncate">{dev.fullName || dev.email}</p>
                                                        <p className="text-[10px] text-muted-foreground">{dev.totalTasks} issues · {dev.estimatedHours}h est.</p>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs font-bold">{dev.tasksDone}/{dev.totalTasks}</Badge>
                                                </div>
                                                <div className="flex gap-1.5 h-1.5 rounded-full overflow-hidden bg-muted mb-3">
                                                    <div className="bg-emerald-500 transition-all" style={{ width: `${(dev.tasksDone / dev.totalTasks) * 100}%` }} />
                                                    <div className="bg-blue-500 transition-all" style={{ width: `${(dev.tasksInProgress / dev.totalTasks) * 100}%` }} />
                                                    <div className="bg-amber-500 transition-all" style={{ width: `${(dev.tasksReview / dev.totalTasks) * 100}%` }} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-4">
                                                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Estimated</p>
                                                        <p className="text-sm font-bold text-primary">{dev.estimatedHours}h</p>
                                                    </div>
                                                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Actual</p>
                                                        <p className="text-sm font-bold text-emerald-600">{dev.actualHours}h</p>
                                                    </div>
                                                </div>
                                                {dev.overdueTasks > 0 && (
                                                    <Badge variant="destructive" className="w-full mt-3 justify-center gap-2 text-[10px]">
                                                        <AlertTriangle className="w-3 h-3" /> {dev.overdueTasks} Overdue Issues
                                                    </Badge>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </TabsContent>
                            20:
                            {/* ─── Activity Tab ──────────────────────────── */}
                            <TabsContent value="activity" className="mt-3">
                                <Card className="border-none shadow-none bg-transparent">
                                    <div className="space-y-4">
                                        {activityFeed.length === 0 && (
                                            <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                                                <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                                <p className="text-muted-foreground text-sm">No recent activity</p>
                                            </div>
                                        )}
                                        {activityFeed.map((item) => (
                                            <div key={item.id} className="flex gap-4 p-3 border rounded-xl bg-card hover:bg-muted/5 transition-colors relative group">
                                                <div className="mt-1">
                                                    {item.action === 'status_changed' ? (
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                            <TrendingUp className="w-4 h-4" />
                                                        </div>
                                                    ) : item.action === 'created' ? (
                                                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                            <Plus className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm leading-relaxed">
                                                        <span className="font-bold text-primary underline decoration-primary/20">{allUsers.find(u => u.id === item.user_id)?.full_name || 'System'}</span>
                                                        {' '}{item.description}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                        </span>
                                                        <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 bg-muted/20">{item.entity_type}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </TabsContent>

                            {/* ─── Sprints Tab ──────────────────────────── */}
                            <TabsContent value="sprints" className="mt-3 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold">Sprint Planning</h3>
                                        <p className="text-[10px] text-muted-foreground">Organize tasks into time-boxed sprints.</p>
                                    </div>
                                    <Button size="sm" className="gap-1.5" onClick={() => setCreateSprintOpen(true)}><Plus className="w-3.5 h-3.5" />New Sprint</Button>
                                </div>
                                {sprints.length === 0 ? (
                                    <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                                        <Zap className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                                        <p className="text-sm text-muted-foreground">No sprints yet. Create your first sprint to organize tasks.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {sprints.map(sprint => {
                                            const sprintTasks = tasks.filter(t => (t as any).sprint_id === sprint.id);
                                            const doneTasks = sprintTasks.filter(t => t.status === 'done').length;
                                            const progress = sprintTasks.length > 0 ? Math.round((doneTasks / sprintTasks.length) * 100) : 0;
                                            return (
                                                <Card key={sprint.id} className="hover:shadow-md transition-shadow">
                                                    <CardContent className="p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="font-semibold text-sm truncate">{sprint.name}</h4>
                                                                    <Badge variant="outline" className={cn("text-[9px]",
                                                                        sprint.status === 'active' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                                                                            sprint.status === 'completed' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                                                                'border-slate-200'
                                                                    )}>{sprint.status}</Badge>
                                                                </div>
                                                                {sprint.goal && <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">{sprint.goal}</p>}
                                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                    {sprint.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(new Date(sprint.start_date), 'MMM d')}</span>}
                                                                    {sprint.end_date && <><ArrowRight className="w-3 h-3" /><span>{format(new Date(sprint.end_date), 'MMM d')}</span></>}
                                                                    <span className="ml-auto font-medium">{sprintTasks.length} tasks · {doneTasks} done</span>
                                                                </div>
                                                                {sprintTasks.length > 0 && (
                                                                    <div className="mt-2 bg-muted rounded-full h-1.5 overflow-hidden">
                                                                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    {sprint.status === 'planning' && (
                                                                        <DropdownMenuItem onClick={() => updateSprint.mutate({ id: sprint.id, status: 'active' })}>
                                                                            <Zap className="w-3.5 h-3.5 mr-2" />Start Sprint
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {sprint.status === 'active' && (
                                                                        <DropdownMenuItem onClick={() => updateSprint.mutate({ id: sprint.id, status: 'completed' })}>
                                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-2" />Complete Sprint
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-destructive" onClick={() => deleteSprint.mutate(sprint.id)}>
                                                                        <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ─── Milestones Tab ───────────────────────── */}
                            <TabsContent value="milestones" className="mt-3 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold">Milestones</h3>
                                        <p className="text-[10px] text-muted-foreground">Track major deliverables and deadlines.</p>
                                    </div>
                                    <Button size="sm" className="gap-1.5" onClick={() => setCreateMilestoneOpen(true)}><Plus className="w-3.5 h-3.5" />New Milestone</Button>
                                </div>
                                {milestones.length === 0 ? (
                                    <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                                        <Target className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                                        <p className="text-sm text-muted-foreground">No milestones defined. Create milestones to track major deliverables.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {milestones.map(ms => (
                                            <Card key={ms.id} className={cn("hover:shadow-md transition-shadow",
                                                ms.status === 'missed' && 'border-red-200 bg-red-50/30',
                                                ms.status === 'completed' && 'border-emerald-200 bg-emerald-50/30'
                                            )}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Target className={cn("w-4 h-4 shrink-0",
                                                                    ms.status === 'completed' ? 'text-emerald-500' :
                                                                        ms.status === 'missed' ? 'text-red-500' :
                                                                            ms.status === 'in_progress' ? 'text-blue-500' : 'text-muted-foreground'
                                                                )} />
                                                                <h4 className="font-semibold text-sm truncate">{ms.name}</h4>
                                                                <Badge variant="outline" className={cn("text-[9px] capitalize",
                                                                    ms.status === 'completed' ? 'border-emerald-300 text-emerald-700' :
                                                                        ms.status === 'missed' ? 'border-red-300 text-red-700' :
                                                                            ms.status === 'in_progress' ? 'border-blue-300 text-blue-700' :
                                                                                'border-slate-200'
                                                                )}>{ms.status.replace('_', ' ')}</Badge>
                                                            </div>
                                                            {ms.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 ml-6">{ms.description}</p>}
                                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-6">
                                                                {ms.target_date && (
                                                                    <span className={cn("flex items-center gap-1",
                                                                        isPast(new Date(ms.target_date)) && ms.status !== 'completed' ? 'text-red-600 font-medium' : ''
                                                                    )}>
                                                                        <CalendarDays className="w-3 h-3" />Due: {format(new Date(ms.target_date), 'MMM d, yyyy')}
                                                                    </span>
                                                                )}
                                                                {ms.completed_at && <span>Completed: {format(new Date(ms.completed_at), 'MMM d')}</span>}
                                                            </div>
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {ms.status === 'pending' && (
                                                                    <DropdownMenuItem onClick={() => updateMilestone.mutate({ id: ms.id, status: 'in_progress' })}>
                                                                        Start Progress
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {(ms.status === 'pending' || ms.status === 'in_progress') && (
                                                                    <DropdownMenuItem onClick={() => updateMilestone.mutate({ id: ms.id, status: 'completed', completed_at: new Date().toISOString() })}>
                                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-2" />Mark Complete
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {ms.status !== 'missed' && ms.status !== 'completed' && (
                                                                    <DropdownMenuItem onClick={() => updateMilestone.mutate({ id: ms.id, status: 'missed' })} className="text-red-600">
                                                                        <AlertTriangle className="w-3.5 h-3.5 mr-2" />Mark Missed
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ─── Activity Tab ─────────────────────────── */}
                            <TabsContent value="activity" className="mt-3 space-y-3">
                                <h3 className="text-sm font-semibold">Recent Activity</h3>
                                {activityFeed.length === 0 ? (
                                    <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                                        <Activity className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                                        <p className="text-sm text-muted-foreground">No activity recorded yet. Actions on tasks and projects will appear here automatically.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {activityFeed.map(item => (
                                            <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                                <div className={cn("mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                                                    item.action === 'created' ? 'bg-emerald-100 text-emerald-600' :
                                                        item.action === 'status_changed' ? 'bg-blue-100 text-blue-600' :
                                                            item.action === 'assigned' ? 'bg-purple-100 text-purple-600' :
                                                                'bg-muted text-muted-foreground'
                                                )}>
                                                    {item.action === 'created' ? <Plus className="w-3.5 h-3.5" /> :
                                                        item.action === 'status_changed' ? <ArrowRight className="w-3.5 h-3.5" /> :
                                                            item.action === 'assigned' ? <User className="w-3.5 h-3.5" /> :
                                                                <Activity className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs leading-relaxed">{item.description}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                        <span className="ml-2 capitalize">{item.entity_type}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>

            {/* ─── Create Project Dialog ─────────────────────────── */}
            <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" />Create New Project</DialogTitle>
                        <DialogDescription>Organize vendor operations and team tasks.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Project Name *</Label>
                                <Input value={newProjectData.name} onChange={e => setNewProjectData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Vendor Onboarding Q2" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Project Key Prefix *</Label>
                                <Input value={newProjectData.key_prefix} onChange={e => setNewProjectData(p => ({ ...p, key_prefix: e.target.value }))} placeholder="e.g., VORP" maxLength={10} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea value={newProjectData.description} onChange={e => setNewProjectData(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the project..." rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Linked Vendor</Label>
                                <Select value={newProjectData.vendor_id} onValueChange={v => setNewProjectData(p => ({ ...p, vendor_id: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Manager</Label>
                                <Select value={newProjectData.manager_id} onValueChange={v => setNewProjectData(p => ({ ...p, manager_id: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Status</Label>
                                <Select value={newProjectData.status} onValueChange={v => setNewProjectData(p => ({ ...p, status: v as Project['status'] }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planning">Planning</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={newProjectData.start_date} onChange={e => setNewProjectData(p => ({ ...p, start_date: e.target.value }))} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">End Date</Label><Input type="date" value={newProjectData.end_date} onChange={e => setNewProjectData(p => ({ ...p, end_date: e.target.value }))} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateProject} disabled={!newProjectData.name.trim() || createProject.isPending}>
                            {createProject.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Create Task Dialog ────────────────────────────── */}
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Flag className="w-5 h-5 text-primary" />Add New Task</DialogTitle>
                        <DialogDescription>Add a task to {selectedProject?.name || "the project"}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Issue Type *</Label>
                                <Select value={newTaskData.issue_type} onValueChange={v => setNewTaskData(p => ({ ...p, issue_type: v as ProjectTask['issue_type'] }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="task"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" />Task</div></SelectItem>
                                        <SelectItem value="story"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" />Story</div></SelectItem>
                                        <SelectItem value="bug"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Bug</div></SelectItem>
                                        <SelectItem value="epic"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-purple-500" />Epic</div></SelectItem>
                                        <SelectItem value="subtask"><div className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-slate-500" />Sub-task</div></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newTaskData.issue_type === 'subtask' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Parent Issue *</Label>
                                    <Select value={newTaskData.parent_id || ""} onValueChange={v => setNewTaskData(p => ({ ...p, parent_id: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select Parent" /></SelectTrigger>
                                        <SelectContent>
                                            {tasks.filter(t => t.issue_type !== 'subtask' && t.issue_type !== 'epic').map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.issue_key}: {t.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Summary *</Label>
                            <Input value={newTaskData.title} onChange={e => setNewTaskData(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Setup vendor API integration" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea value={newTaskData.description} onChange={e => setNewTaskData(p => ({ ...p, description: e.target.value }))} placeholder="Task details..." rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Priority</Label>
                                <Select value={newTaskData.priority} onValueChange={v => setNewTaskData(p => ({ ...p, priority: v as ProjectTask['priority'] }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Status</Label>
                                <Select value={newTaskData.status} onValueChange={v => setNewTaskData(p => ({ ...p, status: v as ProjectTask['status'] }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todo">To Do</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="review">In Review</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Sprint</Label>
                                <Select value={newTaskData.sprint_id || "backlog"} onValueChange={v => setNewTaskData(p => ({ ...p, sprint_id: v === "backlog" ? null : v }))}>
                                    <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="Backlog" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="backlog">Backlog</SelectItem>
                                        {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.status})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Milestone</Label>
                                <Select value={newTaskData.milestone_id || "none"} onValueChange={v => setNewTaskData(p => ({ ...p, milestone_id: v === "none" ? null : v }))}>
                                    <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="None" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={newTaskData.start_date} onChange={e => setNewTaskData(p => ({ ...p, start_date: e.target.value }))} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Due Date</Label><Input type="date" value={newTaskData.due_date} onChange={e => setNewTaskData(p => ({ ...p, due_date: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Assign To</Label>
                                <Select value={newTaskData.assigned_to} onValueChange={v => setNewTaskData(p => ({ ...p, assigned_to: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>{allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateTask} disabled={!newTaskData.title.trim() || createTask.isPending}>
                            {createTask.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Add Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Create Sprint Dialog ───────────────────────── */}
            <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />New Sprint</DialogTitle>
                        <DialogDescription>Organize tasks into a time-boxed iteration.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Sprint Name *</Label>
                            <Input value={newSprintData.name} onChange={e => setNewSprintData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Sprint 1 — Vendor API" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Goal (optional)</Label>
                            <Textarea value={newSprintData.goal} onChange={e => setNewSprintData(p => ({ ...p, goal: e.target.value }))} placeholder="What should this sprint achieve?" rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={newSprintData.start_date} onChange={e => setNewSprintData(p => ({ ...p, start_date: e.target.value }))} /></div>
                            <div className="space-y-1.5"><Label className="text-xs">End Date</Label><Input type="date" value={newSprintData.end_date} onChange={e => setNewSprintData(p => ({ ...p, end_date: e.target.value }))} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateSprintOpen(false)}>Cancel</Button>
                        <Button disabled={!newSprintData.name.trim() || createSprint.isPending} onClick={() => {
                            createSprint.mutate({
                                name: newSprintData.name,
                                goal: newSprintData.goal || null,
                                start_date: newSprintData.start_date || null,
                                end_date: newSprintData.end_date || null,
                            } as any);
                            setNewSprintData({ name: "", goal: "", start_date: "", end_date: "" });
                            setCreateSprintOpen(false);
                        }}>
                            {createSprint.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Sprint
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Create Milestone Dialog ─────────────────────── */}
            <Dialog open={createMilestoneOpen} onOpenChange={setCreateMilestoneOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" />New Milestone</DialogTitle>
                        <DialogDescription>Track a major deliverable or deadline.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Milestone Name *</Label>
                            <Input value={newMilestoneData.name} onChange={e => setNewMilestoneData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Payment Gateway Live" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description (optional)</Label>
                            <Textarea value={newMilestoneData.description} onChange={e => setNewMilestoneData(p => ({ ...p, description: e.target.value }))} placeholder="What does this milestone represent?" rows={2} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Target Date</Label>
                            <Input type="date" value={newMilestoneData.target_date} onChange={e => setNewMilestoneData(p => ({ ...p, target_date: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateMilestoneOpen(false)}>Cancel</Button>
                        <Button disabled={!newMilestoneData.name.trim() || createMilestone.isPending} onClick={() => {
                            createMilestone.mutate({
                                name: newMilestoneData.name,
                                description: newMilestoneData.description || null,
                                target_date: newMilestoneData.target_date || null,
                            } as any);
                            setNewMilestoneData({ name: "", description: "", target_date: "" });
                            setCreateMilestoneOpen(false);
                        }}>
                            {createMilestone.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Milestone
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            20:
            {/* ─── Issue Detail Dialog ─────────────────────────── */}
            <Dialog open={!!selectedTaskId} onOpenChange={open => !open && setSelectedTaskId(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    {selectedTask && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-2 mb-2">
                                    {(() => {
                                        const config = ISSUE_TYPE_CONFIG[selectedTask.issue_type] || ISSUE_TYPE_CONFIG.task;
                                        const Icon = config.icon;
                                        return <Icon className={cn("w-4 h-4", config.color)} />;
                                    })()}
                                    <span className="text-sm font-bold text-muted-foreground tracking-widest">{selectedTask.issue_key}</span>
                                </div>
                                <DialogTitle className="text-xl font-bold">{selectedTask.title}</DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                                <div className="md:col-span-2 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-bold opacity-70 flex items-center gap-2 underline decoration-primary/30">Description</Label>
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setIsEditingDescription(!isEditingDescription)}>
                                                {isEditingDescription ? "Cancel" : <><Edit3 className="w-3 h-3" />Edit</>}
                                            </Button>
                                        </div>
                                        {isEditingDescription ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    className="min-h-[150px] text-sm leading-relaxed focus-visible:ring-primary/30"
                                                    value={selectedTask.description || ""}
                                                    onChange={e => updateTask.mutate({ id: selectedTask.id, description: e.target.value })}
                                                    placeholder="Add a detailed description..."
                                                />
                                                <div className="flex justify-end">
                                                    <Button size="sm" className="h-7 text-[10px]" onClick={() => setIsEditingDescription(false)}>Save Changes</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl border bg-muted/5 text-sm whitespace-pre-wrap leading-relaxed min-h-[100px] hover:bg-muted/10 transition-colors cursor-pointer"
                                                onClick={() => setIsEditingDescription(true)}>
                                                {selectedTask.description ? (
                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        {selectedTask.description}
                                                    </div>
                                                ) : (
                                                    <span className="italic text-muted-foreground text-xs flex items-center gap-2">
                                                        <Plus className="w-3 h-3" /> Add a description to provide more context...
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Sub-tasks Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-bold opacity-70 flex items-center gap-2 underline decoration-primary/30">Sub-tasks</Label>
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1"
                                                onClick={() => {
                                                    setNewTaskData(p => ({ ...p, issue_type: 'subtask', parent_id: selectedTask.id }));
                                                    setCreateTaskOpen(true);
                                                }}>
                                                <Plus className="w-3 h-3" />Add Sub-task
                                            </Button>
                                        </div>
                                        <div className="space-y-1.5 ">
                                            {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                                                selectedTask.subtasks.map(st => (
                                                    <div key={st.id} className="flex items-center gap-3 p-2 border rounded-md bg-muted/5 hover:bg-muted/10 transition-colors text-xs">
                                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                                        <span className="font-bold text-muted-foreground min-w-[60px]">{st.issue_key}</span>
                                                        <span className="flex-1 truncate">{st.title}</span>
                                                        <Badge variant="outline" className={cn("text-[8px] uppercase", PRIORITY_STYLES[st.priority])}>{st.priority}</Badge>
                                                        <Badge variant="secondary" className="text-[8px] uppercase">{st.status}</Badge>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-4 text-center border-2 border-dashed rounded-lg opacity-30">
                                                    <p className="text-[10px]">No sub-tasks yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Issues Section */}
                                    <div className="space-y-3 pt-4 border-t border-muted-foreground/10">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-bold opacity-70 flex items-center gap-2 underline decoration-primary/30 text-primary">Linked Issues</Label>
                                            <div className="flex items-center gap-1.5">
                                                <Select value={linkData.link_type} onValueChange={v => setLinkData(p => ({ ...p, link_type: v }))}>
                                                    <SelectTrigger className="h-6 w-[110px] text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="blocks" className="text-[10px]">Blocks</SelectItem>
                                                        <SelectItem value="blocked_by" className="text-[10px]">Is Blocked By</SelectItem>
                                                        <SelectItem value="relates_to" className="text-[10px]">Relates To</SelectItem>
                                                        <SelectItem value="duplicates" className="text-[10px]">Duplicates</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select value={linkData.target_id} onValueChange={v => setLinkData(p => ({ ...p, target_id: v }))}>
                                                    <SelectTrigger className="h-6 w-[130px] text-[10px]"><SelectValue placeholder="Issue..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {tasks.filter(t => t.id !== selectedTask.id).map(t => (
                                                            <SelectItem key={t.id} value={t.id} className="text-[10px] truncate">{t.issue_key}: {t.title}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary"
                                                    disabled={!linkData.target_id || linkIssues.isPending}
                                                    onClick={() => {
                                                        linkIssues.mutate({ source_id: selectedTask.id, target_id: linkData.target_id, link_type: linkData.link_type });
                                                        setLinkData(p => ({ ...p, target_id: "" }));
                                                    }}>
                                                    <Plus className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            {selectedTask.links && selectedTask.links.length > 0 ? (
                                                selectedTask.links.map(link => (
                                                    <div key={link.id} className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/5 group/link hover:border-primary/30 transition-all">
                                                        <LinkIcon className="w-3 h-3 text-primary/50" />
                                                        <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                                            <span className="text-[10px] font-black text-primary uppercase whitespace-nowrap px-1.5 py-0.5 rounded bg-primary/10">{link.link_type.replace('_', ' ')}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{link.target?.issue_key}</span>
                                                            <span className="text-[11px] font-medium truncate opacity-80">{link.target?.title}</span>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/link:opacity-100 text-destructive"
                                                            onClick={() => unlinkIssues.mutate(link.id)}>
                                                            <Trash2 className="w-2.5 h-2.5" />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-6 text-center border-2 border-dashed rounded-xl opacity-20">
                                                    <p className="text-[10px]">No linked dependencies.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5 bg-muted/20 p-4 rounded-xl border border-muted-foreground/10 h-fit">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Status</Label>
                                            <Select value={selectedTask.status} onValueChange={v => updateTask.mutate({ id: selectedTask.id, status: v as any })}>
                                                <SelectTrigger className="h-8 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {COLUMNS.map(c => <SelectItem key={c.id} value={c.id} className="text-xs uppercase">{c.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Priority</Label>
                                            <Select value={selectedTask.priority} onValueChange={v => updateTask.mutate({ id: selectedTask.id, priority: v as any })}>
                                                <SelectTrigger className="h-8 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="low" className="text-xs uppercase">Low</SelectItem>
                                                    <SelectItem value="medium" className="text-xs uppercase">Medium</SelectItem>
                                                    <SelectItem value="high" className="text-xs uppercase">High</SelectItem>
                                                    <SelectItem value="critical" className="text-xs uppercase">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Assignee</Label>
                                            <Select value={selectedTask.assigned_to || "unassigned"} onValueChange={v => updateTask.mutate({ id: selectedTask.id, assigned_to: v === "unassigned" ? null : v })}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                                                    {allUsers.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name || u.email}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sprint</Label>
                                                <Select value={selectedTask.sprint_id || "backlog"} onValueChange={v => updateTask.mutate({ id: selectedTask.id, sprint_id: v === "backlog" ? null : v })}>
                                                    <SelectTrigger className="h-8 text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="backlog" className="text-[10px]">Backlog</SelectItem>
                                                        {sprints.map(s => <SelectItem key={s.id} value={s.id} className="text-[10px]">{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Milestone</Label>
                                                <Select value={selectedTask.milestone_id || "none"} onValueChange={v => updateTask.mutate({ id: selectedTask.id, milestone_id: v === "none" ? null : v })}>
                                                    <SelectTrigger className="h-8 text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="text-[10px]">None</SelectItem>
                                                        {milestones.map(m => <SelectItem key={m.id} value={m.id} className="text-[10px]">{m.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Start Date</Label>
                                                <Input type="date" className="h-8 text-xs font-bold"
                                                    value={selectedTask.start_date || ""}
                                                    onChange={e => updateTask.mutate({ id: selectedTask.id, start_date: e.target.value || null })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Due Date</Label>
                                                <Input type="date" className="h-8 text-xs font-bold"
                                                    value={selectedTask.due_date || ""}
                                                    onChange={e => updateTask.mutate({ id: selectedTask.id, due_date: e.target.value || null })}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Est. Hours</Label>
                                                <Input type="number" step="0.5" className="h-8 text-xs font-bold"
                                                    value={selectedTask.estimated_hours || 0}
                                                    onChange={e => updateTask.mutate({ id: selectedTask.id, estimated_hours: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Actual Hours</Label>
                                                <Input type="number" step="0.5" className="h-8 text-xs font-bold"
                                                    value={selectedTask.actual_hours || 0}
                                                    onChange={e => updateTask.mutate({ id: selectedTask.id, actual_hours: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-2 border-t border-muted-foreground/10">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Reporter</span>
                                                <span className="font-semibold truncate max-w-[100px]">{allUsers.find(u => u.id === selectedTask.created_by)?.full_name || 'System'}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Created</span>
                                                <span className="font-semibold">{format(new Date(selectedTask.created_at), "MMM d, yyyy")}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 text-[10px] h-8 gap-2"
                                        onClick={() => { deleteTask.mutate(selectedTask.id); setSelectedTaskId(null); }}>
                                        <Trash2 className="w-3 h-3" />Delete Issue
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
