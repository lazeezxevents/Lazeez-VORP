/**
 * Debouncing and Throttling Utilities
 * Task 12.4: Implement debouncing and throttling
 * Requirements: 21.10, 33.5
 */

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last time it was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastResult: ReturnType<T>;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Debounced search input handler (300ms delay)
 */
export const debouncedSearch = debounce((
  query: string,
  callback: (query: string) => void
) => {
  callback(query);
}, 300);

/**
 * Throttled typing indicator (max 1 per second)
 */
export const throttledTypingIndicator = throttle((
  channelId: string,
  callback: (channelId: string) => void
) => {
  callback(channelId);
}, 1000);

/**
 * Debounced draft auto-save (500ms delay)
 */
export const debouncedDraftSave = debounce((
  channelId: string,
  content: string,
  callback: (channelId: string, content: string) => void
) => {
  callback(channelId, content);
}, 500);

/**
 * Throttled scroll handler (100ms limit)
 */
export const throttledScroll = throttle((
  callback: () => void
) => {
  callback();
}, 100);

/**
 * Debounced window resize handler (200ms delay)
 */
export const debouncedResize = debounce((
  callback: () => void
) => {
  callback();
}, 200);

/**
 * Throttled presence update (30 seconds)
 */
export const throttledPresenceUpdate = throttle((
  status: string,
  callback: (status: string) => void
) => {
  callback(status);
}, 30000);

/**
 * Debounced input validation (300ms delay)
 */
export const debouncedValidation = debounce((
  value: string,
  callback: (value: string) => void
) => {
  callback(value);
}, 300);

/**
 * Create a debounced function with cancel capability
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): {
  execute: (...args: Parameters<T>) => void;
  cancel: () => void;
} {
  let timeout: NodeJS.Timeout | null = null;

  const execute = (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return { execute, cancel };
}

/**
 * Create a throttled function with reset capability
 */
export function createThrottledFunction<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): {
  execute: (...args: Parameters<T>) => void;
  reset: () => void;
} {
  let inThrottle = false;
  let lastResult: ReturnType<T>;
  let timeoutId: NodeJS.Timeout | null = null;

  const execute = (...args: Parameters<T>) => {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;
      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
    return lastResult;
  };

  const reset = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
  };

  return { execute, reset };
}

/**
 * Debounce with leading edge execution
 * Executes immediately on first call, then debounces subsequent calls
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    const later = () => {
      timeout = null;
      lastCallTime = Date.now();
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    // Execute immediately if enough time has passed
    if (timeSinceLastCall >= wait) {
      lastCallTime = now;
      func(...args);
    } else {
      timeout = setTimeout(later, wait - timeSinceLastCall);
    }
  };
}

/**
 * Batch multiple calls into a single execution
 */
export function batchCalls<T>(
  func: (items: T[]) => void,
  wait: number
): (item: T) => void {
  let batch: T[] = [];
  let timeout: NodeJS.Timeout | null = null;

  return (item: T) => {
    batch.push(item);

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func([...batch]);
      batch = [];
      timeout = null;
    }, wait);
  };
}
