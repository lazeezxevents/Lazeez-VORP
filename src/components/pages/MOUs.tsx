import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, MoreHorizontal, FileText, Download,
  CheckCircle, PenLine, Trash2, Send, Paperclip, History, Diff, FolderLock, LayoutList
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMOUs } from "@/components/hooks/useMOUs";
import { useAuth } from "@/contexts/AuthContext";
import { MOUCreationWizard } from "@/components/mous/wizard/MOUCreationWizard";
import { MOUForm } from "@/components/mous/MOUForm";
import { VendorCreationChoice } from "@/components/vendors/VendorCreationChoice";
import MOUVaultContent from "@/components/pages/MOUVaultContent";
import { MOUVersionHistory } from "@/components/mous/MOUVersionHistory";
import { MOUVersionComparison } from "@/components/mous/MOUVersionComparison";
import { generateMOUPDF } from "@/utils/pdfGenerator";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  signed: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
  terminated: "bg-destructive/10 text-destructive",
  legacy: "bg-muted text-muted-foreground border-dashed border-2",
};

export default function MOUs() {
  const { mous, isLoading, approveMOU, signMOU, deleteMOU, updateMOU } = useMOUs();
  const { isStaff, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [editMOU, setEditMOU] = useState<typeof mous[0] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyMOU, setHistoryMOU] = useState<{ id: string; title: string } | null>(null);
  const [compareMOU, setCompareMOU] = useState<{ id: string; title: string } | null>(null);

  const filteredMOUs = mous.filter(mou =>
    mou.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mou.vendor as { name: string } | null)?.name?.toLowerCase()?.includes(searchQuery.toLowerCase())
  );

  const handleEdit = (mou: typeof mous[0]) => {
    setEditMOU(mou);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMOU.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleExportPDF = (mou: typeof mous[0]) => {
    generateMOUPDF({
      title: mou.title,
      vendor: mou.vendor as { name: string } | null,
      terms: mou.terms,
      start_date: mou.start_date,
      end_date: mou.end_date,
      status: mou.status,
      created_at: mou.created_at,
    });
  };

  const handleSubmitForReview = async (id: string) => {
    await updateMOU.mutateAsync({ id, status: "pending_review" });
  };

  const stats = [
    { label: "Total MOUs", value: mous.length, icon: FileText },
    { label: "Active", value: mous.filter(m => m.status === "signed" || m.status === "approved").length, icon: CheckCircle },
    { label: "Pending Review", value: mous.filter(m => m.status === "pending_review").length, icon: Send },
    { label: "Draft", value: mous.filter(m => m.status === "draft").length, icon: PenLine },
    { label: "Legacy", value: mous.filter(m => m.status === "legacy").length, icon: History },
  ];

  return (
    <DashboardLayout title="MOUs" subtitle="Manage memorandums of understanding">
      {wizardOpen && <MOUCreationWizard onClose={() => setWizardOpen(false)} />}

      <VendorCreationChoice
        open={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        onChooseAI={() => {
          setChoiceOpen(false);
          setWizardOpen(true);
        }}
        onChooseManual={() => {
          setChoiceOpen(false);
          setFormOpen(true);
        }}
      />

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list" className="gap-2">
            <LayoutList className="w-4 h-4" />
            MOUs Management
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-2">
            <FolderLock className="w-4 h-4" />
            MOU Vault & AI Extractions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 animate-fade-in">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search MOUs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {isStaff && (
              <Button onClick={() => setChoiceOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New MOU
              </Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredMOUs.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">No MOUs found</h3>
                  <p className="text-muted-foreground mt-1">Create your first MOU to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMOUs.map((mou) => (
                      <TableRow key={mou.id}>
                        <TableCell className="font-medium">{mou.title}</TableCell>
                        <TableCell>{(mou.vendor as { name: string } | null)?.name || "-"}</TableCell>
                        <TableCell>
                          {mou.start_date && mou.end_date
                            ? `${format(new Date(mou.start_date), "MMM d, yyyy")} - ${format(new Date(mou.end_date), "MMM d, yyyy")}`
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[mou.status]}>
                            {mou.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mou.document_url ? (
                            <Paperclip className="w-4 h-4 text-success" />
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(mou.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setHistoryMOU({ id: mou.id, title: mou.title })}>
                                <History className="w-4 h-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCompareMOU({ id: mou.id, title: mou.title })}>
                                <Diff className="w-4 h-4 mr-2" />
                                Compare Versions
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportPDF(mou)}>
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                              </DropdownMenuItem>
                              {isStaff && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEdit(mou)}>
                                    <PenLine className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  {mou.status === "draft" && (
                                    <DropdownMenuItem onClick={() => handleSubmitForReview(mou.id)}>
                                      <Send className="w-4 h-4 mr-2" />
                                      Submit for Review
                                    </DropdownMenuItem>
                                  )}
                                  {mou.status === "pending_review" && isAdmin && (
                                    <DropdownMenuItem onClick={() => approveMOU.mutateAsync(mou.id)}>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </DropdownMenuItem>
                                  )}
                                  {mou.status === "approved" && (
                                    <DropdownMenuItem onClick={() => signMOU.mutateAsync(mou.id)}>
                                      <PenLine className="w-4 h-4 mr-2" />
                                      Mark as Signed
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteId(mou.id)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vault" className="space-y-6 animate-fade-in">
          <MOUVaultContent />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <MOUForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editMOU={editMOU || undefined}
      />

      {/* Version History Dialog */}
      {historyMOU && (
        <MOUVersionHistory
          open={!!historyMOU}
          onOpenChange={(open) => !open && setHistoryMOU(null)}
          mouId={historyMOU.id}
          mouTitle={historyMOU.title}
        />
      )}

      {/* Version Comparison Dialog */}
      {compareMOU && (
        <MOUVersionComparison
          open={!!compareMOU}
          onOpenChange={(open) => !open && setCompareMOU(null)}
          mouId={compareMOU.id}
          mouTitle={compareMOU.title}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MOU?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The MOU will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
