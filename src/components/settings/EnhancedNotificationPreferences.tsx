import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { NotificationSoundPreferences } from "./NotificationSoundPreferences";
import { Bell, Smartphone, MousePointer, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function EnhancedNotificationPreferences() {
  const { preferences, updatePreferences } = useNotificationUIPreferences();

  return (
    <div className="space-y-6">
      {/* UI Preferences */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Smartphone className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Display preferences</CardTitle>
              <CardDescription>
                Control how notifications appear on screen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Popup Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Popup alerts</Label>
              <p className="text-xs text-muted-foreground">
                Show notification popups when new alerts arrive
              </p>
            </div>
            <Switch
              checked={preferences.enable_popup_alerts}
              onCheckedChange={(checked) => updatePreferences({ enable_popup_alerts: checked })}
            />
          </div>

          <Separator />

          {/* Interaction Sounds */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Click sounds</Label>
                <p className="text-xs text-muted-foreground">
                  Play sound when clicking buttons and links
                </p>
              </div>
              <Switch
                checked={preferences.enable_click_sounds}
                onCheckedChange={(checked) => updatePreferences({ enable_click_sounds: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Hover sounds</Label>
                <p className="text-xs text-muted-foreground">
                  Play subtle sounds when hovering over interactive elements
                </p>
              </div>
              <Switch
                checked={preferences.enable_hover_sounds}
                onCheckedChange={(checked) => updatePreferences({ enable_hover_sounds: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">System sounds</Label>
                <p className="text-xs text-muted-foreground">
                  Play sounds for system events like diagnostics and approvals
                </p>
              </div>
              <Switch
                checked={preferences.enable_system_sounds}
                onCheckedChange={(checked) => updatePreferences({ enable_system_sounds: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sound Preferences */}
      <NotificationSoundPreferences />
    </div>
  );
}