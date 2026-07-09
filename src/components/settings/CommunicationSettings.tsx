import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Bell, Mail, Volume2, Moon } from 'lucide-react';
import { useUserCommunicationDeliveryPrefs, useUpsertUserCommunicationDeliveryPrefs, type DigestFrequency } from '@/components/hooks/useUserCommunicationDeliveryPrefs';
import { motion } from 'framer-motion';

interface UserPreferences {
  department_order: string[];
  enable_department_reordering: boolean;
}

export const CommunicationSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_communication_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data as UserPreferences | null;
    },
    enabled: !!user,
  });

  // Fetch notification preferences
  const { data: notificationPrefs, isLoading: isLoadingNotifications } = useUserCommunicationDeliveryPrefs();
  const upsertNotificationPrefs = useUpsertUserCommunicationDeliveryPrefs();

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (enableReordering: boolean) => {
      if (!user) return;

      const { error } = await supabase
        .from('user_communication_preferences')
        .upsert({
          user_id: user.id,
          enable_department_reordering: enableReordering,
          department_order: preferences?.department_order ?? [],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Communication preferences updated');
    },
    onError: (error) => {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences');
    },
  });

  const handleToggleReordering = (checked: boolean) => {
    updatePreferencesMutation.mutate(checked);
  };

  const handleTogglePushNotifications = (checked: boolean) => {
    if (!notificationPrefs) return;
    upsertNotificationPrefs.mutate(
      { ...notificationPrefs, push_notifications: checked },
      {
        onSuccess: () => toast.success('Push notifications ' + (checked ? 'enabled' : 'disabled')),
        onError: () => toast.error('Failed to update notification settings'),
      }
    );
  };

  const handleToggleEmailDigests = (checked: boolean) => {
    if (!notificationPrefs) return;
    upsertNotificationPrefs.mutate(
      { ...notificationPrefs, email_digests: checked },
      {
        onSuccess: () => toast.success('Email digests ' + (checked ? 'enabled' : 'disabled')),
        onError: () => toast.error('Failed to update notification settings'),
      }
    );
  };

  const handleDigestFrequencyChange = (frequency: DigestFrequency) => {
    if (!notificationPrefs) return;
    upsertNotificationPrefs.mutate(
      { ...notificationPrefs, digest_frequency: frequency },
      {
        onSuccess: () => toast.success('Email digest frequency updated'),
        onError: () => toast.error('Failed to update notification settings'),
      }
    );
  };

  if (isLoading || isLoadingNotifications) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Communication Preferences
            </CardTitle>
            <CardDescription>
              Customize your communication module experience
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const enableReordering = preferences?.enable_department_reordering ?? true;

  return (
    <div className="space-y-6">
      {/* Department Preferences Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Department Preferences
            </CardTitle>
            <CardDescription>
              Customize how departments are displayed in the communication module
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Department Reordering Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="department-reordering" className="text-sm font-medium">
                  Enable department reordering
                </Label>
                <p className="text-sm text-muted-foreground">
                  Drag and drop departments to reorder them according to your preference. 
                  This setting only affects your view.
                </p>
              </div>
              <Switch
                id="department-reordering"
                checked={enableReordering}
                onCheckedChange={handleToggleReordering}
                disabled={updatePreferencesMutation.isPending}
              />
            </div>

            {/* Info Section */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">About department reordering:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Only departments can be reordered (not channels)</li>
                <li>The #general channel always stays at the top</li>
                <li>Your order is personal and doesn't affect other users</li>
                <li>Disable this to use the default alphabetical order</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification Preferences Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how and when you receive communication alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="push-notifications" className="text-sm font-medium flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Push notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications for new messages, mentions, and direct messages
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={notificationPrefs?.push_notifications ?? true}
                onCheckedChange={handleTogglePushNotifications}
                disabled={upsertNotificationPrefs.isPending}
              />
            </div>

            {/* Email Digests Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="email-digests" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email digests
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive email summaries of missed messages and activity
                </p>
              </div>
              <Switch
                id="email-digests"
                checked={notificationPrefs?.email_digests ?? true}
                onCheckedChange={handleToggleEmailDigests}
                disabled={upsertNotificationPrefs.isPending}
              />
            </div>

            {/* Email Digest Frequency */}
            {notificationPrefs?.email_digests && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="pl-6 border-l-2 border-muted space-y-2"
              >
                <Label htmlFor="digest-frequency" className="text-sm font-medium">
                  Email digest frequency
                </Label>
                <Select
                  value={notificationPrefs?.digest_frequency ?? 'daily'}
                  onValueChange={(value) => handleDigestFrequencyChange(value as DigestFrequency)}
                  disabled={upsertNotificationPrefs.isPending}
                >
                  <SelectTrigger id="digest-frequency" className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (real-time)</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how often you want to receive email summaries of your communication activity
                </p>
              </motion.div>
            )}

            {/* Info Section */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">About notifications:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Push notifications appear in your browser when you're online</li>
                <li>Email digests help you stay updated when you're away</li>
                <li>You can mute specific channels to reduce notification volume</li>
                <li>Direct mentions will always notify you, even in muted channels</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
