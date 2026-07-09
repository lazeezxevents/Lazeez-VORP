import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateVendor, useUpdateVendor, Vendor, VendorCategory, VendorStatus } from "@/hooks/useVendors";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CustomSuccessDialog } from "@/components/ui/CustomSuccessDialog";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required").max(100),
  owner_name: z.string().min(1, "Owner name is required").max(100),
  owner_cnic: z.string().max(15).optional(),
  category: z.enum(["home_chef", "home_baker", "bakery", "catering", "restaurant", "decoration", "photography", "entertainment", "venue", "logistics", "other"]),
  status: z.enum(["onboarded", "terminated", "left", "pending", "new", "active", "inactive", "blacklisted", "legacy"]),
  commission_percentage: z.coerce.number().min(0).max(100).optional(),
  subscription_amount: z.coerce.number().min(0).optional(),
  subscription_after_orders: z.coerce.number().min(0).optional(),
  sticker_status: z.string().optional(),
  contact_person: z.string().max(100).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  bank_title: z.string().max(100).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_name: z.string().optional(),
});

type VendorFormData = z.infer<typeof vendorSchema>;

interface VendorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
}

const categories: { value: VendorCategory; label: string }[] = [
  { value: "home_chef", label: "Home Chef" },
  { value: "home_baker", label: "Home Baker" },
  { value: "bakery", label: "Bakery" },
  { value: "catering", label: "Catering" },
  { value: "restaurant", label: "Restaurant" },
];

const banks = [
  "Allied Bank Limited",
  "Askari Bank",
  "Bank Alfalah",
  "Bank Al-Habib",
  "BankIslami Pakistan",
  "Faysal Bank",
  "Habib Bank Limited",
  "Habib Metropolitan Bank",
  "JS Bank",
  "MCB Bank Limited",
  "Meezan Bank",
  "National Bank of Pakistan",
  "Silk Bank",
  "Soneri Bank",
  "Standard Chartered Pakistan",
  "Summit Bank",
  "United Bank Limited",
  "Easypaisa",
  "JazzCash",
  "Other",
];

const statuses: { value: VendorStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "pending", label: "Pending" },
  { value: "onboarded", label: "Onboarded" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "left", label: "Left" },
  { value: "terminated", label: "Terminated" },
  { value: "blacklisted", label: "Blacklisted" },
];

const stickerStatuses = [
  { value: "not_issued", label: "Not Issued" },
  { value: "issued", label: "Issued" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
];

export function VendorForm({ open, onOpenChange, vendor }: VendorFormProps) {
  const { user } = useAuth();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const isEditing = !!vendor;
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      owner_name: "",
      owner_cnic: "",
      category: "home_chef",
      status: "new",
      commission_percentage: 0,
      subscription_amount: 0,
      subscription_after_orders: 0,
      sticker_status: "not_issued",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      description: "",
      notes: "",
      bank_title: "",
      bank_account_number: "",
      bank_name: "",
    },
  });

  // Reset form when vendor changes
  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name || "",
        owner_name: vendor.owner_name || "",
        owner_cnic: vendor.owner_cnic || "",
        category: vendor.category || "other",
        status: vendor.status || "new",
        commission_percentage: vendor.commission_percentage || 0,
        subscription_amount: vendor.subscription_amount || 0,
        subscription_after_orders: vendor.subscription_after_orders || 0,
        sticker_status: vendor.sticker_status || "not_issued",
        contact_person: vendor.contact_person || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        address: vendor.address || "",
        city: vendor.city || "",
        description: vendor.description || "",
        notes: vendor.notes || "",
        bank_title: vendor.bank_title || "",
        bank_account_number: vendor.bank_account_number || "",
        bank_name: vendor.bank_name || "",
      });
    } else {
      form.reset({
        name: "",
        owner_name: "",
        owner_cnic: "",
        category: "home_chef",
        status: "new",
        commission_percentage: 0,
        subscription_amount: 0,
        subscription_after_orders: 0,
        sticker_status: "not_issued",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        description: "",
        notes: "",
        bank_title: "",
        bank_account_number: "",
        bank_name: "",
      });
    }
  }, [vendor, form]);

  const onSubmit = async (data: VendorFormData) => {
    const cleanData = {
      name: data.name,
      owner_name: data.owner_name,
      owner_cnic: data.owner_cnic || undefined,
      category: data.category,
      status: data.status,
      commission_percentage: data.commission_percentage || 0,
      subscription_amount: data.subscription_amount || 0,
      subscription_after_orders: data.subscription_after_orders || 0,
      sticker_status: data.sticker_status || "not_issued",
      contact_person: data.contact_person || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      description: data.description || undefined,
      notes: data.notes || undefined,
      bank_title: data.bank_title || undefined,
      bank_account_number: data.bank_account_number || undefined,
      bank_name: data.bank_name || undefined,
    };

    if (isEditing) {
      await updateVendor.mutateAsync({ id: vendor.id, ...cleanData });
    } else {
      await createVendor.mutateAsync(cleanData);
      // Attempt to send notification email for new vendors
      try {
        const { sendNotificationEmail } = await import("@/lib/resend");
        if (user?.email) {
          await sendNotificationEmail({
            to: user.email,
            subject: `New Vendor Registered: ${cleanData.name}`,
            html: `
              <h1>New Vendor Onboarded</h1>
              <p>Vendor <strong>${cleanData.name}</strong> has been successfully registered in the ecosystem.</p>
              <p>Category: ${cleanData.category}</p>
              <p>Owner: ${cleanData.owner_name}</p>
            `
          });
        }
      } catch (e) {
        console.error("Email notification failed", e);
      }
    }
    setShowSuccess(true);
  };

  const isLoading = createVendor.isPending || updateVendor.isPending;

  return (
    <>
      <Dialog open={open && !showSuccess} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden bg-gradient-to-br from-white via-zinc-50 to-white border-2 border-primary/10 shadow-2xl">
          {/* Animated Header with Gradient */}
          <div className="relative border-b pb-6 pt-8 px-8 bg-white/50 backdrop-blur-xl dark:bg-zinc-950/50 shadow-sm">
            <DialogHeader className="relative flex flex-row items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div className="flex flex-col text-left">
                <DialogTitle className="text-3xl font-[Poppins] font-semibold tracking-tight text-foreground">
                  {isEditing ? "Edit Vendor Profile" : "Add New Vendor"}
                </DialogTitle>
                <p className="text-muted-foreground text-sm mt-1.5 font-medium">
                  {isEditing ? "Update vendor information and settings" : "Register a new vendor to your ecosystem"}
                </p>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[calc(95vh-180px)]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 pt-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter vendor/business name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="owner_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter owner's full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="owner_cnic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner CNIC</FormLabel>
                          <FormControl>
                            <Input placeholder="12345-1234567-1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Category *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Financial Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Financial Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="commission_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission %</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Per order commission</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subscription_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subscription Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Monthly subscription fee</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                    <FormField
                      control={form.control}
                      name="subscription_after_orders"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subscription After Orders</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>When subscription will be given</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Bank Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Bank Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="bank_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Account holder name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bank_account_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IBAN / Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="PK00ABCD0000000000000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select bank" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {banks.map((bank) => (
                                <SelectItem key={bank} value={bank}>
                                  {bank}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Status Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statuses.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sticker_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sticker Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sticker status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stickerStatuses.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="Primary contact name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="vendor@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+92 300 1234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Full address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Additional Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Additional Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of the vendor services..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional notes or comments..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditing ? "Update Vendor" : "Create Vendor"}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <CustomSuccessDialog
        open={showSuccess}
        onOpenChange={(val) => {
          setShowSuccess(val);
          if (!val) {
            onOpenChange(false);
            form.reset();
          }
        }}
        title="Success!"
        description={`Vendor successfully ${isEditing ? "updated" : "created"}.`}
      />
    </>
  );
}
