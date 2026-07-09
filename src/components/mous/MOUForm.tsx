import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVendors } from "@/hooks/useVendors";
import { useMOUs } from "@/hooks/useMOUs";
import { MOUDocumentUpload } from "./MOUDocumentUpload";

const mouSchema = z.object({
  title: z.string().min(1, "Title is required"),
  vendor_id: z.string().min(1, "Vendor is required"),
  terms: z.string().optional(),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
});

type MOUFormData = z.infer<typeof mouSchema>;

interface MOUFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editMOU?: {
    id: string;
    title: string;
    vendor_id: string;
    terms: string | null;
    start_date: string | null;
    end_date: string | null;
    document_url: string | null;
  };
}

export function MOUForm({ open, onOpenChange, editMOU }: MOUFormProps) {
  const vendorsQuery = useVendors();
  const vendors = vendorsQuery.data || [];
  const { createMOU, updateMOU } = useMOUs();
  const [documentUrl, setDocumentUrl] = useState<string | null>(editMOU?.document_url || null);
  
  useEffect(() => {
    if (editMOU) {
      setDocumentUrl(editMOU.document_url || null);
      form.reset({
        title: editMOU.title,
        vendor_id: editMOU.vendor_id,
        terms: editMOU.terms || "",
        start_date: editMOU.start_date ? new Date(editMOU.start_date) : undefined,
        end_date: editMOU.end_date ? new Date(editMOU.end_date) : undefined,
      });
    } else {
      setDocumentUrl(null);
      form.reset({
        title: "",
        vendor_id: "",
        terms: "",
        start_date: undefined,
        end_date: undefined,
      });
    }
  }, [editMOU, open]);
  
  const form = useForm<MOUFormData>({
    resolver: zodResolver(mouSchema),
    defaultValues: {
      title: editMOU?.title || "",
      vendor_id: editMOU?.vendor_id || "",
      terms: editMOU?.terms || "",
      start_date: editMOU?.start_date ? new Date(editMOU.start_date) : undefined,
      end_date: editMOU?.end_date ? new Date(editMOU.end_date) : undefined,
    },
  });

  const onSubmit = async (data: MOUFormData) => {
    const mouData = {
      title: data.title,
      vendor_id: data.vendor_id,
      terms: data.terms || null,
      start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : null,
      end_date: data.end_date ? format(data.end_date, "yyyy-MM-dd") : null,
    };

    if (editMOU) {
      await updateMOU.mutateAsync({ id: editMOU.id, ...mouData });
    } else {
      await createMOU.mutateAsync(mouData);
    }
    
    onOpenChange(false);
    form.reset();
  };

  const isLoading = createMOU.isPending || updateMOU.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editMOU ? "Edit MOU" : "Create New MOU"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="MOU title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter terms and conditions..." 
                      className="min-h-[150px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {editMOU && (
              <MOUDocumentUpload
                mouId={editMOU.id}
                currentDocumentUrl={documentUrl}
                onUploadComplete={setDocumentUrl}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMOU ? "Update MOU" : "Create MOU"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
