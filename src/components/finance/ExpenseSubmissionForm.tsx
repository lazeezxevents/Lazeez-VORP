import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, X, FileText, AlertCircle, Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSubmitExpense } from "./useExpenses";
import { expensePolicyValidator } from "./ExpensePolicyValidator";
import { supabase } from "@/integrations/supabase/client";

/**
 * Expense Submission Form
 * 
 * Features:
 * - Category, amount, date, description fields
 * - Receipt upload with drag-and-drop
 * - Receipt preview
 * - Optimistic UI updates
 * - Framer Motion animations
 * - Policy limit warnings
 * 
 * Requirements: 9.1, 9.2
 * Task: 18.5 Build expense submission form
 */

// =====================================================
// Form Schema
// =====================================================

const expenseFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  projectId: z.string().optional(),
  vendorId: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// =====================================================
// Expense Categories
// =====================================================

const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Supplies",
  "Technology",
  "Marketing",
  "Training",
  "Entertainment",
  "Other",
];

// =====================================================
// Component
// =====================================================

export function ExpenseSubmissionForm() {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [policyWarning, setPolicyWarning] = useState<string | null>(null);
  const [showCustomCategoryDialog, setShowCustomCategoryDialog] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const submitExpense = useSubmitExpense();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: "",
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: "",
    },
  });

  // Check policy limits when amount or category changes
  const watchedAmount = form.watch("amount");
  const watchedCategory = form.watch("category");

  useState(() => {
    if (watchedAmount > 0 && watchedCategory) {
      const policyLimit = expensePolicyValidator.getPolicyLimit(watchedCategory);
      if (policyLimit && watchedAmount > policyLimit.maxAmount) {
        setPolicyWarning(
          `This amount exceeds the policy limit of ₨${policyLimit.maxAmount.toLocaleString()} for ${watchedCategory}`
        );
      } else if (policyLimit && watchedAmount >= policyLimit.receiptThreshold && !receiptFile) {
        setPolicyWarning(
          `Receipt is required for ${watchedCategory} expenses of ₨${policyLimit.receiptThreshold.toLocaleString()} or more`
        );
      } else {
        setPolicyWarning(null);
      }
    }
  });

  // Handle custom category creation
  const handleAddCustomCategory = async () => {
    if (!customCategoryName.trim()) return;

    try {
      setIsAddingCategory(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert custom category into expense_categories table
      const { error } = await supabase
        .from('expense_categories')
        .insert({
          name: customCategoryName.trim(),
          created_by: user.id,
          is_custom: true,
        });

      if (error) throw error;

      // Update form value with new category
      form.setValue('category', customCategoryName.trim());

      // Reset dialog state
      setCustomCategoryName("");
      setShowCustomCategoryDialog(false);
    } catch (error) {
      console.error('Error adding custom category:', error);
      form.setError("root", { message: "Failed to add custom category" });
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif)|application\/pdf$/)) {
      form.setError("root", {
        message: "Only images (JPG, PNG, GIF) and PDF files are allowed",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      form.setError("root", {
        message: "File size must be less than 10MB",
      });
      return;
    }

    setReceiptFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Upload receipt to storage
  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setUploadingReceipt(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Handle form submission
  const onSubmit = async (values: ExpenseFormValues) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        form.setError("root", { message: "You must be logged in to submit expenses" });
        return;
      }

      // Upload receipt if provided
      let receiptUrl: string | undefined;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile) || undefined;
      }

      // Submit expense
      await submitExpense.mutateAsync({
        employeeId: user.id,
        category: values.category,
        amount: values.amount,
        currency: 'PKR',
        date: new Date(values.date),
        description: values.description,
        receiptUrl,
        projectId: values.projectId,
        vendorId: values.vendorId,
      });

      // Reset form
      form.reset();
      setReceiptFile(null);
      setReceiptPreview(null);
      setPolicyWarning(null);
    } catch (error) {
      console.error('Error submitting expense:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Submit expense</CardTitle>
          <CardDescription>
            Submit a new expense for approval and reimbursement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Custom Category Dialog */}
                      <Dialog open={showCustomCategoryDialog} onOpenChange={setShowCustomCategoryDialog}>
                        <DialogTrigger asChild>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button type="button" variant="outline" size="icon">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add custom category</DialogTitle>
                            <DialogDescription>
                              Create a new expense category for your organization
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label htmlFor="category-name" className="text-sm font-medium">
                                Category name
                              </label>
                              <Input
                                id="category-name"
                                placeholder="Enter category name"
                                value={customCategoryName}
                                onChange={(e) => setCustomCategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomCategory();
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowCustomCategoryDialog(false);
                                setCustomCategoryName("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={handleAddCustomCategory}
                              disabled={!customCategoryName.trim() || isAddingCategory}
                            >
                              {isAddingCategory ? 'Adding...' : 'Add category'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (PKR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the expense amount in Pakistani Rupees
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the expense and its business purpose..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details about the expense and why it was necessary
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Policy Warning */}
              {policyWarning && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{policyWarning}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Receipt Upload */}
              <div className="space-y-2">
                <FormLabel>Receipt</FormLabel>
                <motion.div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  {receiptFile ? (
                    <div className="space-y-4">
                      {receiptPreview ? (
                        <motion.img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="max-h-48 mx-auto rounded-lg"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      ) : (
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                      )}
                      <div className="flex items-center justify-center gap-2">
                        <Receipt className="w-4 h-4" />
                        <span className="text-sm font-medium">{receiptFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Drag and drop your receipt here
                        </p>
                        <p className="text-xs text-muted-foreground">
                          or click to browse (JPG, PNG, PDF - max 10MB)
                        </p>
                      </div>
                      <Input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf"
                        className="hidden"
                        id="receipt-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('receipt-upload')?.click()}
                      >
                        Choose file
                      </Button>
                    </div>
                  )}
                </motion.div>
                <p className="text-xs text-muted-foreground">
                  Receipt required for expenses over the category threshold
                </p>
              </div>

              {/* Form Error */}
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {form.formState.errors.root.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitExpense.isPending || uploadingReceipt}
                >
                  {submitExpense.isPending || uploadingReceipt
                    ? 'Submitting...'
                    : 'Submit expense'}
                </Button>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
