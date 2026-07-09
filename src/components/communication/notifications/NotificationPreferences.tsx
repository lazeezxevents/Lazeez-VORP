import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Mail, Clock, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/components/integrations/supabase/client';

interface NotificationPreferencesProps {
  userId: string;
}

interface Preferences {
  pushNotifications: boolean;
  emailDigests: boolean;
  digestFrequency: 'immediate' | 'hourly' | 'daily' | 'never';
  notificationSounds: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

/**
 * NotificationPreferences - User notification settings
 * 
 * Features:
 * - Toggle push notifications
 * - Email digest configuration
 * - Notification sounds
 * - Quiet hours
 * 
 * Requirements: 24.1-24.10
 */
export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ userId }) => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Preferences>({
    pushNotifications: true,
    emailDigests: true,
    digestFrequency: 'daily',
    notificationSounds: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }

      if (data) {
        setPreferences({
          pushNotifications: data.push_notifications ?? true,
          emailDigests: data.email_digests ?? true,
          digestFrequency: data.digest_frequency ?? 'daily',
          notificationSounds: data.notification_sounds ?? true,
          quietHoursEnabled: data.quiet_hours_enabled ?? false,
          quietHoursStart: data.quiet_hours_start ?? '22:00',
          quietHoursEnd: data.quiet_hours_end ?? '08:00'
        });
      }
    } catch (error) {
      console.error('Error in loadPreferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          push_notifications: preferences.pushNotifications,
          email_digests: preferences.emailDigests,
          digest_frequency: preferences.digestFrequency,
          notification_sounds: preferences.notificationSounds,
          quiet_hours_enabled: preferences.quietHoursEnabled,
          quiet_hours_start: preferences.quietHoursStart,
          quiet_hours_end: preferences.quietHoursEnd,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.'
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>
            Manage how you receive notifications from the Communication module
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.pushNotifications ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="push-notifications" className="text-base font-medium">
                  Push notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications for new messages
                </p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.pushNotifications}
              onCheckedChange={(checked) => updatePreference('pushNotifications', checked)}
            />
          </div>

          {/* Email Digests */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="email-digests" className="text-base font-medium">
                    Email digests
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email summaries of missed messages
                  </p>
                </div>
              </div>
              <Switch
                id="email-digests"
                checked={preferences.emailDigests}
                onCheckedChange={(checked) => updatePreference('emailDigests', checked)}
              />
            </div>

            {preferences.emailDigests && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-8 pl-4 border-l-2 border-muted"
              >
                <Label htmlFor="digest-frequency" className="text-sm">
                  Digest frequency
                </Label>
                <Select
                  value={preferences.digestFrequency}
                  onValueChange={(value: Preferences['digestFrequency']) =>
                    updatePreference('digestFrequency', value)
                  }
                >
                  <SelectTrigger id="digest-frequency" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            )}
          </div>

          {/* Notification Sounds */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.notificationSounds ? (
                <Volume2 className="w-5 h-5 text-primary" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="notification-sounds" className="text-base font-medium">
                  Notification sounds
                </Label>
                <p className="text-sm text-muted-foreground">
                  Play sound when receiving notifications
                </p>
              </div>
            </div>
            <Switch
              id="notification-sounds"
              checked={preferences.notificationSounds}
              onCheckedChange={(checked) => updatePreference('notificationSounds', checked)}
            />
          </div>

          {/* Quiet Hours */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="quiet-hours" className="text-base font-medium">
                    Quiet hours
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Suppress notifications during specific hours
                  </p>
                </div>
              </div>
              <Switch
                id="quiet-hours"
                checked={preferences.quietHoursEnabled}
                onCheckedChange={(checked) => updatePreference('quietHoursEnabled', checked)}
              />
            </div>

            {preferences.quietHoursEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-8 pl-4 border-l-2 border-muted space-y-3"
              >
                <div>
                  <Label htmlFor="quiet-start" className="text-sm">
                    Start time
                  </Label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHoursStart}
                    onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end" className="text-sm">
                    End time
                  </Label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHoursEnd}
                    onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={savePreferences}
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
