import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface DeleteDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
  channelCount: number;
}

export const DeleteDepartmentDialog = ({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  channelCount,
}: DeleteDepartmentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteDepartmentMutation = useMutation({
    mutationFn: async () => {
      // Delete department (CASCADE will delete channels and members)
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast({
        title: 'Department deleted',
        description: `${departmentName} and all its channels have been deleted.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete department',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Department?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{departmentName}</strong>?
            </p>
            {channelCount > 0 && (
              <p className="text-destructive font-medium">
                This will permanently delete {channelCount} channel{channelCount !== 1 ? 's' : ''} and all their messages.
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDepartmentMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteDepartmentMutation.mutate();
            }}
            disabled={deleteDepartmentMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteDepartmentMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Delete Department
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
