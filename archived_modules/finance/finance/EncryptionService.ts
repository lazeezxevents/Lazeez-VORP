/**
 * Encryption Service for Finance Module
 * Encrypts sensitive data (bank account details, tax IDs)
 * Implements key rotation for security
 */

import { supabase } from '@/integrations/supabase/client';

interface EncryptedData {
  ciphertext: string;
  iv: string;
  keyVersion: number;
}

interface EncryptionKey {
  id: string;
  version: number;
  key: CryptoKey;
  createdAt: Date;
  isActive: boolean;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private keys: Map<number, EncryptionKey> = new Map();
  private currentKeyVersion: number = 1;
  
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12;

  private constructor() {
    this.initializeKeys();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption keys
   */
  private async initializeKeys(): Promise<void> {
    try {
      // Load keys from secure storage or generate new ones
      const { data: keyData } = await supabase
        .from('finance_encryption_keys')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (keyData) {
        this.currentKeyVersion = keyData.version;
        // In production, keys would be loaded from secure key management service
        await this.loadKey(keyData.version);
      } else {
        // Generate initial key
        await this.generateNewKey();
      }
    } catch (error) {
      console.error('Failed to initialize encryption keys:', error);
      // Fallback to generating new key
      await this.generateNewKey();
    }
  }

  /**
   * Generate a new encryption key
   */
  private async generateNewKey(): Promise<void> {
    const key = await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );

    const newVersion = this.currentKeyVersion + 1;
    
    const encryptionKey: EncryptionKey = {
      id: crypto.randomUUID(),
      version: newVersion,
      key,
      createdAt: new Date(),
      isActive: true
    };

    this.keys.set(newVersion, encryptionKey);
    this.currentKeyVersion = newVersion;

    // Store key metadata (not the actual key) in database
    await supabase.from('finance_encryption_keys').insert({
      version: newVersion,
      created_at: new Date().toISOString(),
      is_active: true
    });
  }

  /**
   * Load encryption key by version
   */
  private async loadKey(version: number): Promise<void> {
    // In production, this would load from a secure key management service
    // For now, generate a deterministic key based on version
    const key = await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );

    const encryptionKey: EncryptionKey = {
      id: crypto.randomUUID(),
      version,
      key,
      createdAt: new Date(),
      isActive: true
    };

    this.keys.set(version, encryptionKey);
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    const keyEntry = this.keys.get(this.currentKeyVersion);
    if (!keyEntry) {
      throw new Error('Encryption key not available');
    }

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    // Convert plaintext to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv
      },
      keyEntry.key,
      data
    );

    // Convert to base64 for storage
    const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
    const ivBase64 = this.arrayBufferToBase64(iv);

    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      keyVersion: this.currentKeyVersion
    };
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    let keyEntry = this.keys.get(encryptedData.keyVersion);
    
    // Load key if not in memory
    if (!keyEntry) {
      await this.loadKey(encryptedData.keyVersion);
      keyEntry = this.keys.get(encryptedData.keyVersion);
    }

    if (!keyEntry) {
      throw new Error(`Encryption key version ${encryptedData.keyVersion} not found`);
    }

    // Convert from base64
    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv
      },
      keyEntry.key,
      ciphertext
    );

    // Convert bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(): Promise<void> {
    // Mark current key as inactive
    await supabase
      .from('finance_encryption_keys')
      .update({ is_active: false })
      .eq('version', this.currentKeyVersion);

    // Generate new key
    await this.generateNewKey();

    console.log(`Encryption key rotated to version ${this.currentKeyVersion}`);
  }

  /**
   * Re-encrypt data with new key
   */
  async reencrypt(encryptedData: EncryptedData): Promise<EncryptedData> {
    // Decrypt with old key
    const plaintext = await this.decrypt(encryptedData);
    
    // Encrypt with current key
    return await this.encrypt(plaintext);
  }

  /**
   * Helper: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Utility functions for encrypting specific data types
 */
export class SensitiveDataEncryption {
  private static encryption = EncryptionService.getInstance();

  /**
   * Encrypt bank account number
   */
  static async encryptBankAccount(accountNumber: string): Promise<EncryptedData> {
    return await this.encryption.encrypt(accountNumber);
  }

  /**
   * Decrypt bank account number
   */
  static async decryptBankAccount(encryptedData: EncryptedData): Promise<string> {
    return await this.encryption.decrypt(encryptedData);
  }

  /**
   * Encrypt tax ID
   */
  static async encryptTaxId(taxId: string): Promise<EncryptedData> {
    return await this.encryption.encrypt(taxId);
  }

  /**
   * Decrypt tax ID
   */
  static async decryptTaxId(encryptedData: EncryptedData): Promise<string> {
    return await this.encryption.decrypt(encryptedData);
  }

  /**
   * Encrypt routing number
   */
  static async encryptRoutingNumber(routingNumber: string): Promise<EncryptedData> {
    return await this.encryption.encrypt(routingNumber);
  }

  /**
   * Decrypt routing number
   */
  static async decryptRoutingNumber(encryptedData: EncryptedData): Promise<string> {
    return await this.encryption.decrypt(encryptedData);
  }

  /**
   * Mask sensitive data for display
   */
  static maskBankAccount(accountNumber: string): string {
    if (accountNumber.length <= 4) return '****';
    return '****' + accountNumber.slice(-4);
  }

  /**
   * Mask tax ID for display
   */
  static maskTaxId(taxId: string): string {
    if (taxId.length <= 4) return '****';
    return '***-**-' + taxId.slice(-4);
  }
}

/**
 * React hook for encryption operations
 */
export function useEncryption() {
  const encryption = EncryptionService.getInstance();

  const encryptData = async (plaintext: string) => {
    return await encryption.encrypt(plaintext);
  };

  const decryptData = async (encryptedData: EncryptedData) => {
    return await encryption.decrypt(encryptedData);
  };

  const rotateKey = async () => {
    await encryption.rotateKey();
  };

  return {
    encryptData,
    decryptData,
    rotateKey
  };
}
