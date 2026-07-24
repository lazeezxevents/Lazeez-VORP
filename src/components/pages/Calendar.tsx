import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  FileText,
  AlertCircle,
  Plus,
  Loader2,
  DollarSign,
  Archive,
  RefreshCw,
  MessageSquare,
  Sparkles,
  StickyNote,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMOUs } from "@/hooks/useMOUs";
import { useIssues, useUpdateIssue, Issue } from "@/hooks/useIssues";
import { useMOUVault } from "@/hooks/useMOUVault";
import { useVendorPayments } from "@/hooks/useVendorPayments";
import { useVendors } from "@/hooks/useVendors";
import { useAuth } from "@/contexts/AuthContext";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
  differenceInDays,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type EventType = "mou_expiration" | "issue_due" | "vault_expiration" | "vault_termination" | "payment" | "renewal";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: EventType;
  priority?: "low" | "medium" | "high" | "critical";
  status?: string;
  vendorName?: string;
  daysUntil?: number;
  originalData: unknown;
}

type FilterType = "all" | "mou" | "vault" | "issue" | "payment";

function daysToMonths(days: number): number {
  if (days >= 363 && days <= 367) return 12;
  if (days >= 178 && days <= 182) return 6;
  if (days >= 88 && days <= 92) return 3;
  if (days >= 58 && days <= 62) return 2;
  if (days >= 28 && days <= 31) return 1;
  return Math.round(days / 30);
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDialog, setRescheduleDialog] = useState<{
    event: CalendarEvent;
    newDate: Date;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [draggedNote, setDraggedNote] = useState<PersonalCalendarNote | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const { mous, isLoading: mousLoading, updateMOU } = useMOUs();
  const { data: issues, isLoading: issuesLoading } = useIssues();
  const { data: vaultItems, isLoading: vaultLoading } = useMOUVault();
  const { data: payments, isLoading: paymentsLoading } = useVendorPayments();
  const { data: vendors } = useVendors();
  const updateIssue = useUpdateIssue();
  const navigate = useNavigate();
  const { isStaff, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  const vendorMap = new Map<string, string>();
  vendors?.forEach((v) => vendorMap.set(v.id, v.name));

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const now = new Date();

    // MOU expirations
    if (mous) {
      mous.forEach((mou) => {
        if (mou.end_date) {
          const endDate = parseISO(mou.end_date);
          events.push({
            id: `mou-${mou.id}`,
            title: `MOU: ${mou.title}`,
            date: endDate,
            type: "mou_expiration",
            status: mou.status,
            vendorName: (mou as any)?.vendor?.name,
            daysUntil: differenceInDays(endDate, now),
            originalData: mou,
          });
        }
      });
    }

    // Issue due dates
    if (issues) {
      issues.forEach((issue) => {
        if (issue.due_date) {
          const dueDate = parseISO(issue.due_date);
          events.push({
            id: `issue-${issue.id}`,
            title: `Issue: ${issue.title}`,
            date: dueDate,
            type: "issue_due",
            priority: issue.priority,
            status: issue.status,
            vendorName: issue.vendor?.name,
            daysUntil: differenceInDays(dueDate, now),
            originalData: issue,
          });
        }
      });
    }

    // Vault expirations and termination deadlines
    if (vaultItems) {
      vaultItems.forEach((item) => {
        if (item.effective_end_date) {
          const endDate = parseISO(item.effective_end_date);
          events.push({
            id: `vault-exp-${item.id}`,
            title: `Vault: ${item.document_name}`,
            date: endDate,
            type: "vault_expiration",
            vendorName: item.vendor?.name,
            daysUntil: differenceInDays(endDate, now),
            originalData: item,
          });
        }
        if (item.termination_deadline) {
          const deadline = parseISO(item.termination_deadline);
          events.push({
            id: `vault-term-${item.id}`,
            title: `⚠ Terminate: ${item.document_name}`,
            date: deadline,
            type: "vault_termination",
            vendorName: item.vendor?.name,
            daysUntil: differenceInDays(deadline, now),
            originalData: item,
          });
        }
        // Renewal projections
        if (item.has_auto_renewal && item.effective_end_date && item.renewal_period_days) {
          const months = daysToMonths(item.renewal_period_days);
          let cycleStart = parseISO(item.effective_end_date);
          for (let i = 0; i < 3; i++) {
            const nextEnd = addMonths(cycleStart, months);
            if (differenceInDays(nextEnd, now) > 0 && differenceInDays(nextEnd, now) <= 365) {
              events.push({
                id: `renewal-${item.id}-${i}`,
                title: `🔄 Renewal: ${item.document_name}`,
                date: nextEnd,
                type: "renewal",
                vendorName: item.vendor?.name,
                daysUntil: differenceInDays(nextEnd, now),
                originalData: item,
              });
            }
            cycleStart = nextEnd;
          }
        }
      });
    }

    // Payments
    if (payments) {
      payments.forEach((payment) => {
        const vName = vendorMap.get(payment.vendor_id) || "Unknown";
        if (!payment.upfront_paid_at) {
          events.push({
            id: `pay-upfront-${payment.id}`,
            title: `💰 Upfront: ${payment.order_id}`,
            date: new Date(payment.created_at),
            type: "payment",
            vendorName: vName,
            daysUntil: differenceInDays(new Date(payment.created_at), now),
            originalData: payment,
          });
        }
        if (payment.upfront_paid_at && !payment.remaining_released_at) {
          events.push({
            id: `pay-remaining-${payment.id}`,
            title: `💳 Balance: ${payment.order_id}`,
            date: new Date(payment.upfront_paid_at),
            type: "payment",
            vendorName: vName,
            daysUntil: differenceInDays(new Date(payment.upfront_paid_at), now),
            originalData: payment,
          });
        }
      });
    }

    return events;
  }, [mous, issues, vaultItems, payments, vendorMap]);

  const filteredEvents = calendarEvents.filter((event) => {
    if (filterType === "all") return true;
    if (filterType === "mou") return event.type === "mou_expiration";
    if (filterType === "vault") return event.type === "vault_expiration" || event.type === "vault_termination" || event.type === "renewal";
    if (filterType === "issue") return event.type === "issue_due";
    if (filterType === "payment") return event.type === "payment";
    return true;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: personalNotes = [] } = useQuery({
    queryKey: ["calendar-personal-notes", user?.id, format(calendarStart, "yyyy-MM-dd"), format(calendarEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("calendar_personal_notes")
        .select("id, note_date, content")
        .eq("user_id", user!.id)
        .gte("note_date", format(calendarStart, "yyyy-MM-dd"))
        .lte("note_date", format(calendarEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []) as PersonalCalendarNote[];
    },
    enabled: !!user?.id,
  });

  const notesByDate = useMemo(
    () => new Map(personalNotes.map((note) => [note.note_date, note])),
    [personalNotes],
  );
  const selectedNote = selectedDate ? notesByDate.get(format(selectedDate, "yyyy-MM-dd")) : undefined;

  useEffect(() => {
    setNoteDraft(selectedNote?.content || "");
  }, [selectedDate, selectedNote?.content]);

  const getEventsForDay = (day: Date) => filteredEvents.filter((event) => isSameDay(event.date, day));

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleSavePersonalNote = async () => {
    if (!selectedDate || !user?.id) return;
    const content = noteDraft.trim();
    const noteDate = format(selectedDate, "yyyy-MM-dd");
    setIsSavingNote(true);
    try {
      const notesTable = (supabase as any).from("calendar_personal_notes");
      const { error } = content
        ? await notesTable.upsert({ user_id: user.id, note_date: noteDate, content }, { onConflict: "user_id,note_date" })
        : await notesTable.delete().eq("user_id", user.id).eq("note_date", noteDate);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["calendar-personal-notes", user.id] });
      toast.success(content ? "Personal note saved" : "Personal note cleared");
    } catch {
      toast.error("Could not save your personal note. Please run the latest database migration first.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDragStartNote = (note: PersonalCalendarNote, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedNote(note);
  };

  const handleDropNote = (day: Date, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedNote && user?.id) {
      const newDate = format(day, "yyyy-MM-dd");
      const oldDate = draggedNote.note_date;
      
      if (newDate !== oldDate) {
        (supabase as any).from("calendar_personal_notes")
          .update({ note_date: newDate })
          .eq("id", draggedNote.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["calendar-personal-notes", user.id] });
            toast.success("Note moved to new date");
          });
      }
    }
    setDraggedNote(null);
  };

  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    try {
      await (supabase as any).from("calendar_personal_notes").delete().eq("id", noteId).eq("user_id", user.id);
      await queryClient.invalidateQueries({ queryKey: ["calendar-personal-notes", user.id] });
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleEditNote = (note: PersonalCalendarNote) => {
    const date = parseISO(note.note_date);
    setCurrentDate(date);
    setSelectedDate(date);
    setNoteDraft(note.content);
    setNoteDialogOpen(true);
  };

  const handleCreateNote = () => {
    if (!selectedDate) {
      toast.error("Please select a date first");
      return;
    }
    setNoteDraft("");
    setNoteDialogOpen(true);
  };

  const canDragDrop = isStaff || isAdmin;

  const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
    if (!canDragDrop) return;
    e.dataTransfer.effectAllowed = "move";
    setDraggedEvent(event);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDragDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (day: Date, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedEvent && canDragDrop) {
      setRescheduleDialog({ event: draggedEvent, newDate: day });
    }
    setDraggedEvent(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleDialog) return;
    const { event, newDate } = rescheduleDialog;
    const formattedDate = format(newDate, "yyyy-MM-dd");

    try {
      if (event.type === "issue_due") {
        const issue = event.originalData as Issue;
        await updateIssue.mutateAsync({ id: issue.id, due_date: formattedDate });
        toast.success("Issue due date updated");
      } else if (event.type === "mou_expiration") {
        const mou = event.originalData as { id: string };
        await updateMOU.mutateAsync({ id: mou.id, end_date: formattedDate });
        toast.success("MOU end date updated");
      } else if (event.type === "vault_expiration") {
        const item = event.originalData as { id: string };
        await supabase.from("mou_vault").update({ effective_end_date: formattedDate }).eq("id", item.id);
        toast.success("Vault expiration updated");
      }
    } catch {
      toast.error("Failed to reschedule");
    }
    setRescheduleDialog(null);
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.type === "vault_termination") return "bg-orange-500/20 text-orange-700 border-orange-500/30";
    if (event.type === "renewal") return "bg-violet-500/20 text-violet-700 border-violet-500/30";
    if (event.type === "payment") return "bg-emerald-500/20 text-emerald-700 border-emerald-500/30";
    if (event.type === "vault_expiration") return "bg-cyan-500/20 text-cyan-700 border-cyan-500/30";

    if (event.type === "mou_expiration") {
      if (event.daysUntil !== undefined) {
        if (event.daysUntil < 0) return "bg-destructive/20 text-destructive border-destructive/30";
        if (event.daysUntil <= 7) return "bg-warning/20 text-warning border-warning/30";
        if (event.daysUntil <= 30) return "bg-info/20 text-info border-info/30";
      }
      return "bg-primary/20 text-primary border-primary/30";
    }

    if (event.type === "issue_due") {
      switch (event.priority) {
        case "critical": return "bg-destructive/20 text-destructive border-destructive/30";
        case "high": return "bg-warning/20 text-warning border-warning/30";
        case "medium": return "bg-info/20 text-info border-info/30";
        default: return "bg-success/20 text-success border-success/30";
      }
    }
    return "bg-muted text-muted-foreground";
  };

  const getEventIcon = (event: CalendarEvent) => {
    switch (event.type) {
      case "mou_expiration": return FileText;
      case "vault_expiration": return Archive;
      case "vault_termination": return AlertCircle;
      case "renewal": return RefreshCw;
      case "payment": return DollarSign;
      case "issue_due": return AlertCircle;
      default: return CalendarIcon;
    }
  };

  const upcomingEvents = filteredEvents
    .filter((e) => e.daysUntil !== undefined && e.daysUntil >= 0 && e.daysUntil <= 30)
    .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0))
    .slice(0, 10);

  const isLoading = mousLoading || issuesLoading || vaultLoading || paymentsLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Calendar" subtitle="Unified schedule for all operations">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Calendar" subtitle="Unified schedule for all operations">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
        <div className="lg:col-span-3 space-y-4">
          {/* Calendar Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="min-w-0 flex-1 text-center text-base font-semibold sm:min-w-[180px] sm:text-lg">
                    {format(currentDate, "MMMM yyyy")}
                  </h2>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
                </div>
                <Select value={filterType} onValueChange={(v: FilterType) => setFilterType(v)}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="mou">MOU Expirations</SelectItem>
                    <SelectItem value="vault">Vault & Renewals</SelectItem>
                    <SelectItem value="issue">Issue Due Dates</SelectItem>
                    <SelectItem value="payment">Payments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-1 grid grid-cols-7 gap-px sm:mb-2 sm:gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px sm:gap-1">
                {days.map((day, i) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={i}
                      className={cn(
                        "relative min-h-[70px] cursor-pointer rounded-sm border p-1 transition-all sm:min-h-[100px] sm:rounded-md",
                        isCurrentMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                        isToday(day) && "ring-2 ring-primary",
                        isSelected && "bg-primary/10",
                        "hover:bg-accent/50",
                        draggedEvent && "hover:scale-[1.02] hover:shadow-lg hover:border-primary/50 hover:bg-primary/5 active:scale-95"
                      )}
                      onClick={() => setSelectedDate(day)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedNote) e.dataTransfer.dropEffect = "move";
                        handleDragOver(e);
                      }}
                      onDrop={(e) => {
                        handleDropNote(day, e);
                        handleDrop(day, e);
                      }}
                    >
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isToday(day) && "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                      )}>
                        {format(day, "d")}
                      </div>
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {dayEvents.slice(0, 4).map((event) => (
                          <span key={event.id} className={cn("h-1.5 w-1.5 rounded-full border", getEventColor(event))} />
                        ))}
                        {notesByDate.has(format(day, "yyyy-MM-dd")) && <StickyNote className="h-3 w-3 text-primary" />}
                      </div>
                      <div className="hidden space-y-0.5 overflow-hidden sm:block">
                        {dayEvents.slice(0, 3).map((event) => {
                          const Icon = getEventIcon(event);
                          return (
                            <div
                              key={event.id}
                              draggable={canDragDrop}
                              onDragStart={(e) => handleDragStart(event, e)}
                              className={cn(
                                "text-[10px] px-1 py-0.5 rounded truncate border",
                                canDragDrop ? "cursor-move" : "cursor-default",
                                getEventColor(event)
                              )}
                              title={`${event.title}${event.vendorName ? ` - ${event.vendorName}` : ""}`}
                            >
                              <Icon className="w-2 h-2 inline mr-0.5" />
                              {event.title.replace(/^(MOU|Issue|Vault|⚠ Terminate|🔄 Renewal|💰 Upfront|💳 Balance): /, "")}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 3} more</div>
                        )}
                        {notesByDate.has(format(day, "yyyy-MM-dd")) && (
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); setSelectedDate(day); }}
                            className="mt-1 flex w-full items-center gap-1 rounded border border-primary/20 bg-primary/5 px-1 py-0.5 text-left text-[10px] text-primary hover:bg-primary/10"
                            title={notesByDate.get(format(day, "yyyy-MM-dd"))?.content}
                          >
                            <StickyNote className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{notesByDate.get(format(day, "yyyy-MM-dd"))?.content}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Events for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-5 lg:grid-cols-1">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled events</p>
                    {getEventsForDay(selectedDate).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events on this day</p>
                    ) : (
                      <div className="space-y-2">
                        {getEventsForDay(selectedDate).map((event) => {
                      const Icon = getEventIcon(event);
                      return (
                        <div
                          key={event.id}
                          className={cn("p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow", getEventColor(event))}
                          onClick={() => {
                            if (event.type === "issue_due") navigate("/issues");
                            else if (event.type === "payment") navigate(`/vendors/${(event.originalData as any).vendor_id}`);
                            else if (event.type.startsWith("vault") || event.type === "renewal") navigate("/mou-vault");
                            else navigate("/mous");
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              <span className="font-medium text-sm">{event.title}</span>
                            </div>
                            {event.priority && <Badge variant="outline" className="text-xs">{event.priority}</Badge>}
                          </div>
                          {event.vendorName && <p className="text-xs mt-1 opacity-80">Vendor: {event.vendorName}</p>}
                          {event.status && <p className="text-xs mt-1 opacity-80">Status: {event.status.replace("_", " ").toUpperCase()}</p>}
                        </div>
                      );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <StickyNote className="h-4 w-4 text-primary" />
                  My notes
                </CardTitle>
                {user && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNote}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {personalNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select a calendar date to add your first private note.</p>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {[...personalNotes]
                    .sort((a, b) => a.note_date.localeCompare(b.note_date))
                    .map((note) => {
                      const isExpanded = expandedNotes.has(note.id);
                      return (
                        <div
                          key={note.id}
                          draggable
                          onDragStart={(e) => handleDragStartNote(note, e)}
                          className="group relative rounded-lg border bg-background transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:bg-primary/5"
                        >
                          <div className="flex items-start gap-2 p-2.5">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleEditNote(note)}
                                className="w-full text-left"
                              >
                                <p className="mb-1 text-[11px] font-semibold text-primary">{format(parseISO(note.note_date), "EEE, MMM d")}</p>
                                <p className={cn(
                                  "text-xs leading-relaxed text-muted-foreground transition-all duration-300",
                                  isExpanded ? "line-clamp-none" : "line-clamp-2"
                                )}>
                                  {note.content}
                                </p>
                              </button>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleNoteExpansion(note.id)}
                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteNote(note.id, e)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Elite Tip for Notes */}
          <Card className="bg-primary/5 border-primary/20 shadow-glow overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Elite Tip</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-poppins">
                    <strong>Drag and drop</strong> any event to a new date to instantly trigger the reschedule workflow. Legal dates update seamlessly across the system.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Upcoming (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const Icon = getEventIcon(event);
                    return (
                      <div
                        key={event.id}
                        className={cn("p-2 rounded-lg border text-xs cursor-pointer hover:shadow-sm transition-shadow", getEventColor(event))}
                        onClick={() => setSelectedDate(event.date)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{event.title.replace(/^(MOU|Issue|Vault|⚠ Terminate|🔄 Renewal|💰 Upfront|💳 Balance): /, "")}</p>
                            {event.vendorName && <p className="opacity-70 truncate">{event.vendorName}</p>}
                            <p className="opacity-80 mt-0.5">
                              {event.daysUntil === 0 ? "Today" : event.daysUntil === 1 ? "Tomorrow" : `${event.daysUntil} days`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
                <span>Overdue / Critical</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-warning/20 border border-warning/30" />
                <span>Due Soon (7 days)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-info/20 border border-info/30" />
                <span>Upcoming (30 days)</span>
              </div>
              <div className="mt-3 pt-2 border-t space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1"><FileText className="w-3 h-3" /> MOU Expiration</p>
                <p className="flex items-center gap-1"><Archive className="w-3 h-3 text-cyan-600" /> Vault Expiration</p>
                <p className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-orange-600" /> Termination Deadline</p>
                <p className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-violet-600" /> Renewal Projection</p>
                <p className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-600" /> Payment</p>
                <p className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Issue Due Date</p>
              </div>
            </CardContent>
          </Card>

          {/* Drag & Drop Info */}
          <Card className="bg-primary/5 border-primary/20 shadow-glow overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Elite Tip</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-poppins">
                    {canDragDrop ? (
                      <><strong>Drag and drop</strong> any event to a new date to instantly trigger the reschedule workflow. Legal dates update seamlessly across the system.</>
                    ) : (
                      <>View-only access active. <strong>Staff clearance</strong> required to reschedule operational events.</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedNote ? "Edit Note" : "Add Note"}</DialogTitle>
          </DialogHeader>
          {selectedDate && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Note for {format(selectedDate, "MMMM d, yyyy")}
              </p>
              <Textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                maxLength={2000}
                placeholder="Write your note for this date…"
                className="min-h-[120px] resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{noteDraft.length}/2000</span>
                <div className="flex gap-2">
                  {selectedNote && (
                    <Button variant="destructive" size="sm" onClick={async () => {
                      if (!selectedDate || !user?.id) return;
                      const noteDate = format(selectedDate, "yyyy-MM-dd");
                      setIsSavingNote(true);
                      try {
                        await (supabase as any).from("calendar_personal_notes").delete().eq("user_id", user.id).eq("note_date", noteDate);
                        await queryClient.invalidateQueries({ queryKey: ["calendar-personal-notes", user.id] });
                        setNoteDraft("");
                        setNoteDialogOpen(false);
                        toast.success("Note deleted");
                      } catch {
                        toast.error("Failed to delete note");
                      } finally {
                        setIsSavingNote(false);
                      }
                    }} disabled={isSavingNote}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button size="sm" onClick={async () => {
                    await handleSavePersonalNote();
                    if (!isSavingNote) setNoteDialogOpen(false);
                  }} disabled={isSavingNote || noteDraft.trim() === (selectedNote?.content || "")}>
                    {isSavingNote ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <StickyNote className="mr-2 h-3.5 w-3.5" />}
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleDialog} onOpenChange={() => setRescheduleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Event</DialogTitle>
          </DialogHeader>
          {rescheduleDialog && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Event</Label>
                <p className="font-medium">{rescheduleDialog.event.title}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Current Date</Label>
                <p>{format(rescheduleDialog.event.date, "MMMM d, yyyy")}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">New Date</Label>
                <p className="font-medium text-primary">{format(rescheduleDialog.newDate, "MMMM d, yyyy")}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRescheduleDialog(null)}>Cancel</Button>
                <Button onClick={handleReschedule}>Confirm Reschedule</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

interface PersonalCalendarNote {
  id: string;
  note_date: string;
  content: string;
}
