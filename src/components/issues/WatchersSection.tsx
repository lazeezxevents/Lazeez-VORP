import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Plus, X, Loader2, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIssueWatchers, useAddWatcher, useRemoveWatcher } from "@/hooks/useIssueEnhancements";
import { useAuth } from "@/contexts/AuthContext";

interface WatchersSectionProps {
  issueId: string;
}

export function WatchersSection({ issueId }: WatchersSectionProps) {
  const { data: watchers, isLoading } = useIssueWatchers(issueId);
  const addWatcher = useAddWatcher(issueId);
  const removeWatcher = useRemoveWatcher(issueId);
  const { user } = useAuth();

  const [open, setOpen] = useState(false);

  // Fetch all users for adding watchers
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users-for-watchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const watcherUserIds = new Set(watchers?.map((w) => w.user_id) || []);
  const availableUsers = allUsers.filter((u) => !watcherUserIds.has(u.id));

  const handleAddWatcher = async (userId: string) => {
    await addWatcher.mutateAsync(userId);
    setOpen(false);
  };

  const handleRemoveWatcher = async (watcherId: string) => {
    await removeWatcher.mutateAsync(watcherId);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Watchers
          </label>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const watcherList = watchers || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Watchers ({watcherList.length})
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search users..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {availableUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.full_name || user.email}
                      onSelect={() => handleAddWatcher(user.id)}
                      className="gap-2"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {user.full_name || user.email}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {watcherList.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <UserPlus className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No watchers yet</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {watcherList.map((watcher) => (
              <motion.div
                key={watcher.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={watcher.user?.avatar_url || undefined}
                    alt={watcher.user?.full_name || watcher.user?.email}
                  />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(
                      watcher.user?.full_name || null,
                      watcher.user?.email || ""
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {watcher.user?.full_name || watcher.user?.email}
                  </p>
                  {watcher.user?.full_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {watcher.user?.email}
                    </p>
                  )}
                </div>
                {(user?.id === watcher.user_id || user?.id === watcher.added_by) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveWatcher(watcher.id)}
                    disabled={removeWatcher.isPending}
                  >
                    {removeWatcher.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
