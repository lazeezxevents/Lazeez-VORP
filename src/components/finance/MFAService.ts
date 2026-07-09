/**
 * Multi-Factor Authentication Service for Finance Module
 * Requires MFA for Finance Admin role
 * Supports TOTP (Time-based One-Time Password)
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface MFAVerificationResult {
  success: boolean;
  message: string;
}

export class MFAService {
  private static instance: MFAService;

  private constructor() {}

  static getInstance(): MFAService {
    if (!MFAService.instance) {
      MFAService.instance = new MFAService();
    }
    return MFAService.instance;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('finance_mfa_settings')
        .select('is_enabled')
        .eq('user_id', userId)
        .single();

      if (error) return false;
      return data?.is_enabled ?? false;
    } catch (error) {
      console.error('Failed to check MFA status:', error);
      return false;
    }
  }

  /**
   * Check if MFA is required for user's role
   */
  async isMFARequired(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) return false;
      
      // MFA required for admin role
      return data?.role === 'admin';
    } catch (error) {
      console.error('Failed to check MFA requirement:', error);
      return false;
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string): Promise<MFASetupResponse> {
    try {
      // Generate TOTP secret
      const { data, error } = await supabase.rpc('generate_mfa_secret', {
        p_user_id: userId
      });

      if (error) throw error;

      return {
        secret: data.secret,
        qrCode: data.qr_code,
        backupCodes: data.backup_codes
      };
    } catch (error) {
      console.error('Failed to setup MFA:', error);
      throw new Error('Failed to setup MFA');
    }
  }

  /**
   * Verify MFA code during setup
   */
  async verifySetup(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const { data, error } = await supabase.rpc('verify_mfa_setup', {
        p_user_id: userId,
        p_code: code
      });

      if (error) throw error;

      if (data.success) {
        // Enable MFA
        await supabase
          .from('finance_mfa_settings')
          .upsert({
            user_id: userId,
            is_enabled: true,
            enabled_at: new Date().toISOString()
          });

        return {
          success: true,
          message: 'MFA enabled successfully'
        };
      }

      return {
        success: false,
        message: 'Invalid verification code'
      };
    } catch (error) {
      console.error('Failed to verify MFA setup:', error);
      return {
        success: false,
        message: 'Failed to verify MFA'
      };
    }
  }

  /**
   * Verify MFA code during login
   */
  async verifyMFA(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const { data, error } = await supabase.rpc('verify_mfa_code', {
        p_user_id: userId,
        p_code: code
      });

      if (error) throw error;

      if (data.success) {
        // Log successful verification
        await this.logMFAAttempt(userId, true);

        return {
          success: true,
          message: 'MFA verified successfully'
        };
      }

      // Log failed verification
      await this.logMFAAttempt(userId, false);

      return {
        success: false,
        message: 'Invalid MFA code'
      };
    } catch (error) {
      console.error('Failed to verify MFA:', error);
      await this.logMFAAttempt(userId, false);
      
      return {
        success: false,
        message: 'Failed to verify MFA'
      };
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const { data, error } = await supabase.rpc('verify_backup_code', {
        p_user_id: userId,
        p_code: code
      });

      if (error) throw error;

      if (data.success) {
        await this.logMFAAttempt(userId, true, 'backup_code');

        return {
          success: true,
          message: 'Backup code verified successfully'
        };
      }

      await this.logMFAAttempt(userId, false, 'backup_code');

      return {
        success: false,
        message: 'Invalid backup code'
      };
    } catch (error) {
      console.error('Failed to verify backup code:', error);
      return {
        success: false,
        message: 'Failed to verify backup code'
      };
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string): Promise<void> {
    try {
      await supabase
        .from('finance_mfa_settings')
        .update({
          is_enabled: false,
          disabled_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      toast.success('MFA disabled successfully');
    } catch (error) {
      console.error('Failed to disable MFA:', error);
      toast.error('Failed to disable MFA');
      throw error;
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase.rpc('regenerate_backup_codes', {
        p_user_id: userId
      });

      if (error) throw error;

      return data.backup_codes;
    } catch (error) {
      console.error('Failed to regenerate backup codes:', error);
      throw new Error('Failed to regenerate backup codes');
    }
  }

  /**
   * Log MFA attempt
   */
  private async logMFAAttempt(
    userId: string,
    success: boolean,
    method: 'totp' | 'backup_code' = 'totp'
  ): Promise<void> {
    try {
      await supabase.from('finance_mfa_attempts').insert({
        user_id: userId,
        success,
        method,
        attempted_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log MFA attempt:', error);
    }
  }

  /**
   * Check if user is locked out due to failed attempts
   */
  async isLockedOut(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('finance_mfa_attempts')
        .select('success')
        .eq('user_id', userId)
        .gte('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('attempted_at', { ascending: false })
        .limit(5);

      if (error) return false;

      // Lock out if 5 consecutive failures in last 15 minutes
      if (data.length >= 5) {
        const allFailed = data.every(attempt => !attempt.success);
        return allFailed;
      }

      return false;
    } catch (error) {
      console.error('Failed to check lockout status:', error);
      return false;
    }
  }
}

/**
 * React hook for MFA operations
 */
export function useMFA() {
  const mfaService = MFAService.getInstance();

  const checkMFAEnabled = async (userId: string) => {
    return await mfaService.isMFAEnabled(userId);
  };

  const checkMFARequired = async (userId: string) => {
    return await mfaService.isMFARequired(userId);
  };

  const setupMFA = async (userId: string) => {
    return await mfaService.setupMFA(userId);
  };

  const verifySetup = async (userId: string, code: string) => {
    return await mfaService.verifySetup(userId, code);
  };

  const verifyMFA = async (userId: string, code: string) => {
    return await mfaService.verifyMFA(userId, code);
  };

  const verifyBackupCode = async (userId: string, code: string) => {
    return await mfaService.verifyBackupCode(userId, code);
  };

  const disableMFA = async (userId: string) => {
    await mfaService.disableMFA(userId);
  };

  const regenerateBackupCodes = async (userId: string) => {
    return await mfaService.regenerateBackupCodes(userId);
  };

  const checkLockedOut = async (userId: string) => {
    return await mfaService.isLockedOut(userId);
  };

  return {
    checkMFAEnabled,
    checkMFARequired,
    setupMFA,
    verifySetup,
    verifyMFA,
    verifyBackupCode,
    disableMFA,
    regenerateBackupCodes,
    checkLockedOut
  };
}
