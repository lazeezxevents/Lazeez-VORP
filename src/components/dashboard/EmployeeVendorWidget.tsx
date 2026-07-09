import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Users, Building2, ArrowRight, Plus, UserCheck, Loader2, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers, useAssignVendorToEmployee, AppRole } from "@/hooks/useUsers";
import { useVendors } from "@/hooks/useVendors";

interface EmployeeWithAssignments {
  id: string;
  full_name: string | null;
  email: string;
  department: string | null;
  designation: { name: string } | null;
  role: AppRole | null;
  assignments: {
    id: string;
    vendor_id: string;
    vendor: { id: string; name: string } | null;
  }[];
}

export function EmployeeVendorWidget() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data: vendors } = useVendors();
  const assignVendor = useAssignVendorToEmployee();

  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");

  // Fetch employees with their vendor assignments
  const { data: employeesWithAssignments, isLoading } = useQuery({
    queryKey: ["employees-with-assignments"],
    queryFn: async () => {
      // Get profiles with employee role
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department, designation_id")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "employee");

      if (rolesError) throw rolesError;

      // Get designations
      const { data: designations } = await supabase
        .from("designations")
        .select("id, name");

      // Get all assignments with vendor info
      const { data: assignments, error: assignmentsError } = await supabase
        .from("employee_vendor_assignments")
        .select(`
          id,
          employee_id,
          vendor_id,
          vendor:vendors(id, name)
        `);

      if (assignmentsError) throw assignmentsError;

      // Filter to only employees and merge data
      const employeeIds = new Set(roles?.map(r => r.user_id) || []);

      return (profiles || [])
        .filter(p => employeeIds.has(p.id))
        .map(profile => {
          const designation = designations?.find(d => d.id === profile.designation_id);
          const employeeAssignments = assignments?.filter(a => a.employee_id === profile.id) || [];

          return {
            ...profile,
            designation: designation ? { name: designation.name } : null,
            role: "employee" as AppRole,
            assignments: employeeAssignments.map(a => ({
              id: a.id,
              vendor_id: a.vendor_id,
              vendor: a.vendor as { id: string; name: string } | null,
            })),
          } as EmployeeWithAssignments;
        })
        .slice(0, 6); // Limit for widget
    },
  });

  const handleQuickAssign = async () => {
    if (!selectedEmployee || !selectedVendor) return;

    await assignVendor.mutateAsync({
      employeeId: selectedEmployee,
      vendorId: selectedVendor,
    });

    setSelectedEmployee("");
    setSelectedVendor("");
    setQuickAssignOpen(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  // Get available vendors for selected employee
  const getAvailableVendors = () => {
    if (!selectedEmployee || !employeesWithAssignments) return vendors?.filter(v => v.status === "active") || [];

    const employee = employeesWithAssignments.find(e => e.id === selectedEmployee);
    const assignedIds = new Set(employee?.assignments.map(a => a.vendor_id) || []);

    return vendors?.filter(v => v.status === "active" && !assignedIds.has(v.id)) || [];
  };

  if (!hasPermission("users.manage")) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Employee Assignments
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAssignOpen(true)}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Quick Assign
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className="text-muted-foreground"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : employeesWithAssignments && employeesWithAssignments.length > 0 ? (
            <ScrollArea className="h-[280px]">
              <div className="space-y-3">
                {employeesWithAssignments.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="gradient-primary text-primary-foreground text-sm">
                        {getInitials(employee.full_name, employee.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {employee.full_name || employee.email.split("@")[0]}
                        </p>
                        {employee.designation && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {employee.designation.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {employee.assignments.length > 0 ? (
                          employee.assignments.slice(0, 3).map((assignment) => (
                            <Badge
                              key={assignment.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              <Building2 className="w-3 h-3 mr-1" />
                              {assignment.vendor?.name || "Unknown"}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No vendors assigned
                          </span>
                        )}
                        {employee.assignments.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{employee.assignments.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No employees found</p>
              <p className="text-xs mt-1">Assign the "Employee" role to team members first</p>
            </div>
          )}

          {employeesWithAssignments && employeesWithAssignments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-muted-foreground"
              onClick={() => navigate("/settings")}
            >
              Manage All Assignments
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Quick Assign Dialog */}
      <Dialog open={quickAssignOpen} onOpenChange={setQuickAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Vendor Assignment</DialogTitle>
            <DialogDescription>
              Quickly assign a vendor to an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesWithAssignments?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <span>{emp.full_name || emp.email}</span>
                        {emp.designation && (
                          <span className="text-xs text-muted-foreground">
                            ({emp.designation.name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Vendor</Label>
              <Select
                value={selectedVendor}
                onValueChange={setSelectedVendor}
                disabled={!selectedEmployee}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedEmployee ? "Choose a vendor" : "Select employee first"} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableVendors().map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>{vendor.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {getAvailableVendors().length === 0 && selectedEmployee && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No available vendors
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAssign}
              disabled={!selectedEmployee || !selectedVendor || assignVendor.isPending}
            >
              {assignVendor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
