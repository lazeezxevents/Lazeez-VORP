-- Fix Channel Members RLS Policies - Remove Infinite Recursion
-- This fixes the "infinite recursion detected in policy" error when creating channels

-- Drop the problematic policies
DROP POLICY IF EXISTS "Channel owners can add members" ON channel_members;
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;

-- Recreate with simpler, non-recursive policies
CREATE POLICY "Users can view channel members" 
ON channel_members FOR SELECT 
TO authenticated 
USING (true);  -- Simplified: all authenticated users can view members

CREATE POLICY "Channel owners can add members" 
ON channel_members FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Allow if user is admin
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
  OR
  -- Allow if user is owner/admin of the channel (check directly without recursion)
  EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = channel_members.channel_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
  OR
  -- Allow users to add themselves as members (for joining public channels)
  (channel_members.user_id = auth.uid() AND channel_members.role = 'member')
);

-- Also fix the channels view policy to avoid recursion
DROP POLICY IF EXISTS "Users can view their channels" ON channels;

CREATE POLICY "Users can view their channels" 
ON channels FOR SELECT 
TO authenticated 
USING (
  -- Allow if user is admin
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
  OR
  -- Allow if user is a member of the channel
  EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = channels.id
    AND cm.user_id = auth.uid()
  )
  OR
  -- Allow viewing public channels
  (is_private = false AND is_archived = false)
);

