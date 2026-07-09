import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  useUsers,
  useDepartments,
  useEmployeeVendorAssignments,
  useAssignVendorToEmployee,
  useRemoveVendorAssignment,
  AppRole
} from "@/hooks/useUsers";
import { useVendors } from "@/hooks/useVendors";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Search, Plus, X, UserCheck, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function VendorAssignment() {
  const { user, isAdmin, isStaff: isGlobalStaff, isManager } = useAuth();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const { data: departmentsData } = useDepartments();
  const assignVendor = useAssignVendorToEmployee();
  const removeAssignment = useRemoveVendorAssignment();

  // Get the managed department for filtering
  const managedDepartment = departmentsData?.find(d => d.manager_id === user?.id);
  const isStaff = isGlobalStaff || isManager;

  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>(searchParams.get("vendorId") || "");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    const vId = searchParams.get("vendorId");
    if (vId) setSelectedVendor(vId);
  }, [searchParams]);

  // Get employees only
  const employees = users?.filter((u) => {
    const isBaseEmployee = u.role === "employee" || u.role === "ops_manager" || u.role === "admin";
    if (!isBaseEmployee) return false;

    // If global staff, see all
    if (isGlobalStaff) return true;

    // If manager, only see employees in their department
    if (isManager && managedDepartment) {
      return u.department === managedDepartment.name;
    }

    return false;
  }) || [];

  // Filter employees based on search
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get assignments for selected employee
  const { data: assignments, isLoading: assignmentsLoading } = useEmployeeVendorAssignments(
    selectedEmployee || undefined
  );

  const handleAssignVendor = async () => {
    if (!selectedEmployee || !selectedVendor) return;
    await assignVendor.mutateAsync({
      employeeId: selectedEmployee,
      vendorId: selectedVendor,
    });
    setSelectedVendor("");
    setAssignDialogOpen(false);
  };

  const handleRemoveAssignment = async () => {
    if (!selectedAssignmentId) return;
    await removeAssignment.mutateAsync(selectedAssignmentId);
    setSelectedAssignmentId(null);
    setRemoveDialogOpen(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getAssignedVendorIds = () => {
    return assignments?.map((a) => a.vendor_id) || [];
  };

  const availableVendors = vendors?.filter(
    (v) => v.status === "active" && !getAssignedVendorIds().includes(v.id)
  );

  const isLoading = usersLoading || vendorsLoading;

  if (!isStaff) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          You don't have permission to manage vendor assignments.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Vendor Assignments
            </CardTitle>
            <CardDescription>
              Assign vendors to employees for account management
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Select Employee */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Search Employees</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Select Employee</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee" />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.map((emp) => (
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
                {filteredEmployees.length === 0 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No employees found. Assign "Employee" role to users first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Employee Details Card */}
        {selectedEmployee && (
          <div className="border rounded-lg p-4 bg-muted/20">
            {(() => {
              const emp = employees.find((e) => e.id === selectedEmployee);
              if (!emp) return null;
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="gradient-primary text-primary-foreground">
                        {getInitials(emp.full_name, emp.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {emp.full_name || "Unnamed Employee"}
                      </p>
                      <p className="text-sm text-muted-foreground">{emp.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {emp.designation && (
                          <Badge variant="secondary" className="text-xs">
                            {emp.designation.name}
                          </Badge>
                        )}
                        {emp.department && (
                          <Badge variant="outline" className="text-xs">
                            {emp.department}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1">
                        <Plus className="w-4 h-4" />
                        Assign Vendor
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Vendor to Employee</DialogTitle>
                        <DialogDescription>
                          Select a vendor to assign to {emp.full_name || emp.email}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Select Vendor</Label>
                          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a vendor" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableVendors?.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    <span>{vendor.name}</span>
                                    <span className="text-xs text-muted-foreground capitalize">
                                      ({vendor.category})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                              {availableVendors?.length === 0 && (
                                <div className="p-2 text-center text-sm text-muted-foreground">
                                  No available vendors to assign
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAssignVendor}
                          disabled={!selectedVendor || assignVendor.isPending}
                        >
                          {assignVendor.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Assign Vendor
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })()}
          </div>
        )}

        {/* Assigned Vendors Table */}
        {selectedEmployee && (
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Assigned Vendors</h4>
            {assignmentsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : assignments && assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary-foreground" />
                          </div>
                          <span className="font-medium">
                            {assignment.vendor?.name || "Unknown Vendor"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(assignment.assigned_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setSelectedAssignmentId(assignment.id);
                            setRemoveDialogOpen(true);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="border border-dashed rounded-lg p-8 text-center">
                <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No vendors assigned yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Assign Vendor" to add vendors to this employee
                </p>
              </div>
            )}
          </div>
        )}

        {/* No Employee Selected State */}
        {!selectedEmployee && !isLoading && (
          <div className="border border-dashed rounded-lg p-8 text-center">
            <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground">Select an Employee</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose an employee from the dropdown above to manage their vendor assignments
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Remove Assignment Confirmation */}
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this vendor assignment? The employee will no longer
                have access to manage this vendor.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveAssignment}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeAssignment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
