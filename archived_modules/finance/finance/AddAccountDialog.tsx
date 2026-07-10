import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useChartOfAccounts } from "@/components/hooks/useChartOfAccounts";
import type { AccountType, CreateAccountInput } from "@/components/finance/types";

// =====================================================
// Validation Schema
// =====================================================

const accountSchema = z.object({
  code: z.string().min(1, "Account code is required").max(20, "Code must be 20 characters or less"),
  name: z.string().min(1, "Account name is required").max(100, "Name must be 100 characters or less"),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  sub_type: z.string().optional(),
  currency: z.string().default("USD"),
  parent_account_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type AccountFormData = z.infer<typeof accountSchema>;

// =====================================================
// Component
// =====================================================

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const { createAccount, createAccountAsync, isCreating, accounts } = useChartOfAccounts();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { currency: 'PKR', is_active: true },
  });

  const accountType = watch('type') as AccountType | undefined;
  const isActive = watch('is_active');

  // Inline parent creation state
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [parentCode, setParentCode] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentSubType, setParentSubType] = useState('');

  const onSubmit = async (data: AccountFormData) => {
    const input: CreateAccountInput = {
      code: data.code,
      name: data.name,
      type: data.type,
      sub_type: data.sub_type || undefined,
      currency: data.currency,
      parent_account_id: data.parent_account_id || undefined,
      is_active: data.is_active,
    };

    try {
      if (createAccountAsync) await createAccountAsync(input);
      else createAccount(input);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleCreateParent = async () => {
    if (!accountType) return;
    const parentInput: CreateAccountInput = {
      code: parentCode,
      name: parentName,
      type: accountType,
      sub_type: parentSubType || undefined,
      currency: 'PKR',
      is_active: true,
    };

    try {
      const created: any = createAccountAsync ? await createAccountAsync(parentInput) : await createAccount(parentInput);
      if (created?.id) setValue('parent_account_id', created.id);
      setParentCode(''); setParentName(''); setParentSubType(''); setShowCreateParent(false);
    } catch (err) {
      console.error('Failed to create parent account:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Add new account</DialogTitle>
          <DialogDescription>Create a new account in your chart of accounts</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Account code</Label>
              <Input id="code" placeholder="e.g., 1000" {...register('code')} className={errors.code ? 'border-destructive' : ''} />
              {errors.code ? (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Account code is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account type</Label>
              <Select value={accountType} onValueChange={(value) => setValue('type', value as AccountType)}>
                <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_account_id">Parent account (optional)</Label>
              <Select value={watch('parent_account_id') || 'none'} onValueChange={(value) => setValue('parent_account_id', value === 'none' ? undefined : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="No parent account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent account</SelectItem>
                  {accounts.filter((acc) => acc.type === accountType).map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-3 mt-2">
                <Button size="sm" variant="outline" onClick={() => setShowCreateParent(!showCreateParent)}>
                  {showCreateParent ? 'Cancel parent' : 'Create parent'}
                </Button>
                <div className="text-sm text-muted-foreground">Or create a new parent on the fly</div>
              </div>

              {showCreateParent && (
                <div className="mt-3 p-3 border rounded-md space-y-2 bg-muted/10">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Parent code" value={parentCode} onChange={(e) => setParentCode(e.target.value)} />
                    <Input placeholder="Parent name" value={parentName} onChange={(e) => setParentName(e.target.value)} />
                  </div>
                  <Input placeholder="Parent sub-type (optional)" value={parentSubType} onChange={(e) => setParentSubType(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowCreateParent(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreateParent} disabled={!parentCode || !parentName || !accountType}>Create parent</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account name</Label>
              <Input id="name" placeholder="e.g., Cash" {...register('name')} className={errors.name ? 'border-destructive' : ''} />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Account name is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub_type">Sub type (optional)</Label>
              <Input id="sub_type" placeholder="e.g., Current Asset" {...register('sub_type')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={watch('currency')} onValueChange={(value) => setValue('currency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active account</Label>
              <Switch id="is_active" checked={isActive} onCheckedChange={(checked) => setValue('is_active', checked)} />
            </div>

            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create account'}</Button>
              </motion.div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
