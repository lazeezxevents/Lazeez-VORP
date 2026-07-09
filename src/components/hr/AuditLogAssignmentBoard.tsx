import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, Link2, Unlink, Search, ShieldCheck, Users, Zap,
  CheckCircle2, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAllAuditAccessEntries,
  useAssignAuditAccess,
  useRevokeAuditAccess,
  ManagerAuditAccessEntry,
} from "@/hooks/useManagerAuditAccess";
import { useEmployeePerformance, EmployeeKPI } from "@/hooks/useEmployeePerformance";

interface AuditLogAssignmentBoardProps {
  managers: EmployeeKPI[];
  employees: EmployeeKPI[];
}

interface ConnectionLine {
  id: string;
  managerId: string;
  employeeId: string;
  managerName: string;
  employeeName: string;
}

export function AuditLogAssignmentBoard({ managers, employees }: AuditLogAssignmentBoardProps) {
  const { data: accessEntries = [], isLoading } = useAllAuditAccessEntries();
  const assignAccess = useAssignAuditAccess();
  const revokeAccess = useRevokeAuditAccess();

  const [searchManager, setSearchManager] = useState("");
  const [searchEmployee, setSearchEmployee] = useState("");
  const [draggedEmployee, setDraggedEmployee] = useState<EmployeeKPI | null>(null);
  const [nearestManager, setNearestManager] = useState<string | null>(null);
  const [magneticStrength, setMagneticStrength] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const managerRefs = useRef<Map<string, DOMRect>>(new Map());

  // Build connection map
  const connections: ConnectionLine[] = useMemo(() => {
    return (accessEntries as ManagerAuditAccessEntry[]).map(entry => ({
      id: entry.id,
      managerId: entry.manager_id,
      employeeId: entry.employee_id,
      managerName: entry.manager_name || "Unknown",
      employeeName: entry.employee_name || "Unknown",
    }));
  }, [accessEntries]);

  const connectedEmployeeIds = new Set(connections.map(c => c.employeeId));

  const filteredManagers = managers.filter(m =>
    m.fullName?.toLowerCase().includes(searchManager.toLowerCase())
  );
  const filteredEmployees = employees.filter(e =>
    e.fullName?.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  // Calculate manager positions for magnetic detection
  const updateManagerPositions = useCallback(() => {
    const refs = new Map<string, DOMRect>();
    filteredManagers.forEach(mgr => {
      const el = document.getElementById(`manager-port-${mgr.id}`);
      if (el) refs.set(mgr.id, el.getBoundingClientRect());
    });
    managerRefs.current = refs;
  }, [filteredManagers]);

  useEffect(() => {
    updateManagerPositions();
    window.addEventListener("resize", updateManagerPositions);
    return () => window.removeEventListener("resize", updateManagerPositions);
  }, [updateManagerPositions]);

  // Magnetic field detection during drag
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggedEmployee) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    let closest: string | null = null;
    let minDist = Infinity;
    const MAGNETIC_RADIUS = 120;
    const SNAP_RADIUS = 40;

    managerRefs.current.forEach((rect, mgrId) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);

      if (dist < MAGNETIC_RADIUS && dist < minDist) {
        minDist = dist;
        closest = mgrId;
      }
    });

    setNearestManager(closest);
    setMagneticStrength(closest ? Math.max(0, 1 - minDist / MAGNETIC_RADIUS) : 0);

    // Auto-snap connection
    if (closest && minDist < SNAP_RADIUS) {
      const alreadyConnected = connections.some(
        c => c.managerId === closest && c.employeeId === draggedEmployee.id
      );
      if (!alreadyConnected) {
        assignAccess.mutate({
          manager_id: closest,
          employee_id: draggedEmployee.id,
        });
        setDraggedEmployee(null);
        setNearestManager(null);
        setMagneticStrength(0);
      }
    }
  }, [draggedEmployee, connections, assignAccess]);

  useEffect(() => {
    if (draggedEmployee) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("touchmove", handleDragMove);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("touchmove", handleDragMove);
      };
    }
  }, [draggedEmployee, handleDragMove]);

  const handleDisconnect = (entryId: string) => {
    revokeAccess.mutate(entryId);
  };

  return (
    <div className="space-y-6 animate-fade-in" ref={boardRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
            <Eye className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg font-montserrat tracking-tight">Audit Log Assignment</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Drag employees onto manager ports to grant audit log visibility
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] font-bold h-6 gap-1">
          <Link2 className="w-3 h-3" /> {connections.length} Active Connections
        </Badge>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manager Panel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Managers</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search managers..."
              value={searchManager}
              onChange={e => setSearchManager(e.target.value)}
              className="pl-9 rounded-xl border-border/50 h-9 text-xs"
            />
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredManagers.map(mgr => {
              const mgrConnections = connections.filter(c => c.managerId === mgr.id);
              const isNearest = nearestManager === mgr.id;

              return (
                <motion.div
                  key={mgr.id}
                  layout
                  className={cn(
                    "p-3 rounded-2xl border transition-all duration-300",
                    isNearest
                      ? "border-violet-500/60 bg-violet-500/5 ring-2 ring-violet-500/20 scale-[1.02]"
                      : "border-border/50 bg-card/80 hover:border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 ring-2 ring-primary/10">
                      <AvatarImage src={mgr.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px] font-bold">{mgr.fullName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{mgr.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{mgr.department || "No Dept"}</p>
                    </div>
                    {/* Connector Port */}
                    <div
                      id={`manager-port-${mgr.id}`}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed transition-all duration-300 cursor-pointer",
                        isNearest
                          ? "border-violet-500 bg-violet-500/20 scale-125 animate-pulse"
                          : "border-muted-foreground/20 hover:border-primary/40"
                      )}
                    >
                      <Zap className={cn("w-3.5 h-3.5", isNearest ? "text-violet-500" : "text-muted-foreground/40")} />
                    </div>
                  </div>

                  {/* Connected Employees */}
                  {mgrConnections.length > 0 && (
                    <div className="mt-3 space-y-1.5 pl-12">
                      {mgrConnections.map(conn => (
                        <motion.div
                          key={conn.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-1.5 px-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl group"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{conn.employeeName}</span>
                          </div>
                          <button
                            onClick={() => handleDisconnect(conn.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-500/10 rounded-lg"
                            title="Revoke access"
                          >
                            <Unlink className="w-3 h-3 text-rose-500" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Connection Visual */}
        <div className="hidden lg:flex flex-col items-center justify-center space-y-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <motion.div
              animate={{
                scale: draggedEmployee ? [1, 1.3, 1] : 1,
                opacity: draggedEmployee ? 1 : 0.3,
              }}
              transition={{ repeat: draggedEmployee ? Infinity : 0, duration: 1.5 }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-primary/20 flex items-center justify-center border-2 border-dashed border-violet-500/30"
            >
              <ArrowRight className="w-6 h-6 text-violet-500" />
            </motion.div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">
                {draggedEmployee ? `Connecting ${draggedEmployee.fullName}...` : "Drag to Connect"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {draggedEmployee
                  ? "Move toward a manager port to grant visibility"
                  : "Click an employee card and drag to a manager port"}
              </p>
            </div>
          </div>

          {/* Magnetic field indicator */}
          {magneticStrength > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-xl"
            >
              <p className="text-[10px] font-bold text-violet-500">
                Magnetic Field: {Math.round(magneticStrength * 100)}%
              </p>
            </motion.div>
          )}
        </div>

        {/* Employee Panel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Employees</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchEmployee}
              onChange={e => setSearchEmployee(e.target.value)}
              className="pl-9 rounded-xl border-border/50 h-9 text-xs"
            />
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredEmployees.map(emp => {
              const isConnected = connectedEmployeeIds.has(emp.id);
              const isDragging = draggedEmployee?.id === emp.id;
              const empConnections = connections.filter(c => c.employeeId === emp.id);

              return (
                <motion.div
                  key={emp.id}
                  layout
                  drag
                  dragConstraints={boardRef}
                  dragElastic={0.1}
                  onDragStart={() => {
                    setDraggedEmployee(emp);
                    updateManagerPositions();
                  }}
                  onDragEnd={() => {
                    setDraggedEmployee(null);
                    setNearestManager(null);
                    setMagneticStrength(0);
                  }}
                  whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0 10px 30px rgba(139, 92, 246, 0.3)" }}
                  className={cn(
                    "p-3 rounded-2xl border cursor-grab active:cursor-grabbing transition-all",
                    isDragging
                      ? "border-violet-500 bg-violet-500/5"
                      : isConnected
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border/50 bg-card/80 hover:border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className={cn("w-9 h-9", isConnected ? "ring-2 ring-emerald-500/20" : "ring-2 ring-border/50")}>
                      <AvatarImage src={emp.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px] font-bold">{emp.fullName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{emp.fullName}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-muted-foreground truncate">{emp.designation || emp.department || "—"}</p>
                        {isConnected && (
                          <Badge variant="secondary" className="text-[8px] h-4 py-0 bg-emerald-500/10 text-emerald-500 border-none">
                            Linked ({empConnections.length})
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
