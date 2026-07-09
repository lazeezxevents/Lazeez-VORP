import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { UserSession } from './types.js';

/**
 * Supabase client for authentication
 */
let supabaseClient: SupabaseClient;

/**
 * Initialize Supabase client
 */
export function initializeSupabase(): void {
  supabaseClient = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Validate JWT token and return user session
 * 
 * Requirements: 19.3 - Authenticate user using existing VORP session tokens
 * 
 * @param token - JWT token from client
 * @returns User session information or null if invalid
 */
export async function validateToken(token: string): Promise<UserSession | null> {
  try {
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      console.error('Token validation failed:', error?.message);
      return null;
    }
    
    // Fetch user role and channel memberships
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Failed to fetch user data:', userError.message);
      return null;
    }
    
    // Fetch user's channel memberships
    const { data: channelMemberships, error: channelError } = await supabaseClient
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', user.id);
    
    if (channelError) {
      console.error('Failed to fetch channel memberships:', channelError.message);
      return null;
    }
    
    return {
      userId: user.id,
      email: user.email || '',
      role: userData?.role || 'Employee',
      channels: channelMemberships?.map((m) => m.channel_id) || [],
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

/**
 * Update user presence status
 * 
 * @param userId - User ID
 * @param status - Presence status (online, away, dnd, offline)
 */
export async function updatePresence(
  userId: string,
  status: 'online' | 'away' | 'dnd' | 'offline'
): Promise<void> {
  try {
    await supabaseClient
      .from('user_presence')
      .upsert({
        user_id: userId,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to update presence:', error);
  }
}

/**
 * Get Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  return supabaseClient;
}
