import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus } from 'lucide-react';

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

interface AddChannelMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelName: string;
  isPrivate: boolean;
  excludeUserIds: string[];
  onAdded: (userId: string) => Promise<void>;
}

export function AddChannelMemberDialog({
  open,
  onOpenChange,
  channelId,
  channelName,
  isPrivate,
  excludeUserIds,
  onAdded,
}: AddChannelMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebounced('');
      setSubmittingId(null);
    }
  }, [open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['profile-search-comm', debounced],
    queryFn: async () => {
      if (debounced.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${debounced}%`)
        .limit(20);

      if (error) throw error;
      return (data || []) as ProfileRow[];
    },
    enabled: open && debounced.length >= 2,
  });

  const exclude = new Set(excludeUserIds);
  const visible = results.filter((r) => !exclude.has(r.id));

  const handleAdd = async (userId: string) => {
    setSubmittingId(userId);
    try {
      await onAdded(userId);
      onOpenChange(false);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add people to #{channelName}
          </DialogTitle>
          <DialogDescription>
            Search by name. {isPrivate ? 'They will receive an in-app notification.' : 'They can access the channel immediately.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Search people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {debounced.length >= 2 && (
            <ScrollArea className="h-56 rounded-md border">
              <div className="p-2 space-y-1">
                {isFetching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                )}
                {!isFetching && visible.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">No matching people found.</p>
                )}
                {visible.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback>{(p.full_name || '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.full_name || 'Unknown'}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={submittingId !== null}
                      onClick={() => void handleAdd(p.id)}
                    >
                      {submittingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {debounced.length > 0 && debounced.length < 2 && (
            <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
