import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { playSound, setSoundEnabled } from "@/components/utils/soundEffects";
import { Volume2, VolumeX, Bell, MousePointer, Zap, TestTube } from "lucide-react";
import { motion } from "framer-motion";

export function NotificationSoundPreferences() {
  const { preferences, updatePreferences } = useNotificationUIPreferences();

  // Update sound manager when preferences change
  React.useEffect(() => {
    setSoundEnabled(preferences.enable_sound);
  }, [preferences.enable_sound]);

  const handleVolumeChange = (value: number[]) => {
    updatePreferences({ sound_volume: value[0] });
  };

  const testSound = (soundType: 'notification' | 'bell_ring' | 'success') => {
    playSound(soundType, { volume: preferences.sound_volume });
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Volume2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Sound preferences</CardTitle>
            <CardDescription>
              Customize audio feedback and notification sounds
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Enable sounds</Label>
            <p className="text-xs text-muted-foreground">
              Master control for all audio feedback
            </p>
          </div>
          <Switch
            checked={preferences.enable_sound}
            onCheckedChange={(checked) => updatePreferences({ enable_sound: checked })}
          />
        </div>

        {preferences.enable_sound && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-6"
          >
            {/* Volume Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Volume level</Label>
                <Badge variant="outline" className="text-xs">
                  {Math.round(preferences.sound_volume * 100)}%
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[preferences.sound_volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  min={0}
                  step={0.1}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Notification Sound Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Notification sound</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={
                    preferences.notification_sound_type === "bell_ring" ||
                    preferences.notification_sound_type === "success" ||
                    preferences.notification_sound_type === "notification"
                      ? preferences.notification_sound_type
                      : "notification"
                  }
                  onValueChange={(value: "notification" | "bell_ring" | "success") =>
                    updatePreferences({ notification_sound_type: value })
                  }
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound(preferences.notification_sound_type)}
                  className="gap-2"
                >
                  <TestTube className="w-3 h-3" />
                  Test
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}