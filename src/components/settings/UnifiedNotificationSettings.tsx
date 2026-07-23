import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Volume2, VolumeX, Smartphone, Clock, FileText, Ticket, TrendingUp, Truck, DollarSign, Loader2, Save } from "lucide-react";
import { useUnifiedNotificationPreferences } from "@/hooks/useUnifiedNotificationPreferences";
import { motion } from "framer-motion";

export function UnifiedNotificationSettings() {
  const { preferences, isLoading, updateContent, updateCommunication, updateUI, isUpdating } = useUnifiedNotificationPreferences();
  
  const [localContent, setLocalContent] = useState(preferences.content);
  const [localComm, setLocalComm] = useState(preferences.communication);
  const [localUI, setLocalUI] = useState(preferences.ui);

  // Update local state when preferences load
  useState(() => {
    setLocalContent(preferences.content);
    setLocalComm(preferences.communication);
    setLocalUI(preferences.ui);
  });

  const handleSaveAll = async () => {
    try {
      await Promise.all([
        updateContent(localContent),
        updateCommunication(localComm),
        updateUI(localUI),
      ]);
    } catch (error) {
      // Errors handled by mutations
    }
  };

  const playTestSound = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT");
      audio.volume = localComm.sound_volume_percent / 100;
      audio.play().catch(() => {});
    } catch(e) { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Control all your notification settings in one place
        </p>
      </div>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Display preferences
          </CardTitle>
          <CardDescription>Control how notifications appear on screen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Popup alerts</Label>
              <p className="text-xs text-muted-foreground">Show notification popups when new alerts arrive</p>
            </div>
            <Switch
              checked={localUI.enable_popup_alerts}
              onCheckedChange={(checked) => setLocalUI(prev => ({ ...prev, enable_popup_alerts: checked }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Click sounds</Label>
              <p className="text-xs text-muted-foreground">Play sound when clicking buttons and links</p>
            </div>
            <Switch
              checked={localUI.enable_click_sounds}
              onCheckedChange={(checked) => setLocalUI(prev => ({ ...prev, enable_click_sounds: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Hover sounds</Label>
              <p className="text-xs text-muted-foreground">Play subtle sounds when hovering over interactive elements</p>
            </div>
            <Switch
              checked={localUI.enable_hover_sounds}
              onCheckedChange={(checked) => setLocalUI(prev => ({ ...prev, enable_hover_sounds: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System sounds</Label>
              <p className="text-xs text-muted-foreground">Play sounds for system events like diagnostics and approvals</p>
            </div>
            <Switch
              checked={localUI.enable_system_sounds}
              onCheckedChange={(checked) => setLocalUI(prev => ({ ...prev, enable_system_sounds: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sound Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Sound preferences
          </CardTitle>
          <CardDescription>Customize audio feedback and notification sounds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable sounds</Label>
              <p className="text-xs text-muted-foreground">Master control for all audio feedback</p>
            </div>
            <Switch
              checked={localUI.enable_sound}
              onCheckedChange={(checked) => setLocalUI(prev => ({ ...prev, enable_sound: checked }))}
            />
          </div>
          {localUI.enable_sound && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Volume level</Label>
                  <Badge variant="outline">{Math.round(localUI.sound_volume * 100)}%</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                  <Slider
                    value={[localUI.sound_volume * 100]}
                    onValueChange={([value]) => setLocalUI(prev => ({ ...prev, sound_volume: value / 100 }))}
                    max={100}
                    step={10}
                    className="flex-1"
                  />
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notification sound</Label>
                <div className="flex gap-2">
                  <Select
                    value={localUI.notification_sound_type}
                    onValueChange={(value: any) => setLocalUI(prev => ({ ...prev, notification_sound_type: value }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notification">Subtle ping</SelectItem>
                      <SelectItem value="bell_ring">Bell ring</SelectItem>
                      <SelectItem value="success">Success chime</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={playTestSound}>Test</Button>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Communication Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Communication delivery
          </CardTitle>
          <CardDescription>Push-style alerts, email digests, and quiet hours for messages and threads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>In-app push alerts</Label>
              <p className="text-xs text-muted-foreground">Toasts and bell updates for communication events</p>
            </div>
            <Switch
              checked={localComm.push_notifications}
              onCheckedChange={(checked) => setLocalComm(prev => ({ ...prev, push_notifications: checked }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email digests</Label>
              <p className="text-xs text-muted-foreground">Summaries of activity by email</p>
            </div>
            <Switch
              checked={localComm.email_digests}
              onCheckedChange={(checked) => setLocalComm(prev => ({ ...prev, email_digests: checked }))}
            />
          </div>
          {localComm.email_digests && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 ml-6">
              <Label className="text-sm">Digest frequency</Label>
              <Select
                value={localComm.digest_frequency}
                onValueChange={(value: any) => setLocalComm(prev => ({ ...prev, digest_frequency: value }))}
              >
                <SelectTrigger>
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
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alert sounds</Label>
              <p className="text-xs text-muted-foreground">Play sound when a communication notification arrives</p>
            </div>
            <Switch
              checked={localComm.notification_sounds}
              onCheckedChange={(checked) => setLocalComm(prev => ({ ...prev, notification_sounds: checked }))}
            />
          </div>
          {localComm.notification_sounds && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 ml-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Alert volume ({localComm.sound_volume_percent}%)</Label>
              </div>
              <Slider
                value={[localComm.sound_volume_percent]}
                onValueChange={([value]) => setLocalComm(prev => ({ ...prev, sound_volume_percent: value }))}
                max={100}
                step={10}
              />
            </motion.div>
          )}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Quiet hours</Label>
                <p className="text-xs text-muted-foreground">Suppress sounds and popups during this window (your device timezone)</p>
              </div>
              <Switch
                checked={localComm.quiet_hours_enabled}
                onCheckedChange={(checked) => setLocalComm(prev => ({ ...prev, quiet_hours_enabled: checked }))}
              />
            </div>
            {localComm.quiet_hours_enabled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3 ml-6">
                <div className="space-y-2">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={localComm.quiet_hours_start}
                    onChange={(e) => setLocalComm(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={localComm.quiet_hours_end}
                    onChange={(e) => setLocalComm(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Content preferences
          </CardTitle>
          <CardDescription>Choose which types of notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MOU Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <Label className="font-semibold">MOU notifications</Label>
            </div>
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-normal">Status changes</Label>
                  <p className="text-xs text-muted-foreground">Get notified when MOU status changes (approved, signed, etc.)</p>
                </div>
                <Switch
                  checked={localContent.mou_status_changes}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, mou_status_changes: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-normal">Expiration reminders</Label>
                  <p className="text-xs text-muted-foreground">Get reminded before MOUs expire</p>
                </div>
                <Switch
                  checked={localContent.mou_expiration_reminders}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, mou_expiration_reminders: checked }))}
                />
              </div>
              {localContent.mou_expiration_reminders && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-6 space-y-2">
                  <Label className="text-xs">Remind me before:</Label>
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30, 60, 90].map(days => (
                      <Badge
                        key={days}
                        variant={localContent.mou_expiration_days.includes(days) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setLocalContent(prev => ({
                            ...prev,
                            mou_expiration_days: prev.mou_expiration_days.includes(days)
                              ? prev.mou_expiration_days.filter(d => d !== days)
                              : [...prev.mou_expiration_days, days].sort((a, b) => a - b)
                          }));
                        }}
                      >
                        {days} days
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <Separator />

          {/* Issue Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" />
              <Label className="font-semibold">Issue notifications</Label>
            </div>
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-normal">Issue assignments</Label>
                  <p className="text-xs text-muted-foreground">Get notified when issues are assigned to you</p>
                </div>
                <Switch
                  checked={localContent.issue_assignments}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, issue_assignments: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-normal">Issue updates</Label>
                  <p className="text-xs text-muted-foreground">Get notified when issues you're involved with are updated</p>
                </div>
                <Switch
                  checked={localContent.issue_updates}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, issue_updates: checked }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Module Activities */}
          <div className="space-y-3">
            <Label className="font-semibold">Module activities</Label>
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Delivery & dispatch</Label>
                    <p className="text-xs text-muted-foreground">Updates on rider assignments and delivery completions</p>
                  </div>
                </div>
                <Switch
                  checked={localContent.delivery_updates}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, delivery_updates: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Finance alerts</Label>
                    <p className="text-xs text-muted-foreground">Payment releases and ledger entries</p>
                  </div>
                </div>
                <Switch
                  checked={localContent.finance_alerts}
                  onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, finance_alerts: checked }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly digest</Label>
              <p className="text-xs text-muted-foreground">Receive a weekly summary of all activity</p>
            </div>
            <Switch
              checked={localContent.weekly_digest}
              onCheckedChange={(checked) => setLocalContent(prev => ({ ...prev, weekly_digest: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSaveAll}
          disabled={isUpdating}
          className="gap-2"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save all preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
