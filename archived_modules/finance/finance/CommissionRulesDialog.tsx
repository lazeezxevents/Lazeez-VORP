import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { useVendorFinancialProfile } from "@/components/hooks/useVendorFinancialProfile";
import type { CommissionModel, CommissionTier } from "@/components/finance/types";

interface CommissionRulesDialogProps {
  vendorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  commission_model: z.enum(['flat', 'percentage', 'tiered', 'category_based']),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  tiers: z.array(z.object({
    min_amount: z.number().min(0),
    max_amount: z.number().min(0),
    rate: z.number().min(0).max(100),
  })).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CommissionRulesDialog({
  vendorId,
  open,
  onOpenChange,
}: CommissionRulesDialogProps) {
  const { profile, updateCommissionRules, isUpdatingRules } = useVendorFinancialProfile(vendorId);
  const [tiers, setTiers] = useState<CommissionTier[]>(
    profile?.commission_rules?.tiers || []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      commission_model: profile?.commission_model || 'percentage',
      commission_rate: profile?.commission_rate || null,
      tiers: profile?.commission_rules?.tiers || [],
    },
  });

  const commissionModel = form.watch("commission_model");

  const onSubmit = (values: FormValues) => {
    const commissionRules: any = {
      model: values.commission_model,
    };

    if (values.commission_model === 'flat' || values.commission_model === 'percentage') {
      commissionRules.percentage_rate = values.commission_rate;
    } else if (values.commission_model === 'tiered') {
      commissionRules.tiers = tiers;
    }

    updateCommissionRules({
      commission_model: values.commission_model,
      commission_rate: values.commission_rate,
      commission_rules: commissionRules,
    });

    onOpenChange(false);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newTier: CommissionTier = {
      min_amount: lastTier ? lastTier.max_amount : 0,
      max_amount: lastTier ? lastTier.max_amount + 1000 : 1000,
      rate: 10,
    };
    setTiers([...tiers, newTier]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof CommissionTier, value: number) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure commission rules</DialogTitle>
          <DialogDescription>
            Set up how commissions are calculated for this vendor
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Commission Model */}
            <FormField
              control={form.control}
              name="commission_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission model</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select commission model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="flat">Flat rate</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="tiered">Tiered</SelectItem>
                      <SelectItem value="category_based">Category based</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose how commission is calculated for this vendor
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Flat/Percentage Rate */}
            {(commissionModel === 'flat' || commissionModel === 'percentage') && (
              <FormField
                control={form.control}
                name="commission_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {commissionModel === 'flat' ? 'Flat amount' : 'Percentage rate'}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={commissionModel === 'percentage' ? '100' : undefined}
                          placeholder={commissionModel === 'flat' ? '50.00' : '10.00'}
                          className="pl-9"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      {commissionModel === 'flat'
                        ? 'Fixed commission amount per order'
                        : 'Percentage of order amount (0-100%)'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tiered Configuration */}
            {commissionModel === 'tiered' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">Commission tiers</h3>
                    <p className="text-xs text-muted-foreground">
                      Define rate brackets based on order amount
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTier}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add tier
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {tiers.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <p className="text-sm">No tiers configured</p>
                      <p className="text-xs">Click "Add tier" to create commission brackets</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3">
                      {tiers.map((tier, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Min amount
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={tier.min_amount}
                                      onChange={(e) =>
                                        updateTier(index, 'min_amount', parseFloat(e.target.value))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Max amount
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={tier.max_amount}
                                      onChange={(e) =>
                                        updateTier(index, 'max_amount', parseFloat(e.target.value))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Rate (%)
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      value={tier.rate}
                                      onChange={(e) =>
                                        updateTier(index, 'rate', parseFloat(e.target.value))
                                      }
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeTier(index)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Category Based Info */}
            {commissionModel === 'category_based' && (
              <Card className="bg-info/5 border-info/20">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    Category-based commission rates will be configured per product category.
                    This feature requires integration with the product catalog.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingRules}>
                {isUpdatingRules ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
