import { useState } from "react";
import { format, addDays } from "date-fns";
import { RefreshCw, Loader2, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MOUVaultItem, useRenewMOU } from "@/hooks/useMOUVault";
import { toast } from "sonner";

interface MOURenewalDialogProps {
  item: MOUVaultItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MOURenewalDialog({ item, open, onOpenChange }: MOURenewalDialogProps) {
  const [notes, setNotes] = useState("");
  const [renewalPeriod, setRenewalPeriod] = useState(90);
  const renewMOU = useRenewMOU();

  if (!item) return null;

  const currentEndDate = item.effective_end_date 
    ? new Date(item.effective_end_date) 
    : new Date();
  
  const newEndDate = addDays(currentEndDate, renewalPeriod);

  const handleRenew = async () => {
    try {
      await renewMOU.mutateAsync({
        vaultId: item.id,
        notes,
        renewalPeriodDays: renewalPeriod,
      });
      onOpenChange(false);
      setNotes("");
      toast.success("MOU renewed successfully");
    } catch (error) {
      toast.error("Failed to renew MOU");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Renew MOU
          </DialogTitle>
          <DialogDescription>
            Renew the MOU for "{item.document_name}" with the same terms and conditions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current End Date</span>
              <span className="font-medium">
                {item.effective_end_date 
                  ? format(new Date(item.effective_end_date), "MMMM d, yyyy")
                  : "Not set"}
              </span>
            </div>
            <div className="flex justify-between text-primary">
              <span>New End Date</span>
              <span className="font-medium">{format(newEndDate, "MMMM d, yyyy")}</span>
            </div>
            {item.renewal_count !== undefined && item.renewal_count > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Renewals</span>
                <span className="font-medium">{item.renewal_count}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="renewal-period">Renewal Period (days)</Label>
            <Input
              id="renewal-period"
              type="number"
              value={renewalPeriod}
              onChange={(e) => setRenewalPeriod(parseInt(e.target.value) || 90)}
              min={30}
              max={730}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="renewal-notes">Notes (optional)</Label>
            <Textarea
              id="renewal-notes"
              placeholder="Add any notes about this renewal..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRenew} disabled={renewMOU.isPending}>
            {renewMOU.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Renewing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Renew MOU
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
