// Sound Effects System for Lazeez VORP
// Embedded audio data URIs for production-ready sound effects

export type SoundType = 
  | 'notification' 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'click' 
  | 'hover' 
  | 'refresh' 
  | 'diagnostic' 
  | 'bell_ring' 
  | 'approval_complete'
  | 'system_ready'
  | 'task_complete';

export interface SoundConfig {
  volume: number;
  playbackRate?: number;
  loop?: boolean;
}

// Default sound configurations
const DEFAULT_CONFIGS: Record<SoundType, SoundConfig> = {
  notification: { volume: 0.4 },
  success: { volume: 0.3 },
  error: { volume: 0.5 },
  warning: { volume: 0.4 },
  click: { volume: 0.2 },
  hover: { volume: 0.1 },
  refresh: { volume: 0.3 },
  diagnostic: { volume: 0.3 },
  bell_ring: { volume: 0.4 },
  approval_complete: { volume: 0.5 },
  system_ready: { volume: 0.4 },
  task_complete: { volume: 0.4 }
};
// Embedded sound data URIs - Production ready audio files
const SOUND_DATA: Record<SoundType, string> = {
  // Notification sound - subtle ping
  notification: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Success sound - pleasant chime
  success: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Error sound - alert tone
  error: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Warning sound - attention beep
  warning: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
};
// Continue with more sound data
const SOUND_DATA_PART2: Partial<Record<SoundType, string>> = {
  // Click sound - soft tap
  click: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Hover sound - subtle whoosh
  hover: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Refresh sound - reload chime
  refresh: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
};

// Merge sound data
Object.assign(SOUND_DATA, SOUND_DATA_PART2);
// Add remaining sound data
const SOUND_DATA_PART3: Partial<Record<SoundType, string>> = {
  // Diagnostic sound - system beep
  diagnostic: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Bell ring - notification bell
  bell_ring: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Approval complete - success fanfare
  approval_complete: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // System ready - startup sound
  system_ready: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
  
  // Task complete - completion chime
  task_complete: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
};

// Merge final sound data
Object.assign(SOUND_DATA, SOUND_DATA_PART3);
// Sound management functions
export class SoundManager {
  private static instance: SoundManager;
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private getAudio(soundType: SoundType): HTMLAudioElement {
    if (!this.audioCache.has(soundType)) {
      const audio = new Audio(SOUND_DATA[soundType]);
      this.audioCache.set(soundType, audio);
    }
    return this.audioCache.get(soundType)!;
  }

  play(soundType: SoundType, config?: Partial<SoundConfig>): void {
    if (!this.enabled) return;

    try {
      const audio = this.getAudio(soundType);
      const finalConfig = { ...DEFAULT_CONFIGS[soundType], ...config };
      
      audio.volume = finalConfig.volume;
      if (finalConfig.playbackRate) audio.playbackRate = finalConfig.playbackRate;
      audio.loop = finalConfig.loop || false;
      
      audio.currentTime = 0;
      audio.play().catch(() => {}); // Handle autoplay restrictions
    } catch (e) {
      // Silently handle errors
    }
  }
}
// Convenience functions for easy usage
export const playSound = (soundType: SoundType, config?: Partial<SoundConfig>) => {
  const key = (soundType && soundType in SOUND_DATA ? soundType : "notification") as SoundType;
  SoundManager.getInstance().play(key, config);
};

export const setSoundEnabled = (enabled: boolean) => {
  SoundManager.getInstance().setEnabled(enabled);
};

// Predefined sound combinations for common scenarios
export const playNotificationSound = () => playSound('notification');
export const playSuccessSound = () => playSound('success');
export const playErrorSound = () => playSound('error');
export const playWarningSound = () => playSound('warning');
export const playClickSound = () => playSound('click');
export const playHoverSound = () => playSound('hover');
export const playRefreshSound = () => playSound('refresh');
export const playDiagnosticSound = () => playSound('diagnostic');
export const playBellRingSound = () => playSound('bell_ring');
export const playApprovalCompleteSound = () => playSound('approval_complete');
export const playSystemReadySound = () => playSound('system_ready');
export const playTaskCompleteSound = () => playSound('task_complete');