import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X } from "lucide-react";

const permissions = [
  {
    feature: "View Dashboard",
    admin: true,
    manager: true,
    employee: true,
  },
  {
    feature: "View Vendors",
    admin: true,
    manager: true,
    employee: true,
  },
  {
    feature: "Create/Edit Vendors",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Delete Vendors",
    admin: true,
    manager: false,
    employee: false,
  },
  {
    feature: "View Issues",
    admin: true,
    manager: true,
    employee: true,
  },
  {
    feature: "Create/Edit Issues",
    admin: true,
    manager: true,
    employee: true,
  },
  {
    feature: "View MOUs",
    admin: true,
    manager: true,
    employee: true,
  },
  {
    feature: "Create/Edit MOUs",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Approve MOUs",
    admin: true,
    manager: false,
    employee: false,
  },
  {
    feature: "Sign MOUs",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Delete MOUs",
    admin: true,
    manager: false,
    employee: false,
  },
  {
    feature: "View Analytics",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Manage Team",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Add/Remove Managers",
    admin: true,
    manager: false,
    employee: false,
  },
  {
    feature: "Add/Remove Employees",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Manage Designations",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Assign Vendors to Employees",
    admin: true,
    manager: true,
    employee: false,
  },
  {
    feature: "Access Settings",
    admin: true,
    manager: true,
    employee: true,
  },
];

const roleLabels = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

const roleColors = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-warning/10 text-warning",
  employee: "bg-info/10 text-info",
};

export function RolePermissions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Role Permissions
        </CardTitle>
        <CardDescription>
          Overview of what each role can do in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Feature</TableHead>
                <TableHead className="text-center">
                  <Badge className={roleColors.admin}>{roleLabels.admin}</Badge>
                </TableHead>
                <TableHead className="text-center">
                  <Badge className={roleColors.manager}>{roleLabels.manager}</Badge>
                </TableHead>
                <TableHead className="text-center">
                  <Badge className={roleColors.employee}>{roleLabels.employee}</Badge>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((p, index) => (
                <TableRow key={p.feature} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                  <TableCell className="font-medium">{p.feature}</TableCell>
                  <TableCell className="text-center">
                    {p.admin ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.manager ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.employee ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Role Hierarchy</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Admin:</strong> Full system access, can manage all users including managers</li>
            <li>• <strong>Manager:</strong> Same as Admin except cannot add/remove managers</li>
            <li>• <strong>Employee:</strong> Limited access, works with assigned vendors only</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
