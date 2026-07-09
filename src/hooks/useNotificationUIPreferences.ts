import { useState } from "react";

export interface NotificationUIPreferences {
  enable_popup_alerts: boolean;
  enable_sound: boolean;
  sound_volume: number;
  enable_hover_sounds: boolean;
  enable_click_sounds: boolean;
  enable_system_sounds: boolean;
  notification_sound_type: 'notification' | 'bell_ring' | 'success';
}

const DEFAULT_PREFERENCES: NotificationUIPreferences = {
  enable_popup_alerts: true,
  enable_sound: true,
  sound_volume: 0.4,
  enable_hover_sounds: false,
  enable_click_sounds: true,
  enable_system_sounds: true,
  notification_sound_type: 'notification',
};

const STORAGE_KEY = "lazeez-notification-ui-prefs";

function normalizePreferences(
  partial: Partial<NotificationUIPreferences> | Record<string, unknown>
): NotificationUIPreferences {
  const p = partial as Record<string, unknown>;
  let sound_volume = DEFAULT_PREFERENCES.sound_volume;
  const rawVol = p.sound_volume;
  if (typeof rawVol === "number" && Number.isFinite(rawVol)) {
    sound_volume = rawVol > 1 ? rawVol / 100 : rawVol;
  }
  sound_volume = Math.min(1, Math.max(0, sound_volume));

  let notification_sound_type = DEFAULT_PREFERENCES.notification_sound_type;
  const rawType = p.notification_sound_type;
  if (rawType === "notification" || rawType === "bell_ring" || rawType === "success") {
    notification_sound_type = rawType;
  }

  return {
    enable_popup_alerts:
      typeof p.enable_popup_alerts === "boolean"
        ? p.enable_popup_alerts
        : DEFAULT_PREFERENCES.enable_popup_alerts,
    enable_sound:
      typeof p.enable_sound === "boolean" ? p.enable_sound : DEFAULT_PREFERENCES.enable_sound,
    sound_volume,
    enable_hover_sounds:
      typeof p.enable_hover_sounds === "boolean"
        ? p.enable_hover_sounds
        : DEFAULT_PREFERENCES.enable_hover_sounds,
    enable_click_sounds:
      typeof p.enable_click_sounds === "boolean"
        ? p.enable_click_sounds
        : DEFAULT_PREFERENCES.enable_click_sounds,
    enable_system_sounds:
      typeof p.enable_system_sounds === "boolean"
        ? p.enable_system_sounds
        : DEFAULT_PREFERENCES.enable_system_sounds,
    notification_sound_type,
  };
}

export function useNotificationUIPreferences() {
  const [preferences, setPreferences] = useState<NotificationUIPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        return normalizePreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (e) {
      console.error("Failed to load notification UI preferences:", e);
    }
    return DEFAULT_PREFERENCES;
  });

  const updatePreferences = (updates: Partial<NotificationUIPreferences>) => {
    setPreferences((prev) => {
      const next = normalizePreferences({ ...prev, ...updates });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save notification UI preferences:", e);
      }
      return next;
    });
  };

  return {
    preferences,
    updatePreferences,
  };
}
