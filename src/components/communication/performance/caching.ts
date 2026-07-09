/**
 * Caching Strategy Implementation
 * Task 12.2: Implement caching strategy
 * Requirements: 21.4, 21.5
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Configure TanStack Query with optimal caching settings
 */
export const communicationQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Cache keys for communication module
 */
export const CACHE_KEYS = {
  departments: 'communication:departments',
  channels: (departmentId?: string) => 
    departmentId ? `communication:channels:${departmentId}` : 'communication:channels',
  channelDetails: (channelId: string) => `communication:channel:${channelId}`,
  messages: (channelId: string, threadId?: string) => 
    threadId 
      ? `communication:messages:${channelId}:thread:${threadId}`
      : `communication:messages:${channelId}`,
  directMessages: 'communication:direct-messages',
  dmMessages: (conversationId: string) => `communication:dm-messages:${conversationId}`,
  userProfile: (userId: string) => `communication:user:${userId}`,
  userPresence: (userId: string) => `communication:presence:${userId}`,
  channelMembers: (channelId: string) => `communication:members:${channelId}`,
  search: (query: string) => `communication:search:${query}`,
  bookmarks: (userId: string) => `communication:bookmarks:${userId}`,
  reminders: (userId: string) => `communication:reminders:${userId}`,
};

/**
 * LocalStorage cache manager for channel metadata
 */
class LocalStorageCache {
  private readonly prefix = 'vorp_comm_';
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: any): void {
    try {
      const item = {
        value,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.warn('[Cache] Failed to set localStorage item:', error);
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const { value, timestamp } = JSON.parse(item);
      
      // Check if expired
      if (Date.now() - timestamp > this.maxAge) {
        this.remove(key);
        return null;
      }

      return value as T;
    } catch (error) {
      console.warn('[Cache] Failed to get localStorage item:', error);
      return null;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.warn('[Cache] Failed to remove localStorage item:', error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[Cache] Failed to clear localStorage:', error);
    }
  }
}

export const localCache = new LocalStorageCache();

/**
 * IndexedDB manager for offline message storage
 */
class IndexedDBManager {
  private dbName = 'vorp_communication';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('channelId', 'channelId', { unique: false });
          messageStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('channels')) {
          db.createObjectStore('channels', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('userProfiles')) {
          db.createObjectStore('userProfiles', { keyPath: 'id' });
        }
      };
    });
  }

  async storeMessages(messages: any[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      messages.forEach(message => {
        store.put(message);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessages(channelId: string, limit: number = 50): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('channelId');
      const request = index.getAll(channelId, limit);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async storeChannel(channel: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['channels'], 'readwrite');
      const store = transaction.objectStore('channels');
      const request = store.put(channel);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChannel(channelId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['channels'], 'readonly');
      const store = transaction.objectStore('channels');
      const request = store.get(channelId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async storeUserProfile(profile: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readwrite');
      const store = transaction.objectStore('userProfiles');
      const request = store.put(profile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserProfile(userId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readonly');
      const store = transaction.objectStore('userProfiles');
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['messages', 'channels', 'userProfiles'],
        'readwrite'
      );

      transaction.objectStore('messages').clear();
      transaction.objectStore('channels').clear();
      transaction.objectStore('userProfiles').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const indexedDBManager = new IndexedDBManager();

/**
 * Memory cache for frequently accessed data
 */
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  set(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global user profile cache (5 minute TTL)
export const userProfileCache = new MemoryCache<any>(200);

// Channel metadata cache
export const channelMetadataCache = new MemoryCache<any>(100);
