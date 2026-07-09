/**
 * Presence Manager
 * Task 14.1: Implement presence tracking
 * Requirements: 10.2, 10.3, 10.4, 10.5, 10.7
 */

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

interface PresenceData {
  status: PresenceStatus;
  customStatus?: string;
  statusExpiresAt?: Date;
  lastSeen: Date;
}

interface PresenceManagerConfig {
  awayTimeout: number; // milliseconds
  offlineTimeout: number; // milliseconds
  heartbeatInterval: number; // milliseconds
}

/**
 * PresenceManager - Track and manage user presence status
 */
export class PresenceManager {
  private config: PresenceManagerConfig;
  private currentStatus: PresenceStatus = 'offline';
  private customStatus?: string;
  private statusExpiresAt?: Date;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private offlineTimer?: number;
  private activityHandler?: () => void;
  private visibilityHandler?: () => void;
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;
  private blurHandler?: () => void;
  private onStatusChangeCallback?: (status: PresenceStatus) => void;
  private onPresenceChangeCallback?: (presence: PresenceData) => void;

  constructor(config?: Partial<PresenceManagerConfig>) {
    this.config = {
      awayTimeout: config?.awayTimeout || 5 * 60 * 1000, // 5 minutes
      offlineTimeout: config?.offlineTimeout || 30 * 1000, // 30 seconds
      heartbeatInterval: config?.heartbeatInterval || 30 * 1000, // 30 seconds
    };
  }

  /**
   * Initialize presence tracking
   */
  start(): void {
    // Set initial status to online
    this.setStatus('online');

    // Track user activity
    this.setupActivityTracking();

    // Start activity check interval
    this.activityCheckInterval = setInterval(() => {
      this.checkActivity();
    }, 10000); // Check every 10 seconds

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    console.log('[Presence] Manager started');
  }

  /**
   * Stop presence tracking
   */
  stop(): void {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.offlineTimer) {
      window.clearTimeout(this.offlineTimer);
      this.offlineTimer = undefined;
    }

    this.removeActivityTracking();
    this.setStatus('offline');

    console.log('[Presence] Manager stopped');
  }

  /**
   * Set user status manually
   */
  setStatus(status: PresenceStatus, expiresAt?: Date): void {
    const previousStatus = this.currentStatus;
    this.currentStatus = status;
    this.statusExpiresAt = expiresAt;

    if (previousStatus !== status) {
      console.log('[Presence] Status changed:', previousStatus, '->', status);
      this.onStatusChangeCallback?.(status);
      this.broadcastStatus();
    }
  }

  /**
   * Set custom status message
   */
  setCustomStatus(message: string, expiresAt?: Date): void {
    this.customStatus = message;
    this.statusExpiresAt = expiresAt;
    this.broadcastStatus();
  }

  /**
   * Clear custom status
   */
  clearCustomStatus(): void {
    this.customStatus = undefined;
    this.statusExpiresAt = undefined;
    this.broadcastStatus();
  }

  /**
   * Get current presence data
   */
  getPresence(): PresenceData {
    return {
      status: this.currentStatus,
      customStatus: this.customStatus,
      statusExpiresAt: this.statusExpiresAt,
      lastSeen: new Date(this.lastActivityTime),
    };
  }

  /**
   * Set callback for status changes
   */
  onStatusChange(callback: (status: PresenceStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  /**
   * Set callback for any presence changes
   */
  onPresenceChange(callback: (presence: PresenceData) => void): void {
    this.onPresenceChangeCallback = callback;
  }

  /**
   * Setup activity tracking
   */
  private setupActivityTracking(): void {
    this.activityHandler = () => {
      this.lastActivityTime = Date.now();
      
      // If user was away, set back to online
      if (this.currentStatus === 'away') {
        this.setStatus('online');
      }
    };

    // Track various user activities
    window.addEventListener('mousemove', this.activityHandler);
    window.addEventListener('keydown', this.activityHandler);
    window.addEventListener('click', this.activityHandler);
    window.addEventListener('scroll', this.activityHandler);
    window.addEventListener('touchstart', this.activityHandler);

    // Track visibility changes
    this.visibilityHandler = () => {
      if (document.hidden) {
        // User switched tabs/minimized window
        this.checkActivity();
      } else {
        // User returned
        this.activityHandler?.();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Track focus changes
    window.addEventListener('focus', this.activityHandler);
    this.blurHandler = () => {
      this.checkActivity();
    };
    window.addEventListener('blur', this.blurHandler);

    this.onlineHandler = () => {
      if (this.offlineTimer) {
        window.clearTimeout(this.offlineTimer);
        this.offlineTimer = undefined;
      }
      if (this.currentStatus !== 'dnd') {
        this.setStatus('online');
      }
    };

    this.offlineHandler = () => {
      if (this.offlineTimer) {
        window.clearTimeout(this.offlineTimer);
      }
      this.offlineTimer = window.setTimeout(() => {
        this.setStatus('offline');
      }, this.config.offlineTimeout);
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  /**
   * Remove activity tracking
   */
  private removeActivityTracking(): void {
    if (this.activityHandler) {
      window.removeEventListener('mousemove', this.activityHandler);
      window.removeEventListener('keydown', this.activityHandler);
      window.removeEventListener('click', this.activityHandler);
      window.removeEventListener('scroll', this.activityHandler);
      window.removeEventListener('touchstart', this.activityHandler);
      window.removeEventListener('focus', this.activityHandler);
    }

    if (this.blurHandler) {
      window.removeEventListener('blur', this.blurHandler);
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }

    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  /**
   * Check user activity and update status
   */
  private checkActivity(): void {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;

    // Check if custom status has expired
    if (this.statusExpiresAt && now >= this.statusExpiresAt.getTime()) {
      this.clearCustomStatus();
    }

    // Don't auto-change status if user manually set DND
    if (this.currentStatus === 'dnd') {
      return;
    }

    // Set to away after inactivity timeout
    if (timeSinceActivity >= this.config.awayTimeout && this.currentStatus === 'online') {
      this.setStatus('away');
    }
  }

  /**
   * Send heartbeat to server
   */
  private sendHeartbeat(): void {
    // This should send a heartbeat to the server via WebSocket
    console.log('[Presence] Sending heartbeat');
    // Example: webSocketClient.send({ type: 'presence.heartbeat', status: this.currentStatus });
  }

  /**
   * Broadcast status change
   */
  private broadcastStatus(): void {
    // This should broadcast status via WebSocket
    console.log('[Presence] Broadcasting status:', this.getPresence());
    // Example: webSocketClient.send({ type: 'presence.update', ...this.getPresence() });
    this.onPresenceChangeCallback?.(this.getPresence());
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();

/**
 * Preset status options
 */
export const PRESET_STATUSES = [
  { label: 'In a meeting', emoji: '📅', duration: 60 * 60 * 1000 }, // 1 hour
  { label: 'On vacation', emoji: '🏖️', duration: 7 * 24 * 60 * 60 * 1000 }, // 1 week
  { label: 'Working remotely', emoji: '🏠', duration: 8 * 60 * 60 * 1000 }, // 8 hours
  { label: 'Busy', emoji: '⚡', duration: 2 * 60 * 60 * 1000 }, // 2 hours
  { label: 'Out for lunch', emoji: '🍽️', duration: 60 * 60 * 1000 }, // 1 hour
  { label: 'Commuting', emoji: '🚗', duration: 60 * 60 * 1000 }, // 1 hour
  { label: 'In a call', emoji: '📞', duration: 60 * 60 * 1000 }, // 1 hour
  { label: 'Focusing', emoji: '🎯', duration: 2 * 60 * 60 * 1000 }, // 2 hours
];

/**
 * Format last seen timestamp
 */
export function formatLastSeen(lastSeen: Date): string {
  const now = Date.now();
  const diff = now - lastSeen.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return lastSeen.toLocaleDateString();
  }
}
