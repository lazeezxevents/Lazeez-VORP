import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
}

export const CreateChannelDialog = ({ 
  open, 
  onOpenChange, 
  departmentId 
}: CreateChannelDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          department_id: departmentId,
          name: name.trim().toLowerCase().replace(/\s+/g, '-'),
          description: description.trim() || null,
          purpose: purpose.trim() || null,
          is_private: isPrivate,
          created_by: user.id,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      return channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast({
        title: 'Channel created',
        description: `#${name.trim().toLowerCase().replace(/\s+/g, '-')} has been created successfully.`,
      });
      setName('');
      setDescription('');
      setPurpose('');
      setIsPrivate(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create channel',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a channel name',
        variant: 'destructive',
      });
      return;
    }
    createChannelMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Create a new channel for teams, projects, tasks, or general discussions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel Name *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#</span>
                <Input
                  id="channel-name"
                  placeholder="e.g., general, team-alpha, project-x"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Spaces will be replaced with hyphens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-description">Description</Label>
              <Input
                id="channel-description"
                placeholder="What is this channel about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-purpose">Purpose</Label>
              <Textarea
                id="channel-purpose"
                placeholder="What should this channel be used for?"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="channel-private">Private Channel</Label>
                <p className="text-xs text-muted-foreground">
                  Only invited members can see and join
                </p>
              </div>
              <Switch
                id="channel-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createChannelMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createChannelMutation.isPending}>
              {createChannelMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
