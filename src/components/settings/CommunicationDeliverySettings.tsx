import * as React from "react";
import { useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MessageSquare, Save, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import {
  useUserCommunicationDeliveryPrefs,
  useUpsertUserCommunicationDeliveryPrefs,
  type DigestFrequency,
  type UserCommunicationDeliveryPrefs,
} from "@/components/hooks/useUserCommunicationDeliveryPrefs";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";

/**
 * Communication-specific delivery settings stored in Supabase (cross-device).
 * Task 21: push / email digest / quiet hours / notification sounds flags.
 */
export function CommunicationDeliverySettings() {
  const { user } = useAuth();
  const { data: serverPrefs, isLoading, isError, error, refetch } = useUserCommunicationDeliveryPrefs();
  const upsert = useUpsertUserCommunicationDeliveryPrefs();
  const { updatePreferences: updateUiPrefs } = useNotificationUIPreferences();

  const draft = useMemo((): Omit<UserCommunicationDeliveryPrefs, "user_id"> | null => {
    if (!serverPrefs) return null;
    const { user_id: _, ...rest } = serverPrefs;
    return rest;
  }, [serverPrefs]);

  const [local, setLocal] = React.useState<Omit<UserCommunicationDeliveryPrefs, "user_id"> | null>(
    null
  );

  useEffect(() => {
    if (draft) setLocal(draft);
  }, [draft]);

  if (!user) return null;

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg">Communication delivery</CardTitle>
          <CardDescription>
            Could not load settings from the server. Check your connection and that migrations are applied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !local) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    try {
      await upsert.mutateAsync(local);
      updateUiPrefs({
        enable_sound: local.notification_sounds,
        sound_volume: local.sound_volume_percent / 100,
      });
      toast.success("Communication notification settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5" />
          Communication delivery
        </CardTitle>
        <CardDescription>
          Push-style alerts, email digests, and quiet hours for messages and threads. Synced to your
          account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>In-app push alerts</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toasts and bell updates for communication events
            </p>
          </div>
          <Switch
            checked={local.push_notifications}
            onCheckedChange={(v) => setLocal((s) => s && { ...s, push_notifications: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Email digests</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Summaries of activity by email</p>
          </div>
          <Switch
            checked={local.email_digests}
            onCheckedChange={(v) => setLocal((s) => s && { ...s, email_digests: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Digest frequency</Label>
          <Select
            value={local.digest_frequency}
            onValueChange={(v) =>
              setLocal((s) => s && { ...s, digest_frequency: v as DigestFrequency })
            }
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
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" />
              Alert sounds
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Play sound when a communication notification arrives
            </p>
          </div>
          <Switch
            checked={local.notification_sounds}
            onCheckedChange={(v) => setLocal((s) => s && { ...s, notification_sounds: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Alert volume ({local.sound_volume_percent}%)</Label>
          <Slider
            value={[Number.isFinite(local.sound_volume_percent) ? local.sound_volume_percent : 40]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) =>
              setLocal((s) => s && { ...s, sound_volume_percent: Math.min(100, Math.max(0, v)) })
            }
          />
        </div>

        <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Quiet hours</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suppress sounds and popups during this window (your device timezone)
              </p>
            </div>
            <Switch
              checked={local.quiet_hours_enabled}
              onCheckedChange={(v) => setLocal((s) => s && { ...s, quiet_hours_enabled: v })}
            />
          </div>
          {local.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  type="time"
                  value={local.quiet_hours_start}
                  onChange={(e) =>
                    setLocal((s) => s && { ...s, quiet_hours_start: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  type="time"
                  value={local.quiet_hours_end}
                  onChange={(e) => setLocal((s) => s && { ...s, quiet_hours_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={upsert.isPending} className="gap-2">
            {upsert.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save communication settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
