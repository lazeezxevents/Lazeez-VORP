import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Calculator, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useGeneralLedger } from "@/components/hooks/useGeneralLedger";
import { useChartOfAccounts } from "@/components/hooks/useChartOfAccounts";
import { createJournalEntrySchema, type CreateJournalEntryInput } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Journal Entry Form Component
 * 
 * Multi-line entry form with:
 * - Debit/credit columns
 * - Real-time balance validation
 * - Account selection with autocomplete
 * - Running totals
 * 
 * Requirements: 1.2
 */
export function JournalEntryForm({ onSuccess }: { onSuccess?: () => void }) {
  const { createJournalEntry, isCreating } = useGeneralLedger();
  const { accounts } = useChartOfAccounts();
  const [showAccountSearch, setShowAccountSearch] = useState<number | null>(null);

  const form = useForm<CreateJournalEntryInput>({
    resolver: zodResolver(createJournalEntrySchema),
    defaultValues: {
      entry_date: new Date().toISOString().split('T')[0],
      description: "",
      reference: "",
      ledger_entries: [
        { account_id: "", debit: 0, credit: 0, currency: "PKR", description: "" },
        { account_id: "", debit: 0, credit: 0, currency: "PKR", description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ledger_entries",
  });

  // Calculate running totals
  const ledgerEntries = form.watch("ledger_entries");
  const totalDebits = ledgerEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredits = ledgerEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01;

  const onSubmit = (data: CreateJournalEntryInput) => {
    createJournalEntry(data, {
      onSuccess: (result) => {
        if (result.success) {
          form.reset();
          onSuccess?.();
        }
      },
    });
  };

  const addLine = () => {
    append({ account_id: "", debit: 0, credit: 0, currency: "PKR", description: "" });
  };

  const handleDebitChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    form.setValue(`ledger_entries.${index}.debit`, numValue);
    if (numValue > 0) {
      form.setValue(`ledger_entries.${index}.credit`, 0);
    }
  };

  const handleCreditChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    form.setValue(`ledger_entries.${index}.credit`, numValue);
    if (numValue > 0) {
      form.setValue(`ledger_entries.${index}.debit`, 0);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create journal entry</CardTitle>
        <CardDescription>
          Record a new journal entry with balanced debits and credits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Information */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <motion.div variants={itemVariants}>
              <Label htmlFor="entry_date">Entry date</Label>
              <Input
                id="entry_date"
                type="date"
                {...form.register("entry_date")}
                className="mt-1"
              />
              {form.formState.errors.entry_date && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.entry_date.message}
                </p>
              )}
            </motion.div>

            <motion.div variants={itemVariants}>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                placeholder="e.g., INV-001"
                {...form.register("reference")}
                className="mt-1"
              />
            </motion.div>

            <motion.div variants={itemVariants} className="md:col-span-1">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description"
                {...form.register("description")}
                className="mt-1"
              />
            </motion.div>
          </motion.div>

          {/* Ledger Entries Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Ledger entries</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add line
              </Button>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-2">
              <div className="col-span-4">Account</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>

            {/* Ledger Entry Rows */}
            <AnimatePresence mode="popLayout">
              {fields.map((field, index) => {
                const selectedAccount = accounts.find(
                  acc => acc.id === form.watch(`ledger_entries.${index}.account_id`)
                );

                return (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 items-start p-3 sm:p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Account Selection */}
                    <div className="sm:col-span-4">
                      <Label className="sm:hidden text-xs text-muted-foreground mb-1">Account</Label>
                      <Select
                        value={form.watch(`ledger_entries.${index}.account_id`)}
                        onValueChange={(value) =>
                          form.setValue(`ledger_entries.${index}.account_id`, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account">
                            {selectedAccount && (
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {selectedAccount.code}
                                </span>
                                <span className="text-sm">{selectedAccount.name}</span>
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter(acc => acc.is_active)
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {account.code}
                                  </span>
                                  <span>{account.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {account.type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.ledger_entries?.[index]?.account_id && (
                        <p className="text-xs text-destructive mt-1">
                          {form.formState.errors.ledger_entries[index]?.account_id?.message}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-3">
                      <Label className="sm:hidden text-xs text-muted-foreground mb-1">Description</Label>
                      <Input
                        placeholder="Line description"
                        {...form.register(`ledger_entries.${index}.description`)}
                        className="text-sm"
                      />
                    </div>

                    {/* Debit and Credit - Side by side on mobile */}
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      {/* Debit */}
                      <div className="sm:col-span-2">
                        <Label className="sm:hidden text-xs text-muted-foreground mb-1">Debit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.watch(`ledger_entries.${index}.debit`) || ""}
                          onChange={(e) => handleDebitChange(index, e.target.value)}
                          className="text-right font-mono"
                        />
                      </div>

                      {/* Credit */}
                      <div className="sm:col-span-2">
                        <Label className="sm:hidden text-xs text-muted-foreground mb-1">Credit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.watch(`ledger_entries.${index}.credit`) || ""}
                          onChange={(e) => handleCreditChange(index, e.target.value)}
                          className="text-right font-mono"
                        />
                      </div>
                    </div>

                    {/* Delete Button */}
                    <div className="sm:col-span-1 flex justify-end sm:justify-end">
                      {fields.length > 2 && (
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Totals Row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 p-3 rounded-lg bg-muted/50 border-2 border-border"
            >
              <div className="sm:col-span-7 flex items-center gap-2 font-semibold">
                <Calculator className="w-4 h-4" />
                Totals
              </div>
              <div className="sm:col-span-2 text-right font-mono font-bold">
                <span className="text-xs text-muted-foreground sm:hidden">Debit: </span>
                ₨{totalDebits.toFixed(2)}
              </div>
              <div className="sm:col-span-2 text-right font-mono font-bold">
                <span className="text-xs text-muted-foreground sm:hidden">Credit: </span>
                ₨{totalCredits.toFixed(2)}
              </div>
              <div className="sm:col-span-1 flex justify-center sm:justify-center mt-2 sm:mt-0">
                {isBalanced ? (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="default" className="bg-success text-success-foreground cursor-default">
                      Balanced
                    </Badge>
                  </motion.div>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="destructive" className="cursor-default">
                      Off by ₨{Math.abs(difference).toFixed(2)}
                    </Badge>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Validation Alert */}
          {!isBalanced && ledgerEntries.length >= 2 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Journal entry must be balanced. Total debits must equal total credits.
                Current difference: ₨{Math.abs(difference).toFixed(2)}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Errors */}
          {form.formState.errors.ledger_entries && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {form.formState.errors.ledger_entries.message ||
                  "Please check the ledger entries for errors"}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isCreating}
            >
              Reset
            </Button>
            <Button type="submit" disabled={isCreating || !isBalanced}>
              {isCreating ? "Creating..." : "Create journal entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
