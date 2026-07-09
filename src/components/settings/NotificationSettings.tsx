import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { EnhancedNotificationPreferences } from "@/components/settings/EnhancedNotificationPreferences";
import { CommunicationDeliverySettings } from "@/components/settings/CommunicationDeliverySettings";
import { Bell, Loader2, Save, Mail, Clock, Shield } from "lucide-react";

export function NotificationSettings() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [formData, setFormData] = useState({
    mou_status_changes: true,
    mou_expiration_reminders: true,
    mou_expiration_days: [7, 14, 30] as number[],
    issue_assignments: true,
    issue_updates: true,
    weekly_digest: false,
    finance_alerts: true,
    delivery_updates: true,
    hr_activity: true,
  });

  useEffect(() => {
    if (preferences) {
      setFormData({
        mou_status_changes: preferences.mou_status_changes,
        mou_expiration_reminders: preferences.mou_expiration_reminders,
        mou_expiration_days: preferences.mou_expiration_days,
        issue_assignments: preferences.issue_assignments,
        issue_updates: preferences.issue_updates,
        weekly_digest: preferences.weekly_digest,
        finance_alerts: preferences.finance_alerts || false,
        delivery_updates: preferences.delivery_updates || false,
        hr_activity: preferences.hr_activity || false,
      });
    }
  }, [preferences]);

  const handleExpirationDayToggle = (day: number) => {
    const newDays = formData.mou_expiration_days.includes(day)
      ? formData.mou_expiration_days.filter((d) => d !== day)
      : [...formData.mou_expiration_days, day].sort((a, b) => a - b);
    setFormData({ ...formData, mou_expiration_days: newDays });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePreferences.mutateAsync(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced UI and Sound Preferences */}
      <EnhancedNotificationPreferences />

      <CommunicationDeliverySettings />

      {/* Content Preferences */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Content preferences
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* MOU Notifications */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                MOU notifications
              </h3>

              <div className="space-y-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="mou_status">Status changes</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when MOU status changes (approved, signed, etc.)
                    </p>
                  </div>
                  <Switch
                    id="mou_status"
                    checked={formData.mou_status_changes}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, mou_status_changes: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="mou_expiration">Expiration reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get reminded before MOUs expire
                    </p>
                  </div>
                  <Switch
                    id="mou_expiration"
                    checked={formData.mou_expiration_reminders}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, mou_expiration_reminders: checked })
                    }
                  />
                </div>

                {formData.mou_expiration_reminders && (
                  <div className="pl-4 border-l-2 border-border">
                    <Label className="mb-2 block">Remind me before:</Label>
                    <div className="flex flex-wrap gap-3">
                      {[7, 14, 30, 60, 90].map((day) => (
                        <div key={day} className="flex items-center gap-2">
                          <Checkbox
                            id={`day-${day}`}
                            checked={formData.mou_expiration_days.includes(day)}
                            onCheckedChange={() => handleExpirationDayToggle(day)}
                          />
                          <Label htmlFor={`day-${day}`} className="text-sm font-normal">
                            {day} days
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Issue Notifications */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Issue notifications
              </h3>

              <div className="space-y-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="issue_assignments">Issue assignments</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when issues are assigned to you
                    </p>
                  </div>
                  <Switch
                    id="issue_assignments"
                    checked={formData.issue_assignments}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, issue_assignments: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="issue_updates">Issue updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when issues you're involved with are updated
                    </p>
                  </div>
                  <Switch
                    id="issue_updates"
                    checked={formData.issue_updates}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, issue_updates: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Module Specific Notifications */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Module activities
              </h3>

              <div className="space-y-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="finance_alerts">Finance & payouts</Label>
                    <p className="text-sm text-muted-foreground">
                      Real-time alerts for payment releases and ledger entries
                    </p>
                  </div>
                  <Switch
                    id="finance_alerts"
                    checked={formData.finance_alerts}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, finance_alerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="delivery_updates">Delivery & dispatch</Label>
                    <p className="text-sm text-muted-foreground">
                      Updates on rider assignments and delivery completions
                    </p>
                  </div>
                  <Switch
                    id="delivery_updates"
                    checked={formData.delivery_updates}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, delivery_updates: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="hr_activity">HR & team changes</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications for org chart changes and performance reviews
                    </p>
                  </div>
                  <Switch
                    id="hr_activity"
                    checked={formData.hr_activity}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, hr_activity: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Digest */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weekly_digest">Weekly digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of all activity
                  </p>
                </div>
                <Switch
                  id="weekly_digest"
                  checked={formData.weekly_digest}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, weekly_digest: checked })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={updatePreferences.isPending}>
                {updatePreferences.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save preferences
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
