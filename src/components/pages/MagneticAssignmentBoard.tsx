import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCircle2, GripVertical, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Types
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  department: string | null;
}

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
}

export function MagneticAssignmentBoard() {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all profiles and departments
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [profRes, deptRes] = await Promise.all([
          supabase.from("profiles").select("*").order("full_name"),
          (supabase.from("departments" as any) as any).select("*").order("name")
        ]);

        if (profRes.error) throw profRes.error;
        if (deptRes.error) throw deptRes.error;

        setProfiles(profRes.data as Profile[]);
        setDepartments(deptRes.data as Department[]);
      } catch (err: any) {
        toast.error("Failed to load assignment data", { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // Dropped in the same spot
    if (source.droppableId === destination.droppableId) return;

    const sourceDeptId = source.droppableId === "unassigned" ? null : source.droppableId;
    const destDeptId = destination.droppableId === "unassigned" ? null : destination.droppableId;

    // Find the profile
    const profileToMove = profiles.find((p) => p.id === draggableId);
    if (!profileToMove) return;

    // Optimistic UI Update
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id === draggableId) {
          const newDept = departments.find(d => d.id === destDeptId);
          return { 
            ...p, 
            department_id: destDeptId,
            department: newDept ? newDept.name : null
          };
        }
        return p;
      })
    );

    try {
      // Update in Supabase
      const { error } = await supabase
        .from("profiles")
        .update({ department_id: destDeptId, department: departments.find(d => d.id === destDeptId)?.name || null })
        .eq("id", draggableId);

      if (error) throw error;
      
      // Setup Audio feedback
      // const audio = new Audio("/sounds/snap.mp3");
      // audio.volume = 0.5;
      // audio.play().catch(() => {});
      
      toast.success("Assignment saved", {
        description: `${profileToMove.full_name || profileToMove.email} has been reassigned.`
      });
      
    } catch (err: any) {
      // Revert Optimistic Update
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === draggableId) {
            const originalDept = departments.find(d => d.id === sourceDeptId);
            return { 
              ...p, 
              department_id: sourceDeptId,
              department: originalDept ? originalDept.name : null
            };
          }
          return p;
        })
      );
      toast.error("Assignment failed", { description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full pb-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Initializing Magnetic Field...</p>
        </div>
      </div>
    );
  }

  // Group Profiles
  const getProfilesForDepartment = (deptId: string | null) => {
    if (deptId === null) {
      return profiles.filter((p) => !p.department_id);
    }
    return profiles.filter((p) => p.department_id === deptId);
  };

  // Identify managers among profiles
  const isManagerProfile = (profileId: string) => {
    return departments.some((d) => d.manager_id === profileId);
  };

  return (
    <div className="flex flex-col w-full h-full p-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 h-full overflow-x-auto pb-4 custom-scrollbar">
          
          {/* Global Unassigned Pool */}
          <Droppable droppableId="unassigned">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "flex flex-col min-w-[320px] max-w-[320px] bg-slate-900/5 dark:bg-slate-800/20 rounded-2xl border-2 transition-all duration-300",
                  snapshot.isDraggingOver ? "border-primary/50 shadow-[0_0_30px_rgba(237,0,79,0.15)] ring-2 ring-primary/20" : "border-dashed border-border/60"
                )}
              >
                <div className="p-4 border-b border-border/50 bg-background/50 rounded-t-2xl backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
                  <h3 className="font-bold text-lg font-montserrat flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    Unassigned Pool
                  </h3>
                  <Badge variant="secondary" className="rounded-full">
                    {getProfilesForDepartment(null).length}
                  </Badge>
                </div>
                
                <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                  {getProfilesForDepartment(null).map((profile, index) => (
                    <DraggableEmployee key={profile.id} profile={profile} index={index} isManager={isManagerProfile(profile.id)} />
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>

          {/* Department / Manager Buckets */}
          {departments.map((dept) => {
            const manager = profiles.find((p) => p.id === dept.manager_id);
            const deptProfiles = getProfilesForDepartment(dept.id);
            
            return (
              <Droppable key={dept.id} droppableId={dept.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex flex-col min-w-[320px] max-w-[320px] bg-card/80 backdrop-blur-md rounded-2xl border transition-all duration-300 shadow-sm",
                      snapshot.isDraggingOver ? "border-primary shadow-[0_0_40px_rgba(237,0,79,0.2)] ring-2 ring-primary/30 -translate-y-1" : "border-border/50",
                      manager ? "" : "opacity-80 grayscale" // Visual distinct for departments missing managers
                    )}
                  >
                    <div className="p-4 border-b border-border/50 bg-background rounded-t-2xl sticky top-0 z-10">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg font-montserrat truncate">{dept.name}</h3>
                          <Badge variant={snapshot.isDraggingOver ? "default" : "secondary"} className="rounded-full transition-colors">
                            {deptProfiles.length}
                          </Badge>
                        </div>
                        {/* Manager Display */}
                        {manager ? (
                          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary truncate max-w-[80px]">Lead:</span>
                            <Avatar className="w-6 h-6 border border-primary/30">
                              <AvatarImage src={manager.avatar_url || ""} />
                              <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{manager.email.substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate">{manager.full_name || manager.email.split('@')[0]}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 text-xs font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            No Manager Assigned
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar min-h-[150px]">
                      {deptProfiles.length === 0 && !snapshot.isDraggingOver && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2 pb-10">
                          <GripVertical className="w-8 h-8" />
                          <p className="text-sm font-medium">Drag users here</p>
                        </div>
                      )}
                      
                      {deptProfiles.map((profile, index) => (
                        <DraggableEmployee key={profile.id} profile={profile} index={index} isManager={isManagerProfile(profile.id)} />
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}

        </div>
      </DragDropContext>
    </div>
  );
}

// Draggable Sub-Component
function DraggableEmployee({ profile, index, isManager }: { profile: Profile; index: number; isManager: boolean }) {
  return (
    <Draggable draggableId={profile.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "group relative flex items-center gap-3 p-3 bg-background border rounded-xl shadow-sm transition-all duration-200 select-none",
            snapshot.isDragging ? "shadow-2xl ring-2 ring-primary scale-105 z-50 border-primary" : "border-border/60 hover:border-primary/50 hover:shadow-md",
            isManager && !snapshot.isDragging ? "ring-1 ring-primary/40 bg-primary/5" : ""
          )}
        >
          {/* Magnetic Glow Effect */}
          {snapshot.isDragging && (
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl -z-10" />
          )}

          <div className="cursor-grab active:cursor-grabbing text-muted-foreground group-hover:text-primary transition-colors">
            <GripVertical className="w-5 h-5" />
          </div>
          
          <Avatar className="w-10 h-10 border shadow-sm">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="bg-muted text-foreground">
              {profile.email.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">
                {profile.full_name || "Unnamed User"}
              </span>
              {isManager && (
                 <Badge variant="default" className="text-[9px] px-1.5 h-4 translate-y-[-1px]">MGR</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate font-poppins">
              {profile.email}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
