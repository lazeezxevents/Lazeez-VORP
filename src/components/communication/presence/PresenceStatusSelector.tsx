/**
 * PresenceStatusSelector Component
 * Task 14.2: Display presence indicators
 * Task 14.3: Implement custom status messages
 * Requirements: 10.1, 10.6, 10.8, 41.1, 41.2, 41.3, 41.4, 41.5, 41.6
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/lib/utils';
import { PresenceStatus, PRESET_STATUSES, formatLastSeen } from './PresenceManager';

interface PresenceStatusSelectorProps {
  currentStatus: PresenceStatus;
  customStatus?: string;
  statusExpiresAt?: Date;
  onStatusChange: (status: PresenceStatus) => void;
  onCustomStatusChange: (message: string, expiresAt?: Date) => void;
  onClearCustomStatus: () => void;
}

const STATUS_CONFIG = {
  online: {
    color: 'bg-green-500',
    label: 'Online',
    description: 'Active and available',
  },
  away: {
    color: 'bg-yellow-500',
    label: 'Away',
    description: 'Inactive for a while',
  },
  dnd: {
    color: 'bg-red-500',
    label: 'Do not disturb',
    description: 'Notifications muted',
  },
  offline: {
    color: 'bg-gray-400',
    label: 'Offline',
    description: 'Not connected',
  },
};

/**
 * PresenceStatusSelector - UI for selecting presence status and custom message
 */
export const PresenceStatusSelector = ({
  currentStatus,
  customStatus,
  statusExpiresAt,
  onStatusChange,
  onCustomStatusChange,
  onClearCustomStatus,
}: PresenceStatusSelectorProps) => {
  const [customMessage, setCustomMessage] = useState(customStatus || '');
  const [duration, setDuration] = useState('1h');
  const [isOpen, setIsOpen] = useState(false);

  const handleSetCustomStatus = () => {
    if (!customMessage.trim()) return;

    const durationMs = parseDuration(duration);
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : undefined;

    onCustomStatusChange(customMessage, expiresAt);
    setIsOpen(false);
  };

  const handleSelectPreset = (preset: typeof PRESET_STATUSES[0]) => {
    const expiresAt = new Date(Date.now() + preset.duration);
    onCustomStatusChange(`${preset.emoji} ${preset.label}`, expiresAt);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-auto py-2 px-3"
        >
          <span
            className={cn(
              'w-3 h-3 rounded-full',
              STATUS_CONFIG[currentStatus].color
            )}
          />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">
              {STATUS_CONFIG[currentStatus].label}
            </span>
            {customStatus && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {customStatus}
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Status selection */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2">Status</Label>
            <div className="space-y-1">
              {(Object.keys(STATUS_CONFIG) as PresenceStatus[]).map((status) => (
                <motion.button
                  key={status}
                  whileHover={{ x: 2 }}
                  onClick={() => onStatusChange(status)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
                    'hover:bg-accent',
                    currentStatus === status && 'bg-accent'
                  )}
                >
                  <span
                    className={cn(
                      'w-3 h-3 rounded-full',
                      STATUS_CONFIG[status].color
                    )}
                  />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">
                      {STATUS_CONFIG[status].label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {STATUS_CONFIG[status].description}
                    </div>
                  </div>
                  {currentStatus === status && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Custom status */}
          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground mb-2">
              Custom status
            </Label>

            {/* Current custom status */}
            {customStatus && (
              <div className="mb-3 p-2 bg-accent rounded-lg flex items-center justify-between">
                <span className="text-sm">{customStatus}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearCustomStatus}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Preset statuses */}
            <div className="space-y-1 mb-3">
              {PRESET_STATUSES.map((preset, index) => (
                <motion.button
                  key={index}
                  whileHover={{ x: 2 }}
                  onClick={() => handleSelectPreset(preset)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="text-sm flex-1">{preset.label}</span>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </motion.button>
              ))}
            </div>

            {/* Custom message input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="What's your status?"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  maxLength={100}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    // Open emoji picker (simplified)
                    const emoji = prompt('Enter emoji:');
                    if (emoji) {
                      setCustomMessage((prev) => prev + emoji);
                    }
                  }}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="4h">4 hours</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="never">Don't clear</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleSetCustomStatus}
                  disabled={!customMessage.trim()}
                >
                  Set
                </Button>
              </div>
            </div>
          </div>

          {/* Expiry info */}
          {statusExpiresAt && (
            <div className="text-xs text-muted-foreground">
              Status will clear {formatLastSeen(statusExpiresAt)}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number | null {
  switch (duration) {
    case '1h':
      return 60 * 60 * 1000;
    case '4h':
      return 4 * 60 * 60 * 1000;
    case 'today':
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return endOfDay.getTime() - now.getTime();
    case 'week':
      return 7 * 24 * 60 * 60 * 1000;
    case 'never':
      return null;
    default:
      return 60 * 60 * 1000;
  }
}

/**
 * Simple presence indicator badge
 */
export const PresenceBadge = ({
  status,
  size = 'md',
  showLabel = false,
}: {
  status: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) => {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'rounded-full',
          sizeClasses[size],
          STATUS_CONFIG[status].color
        )}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {STATUS_CONFIG[status].label}
        </span>
      )}
    </div>
  );
};
