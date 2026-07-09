import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Mail, 
  Settings, 
  Zap,
  Clock,
  Eye,
  Palette,
  Save
} from "lucide-react";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { toast } from "sonner";

export default function NotificationPreferences() {
  const { preferences, updatePreferences, isLoading } = useNotificationUIPreferences();
  const [localPrefs, setLocalPrefs] = useState(preferences);

  const handleSave = async () => {
    try {
      await updatePreferences(localPrefs);
      toast.success("Notification preferences saved", {
        icon: <Save className="w-4 h-4" />
      });
    } catch (error) {
      toast.error("Failed to save preferences");
    }
  };

  const playTestSound = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT");
      audio.volume = localPrefs.sound_volume / 100;
      audio.play().catch(() => {});
    } catch(e) { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Customize how you receive and interact with notifications
        </p>
      </div>

      <div className="grid gap-6">
        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Sound Effects
            </CardTitle>
            <CardDescription>
              Configure audio feedback for interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-sound">Enable sound effects</Label>
                <p className="text-xs text-muted-foreground">
                  Play subtle sounds for notifications and interactions
                </p>
              </div>
              <Switch
                id="enable-sound"
                checked={localPrefs.enable_sound}
                onCheckedChange={(checked) => 
                  setLocalPrefs(prev => ({ ...prev, enable_sound: checked }))
                }
              />
            </div>

            {localPrefs.enable_sound && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sound volume</Label>
                    <Badge variant="outline" className="text-xs">
                      {localPrefs.sound_volume}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                    <Slider
                      value={[localPrefs.sound_volume]}
                      onValueChange={([value]) => 
                        setLocalPrefs(prev => ({ ...prev, sound_volume: value }))
                      }
                      max={100}
                      step={10}
                      className="flex-1"
                    />
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={playTestSound}
                      className="text-xs"
                    >
                      Test
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Visual Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Visual Effects
            </CardTitle>
            <CardDescription>
              Control visual feedback and animations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-popup">Popup alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Show popup notifications for new alerts
                </p>
              </div>
              <Switch
                id="enable-popup"
                checked={localPrefs.enable_popup_alerts}
                onCheckedChange={(checked) => 
                  setLocalPrefs(prev => ({ ...prev, enable_popup_alerts: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-animations">Bell animations</Label>
                <p className="text-xs text-muted-foreground">
                  Animate notification bell when there are unread alerts
                </p>
              </div>
              <Switch
                id="enable-animations"
                checked={localPrefs.enable_popup_alerts} // Using same setting for now
                onCheckedChange={(checked) => 
                  setLocalPrefs(prev => ({ ...prev, enable_popup_alerts: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Categories
            </CardTitle>
            <CardDescription>
              Choose which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'hr', label: 'HR & Performance', icon: Settings, description: 'Employee updates, appraisals, attendance' },
              { key: 'finance', label: 'Finance & Payments', icon: Zap, description: 'Payment alerts, financial updates' },
              { key: 'system', label: 'System Alerts', icon: Bell, description: 'System maintenance, security alerts' },
              { key: 'project', label: 'Project Updates', icon: Clock, description: 'Task assignments, project milestones' },
            ].map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <Label>{category.label}</Label>
                      <p className="text-xs text-muted-foreground">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={true} // All enabled by default
                    onCheckedChange={() => {}} // Placeholder
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Configure email alerts for important events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-digest">Daily digest</Label>
                <p className="text-xs text-muted-foreground">
                  Receive a daily summary of notifications
                </p>
              </div>
              <Switch
                id="email-digest"
                checked={false} // Placeholder
                onCheckedChange={() => {}} // Placeholder
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-urgent">Urgent alerts only</Label>
                <p className="text-xs text-muted-foreground">
                  Only send emails for critical notifications
                </p>
              </div>
              <Switch
                id="email-urgent"
                checked={true} // Placeholder
                onCheckedChange={() => {}} // Placeholder
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          <Save className="w-4 h-4" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
}