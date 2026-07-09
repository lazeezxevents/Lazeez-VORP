-- =====================================================
-- Muted Channels Migration
-- =====================================================
-- Description: Add support for channel muting
-- Requirements: 24.5, 24.6
-- Created: 2026-05-09
-- =====================================================

-- =====================================================
-- MUTED_CHANNELS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.muted_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    muted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_muted_channels_user ON public.muted_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_channels_channel ON public.muted_channels(channel_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.muted_channels ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - MUTED_CHANNELS
-- =====================================================
CREATE POLICY "Users can view own muted channels"
ON public.muted_channels FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can mute channels"
ON public.muted_channels FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (
        SELECT channel_id FROM public.channel_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can unmute channels"
ON public.muted_channels FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, DELETE ON public.muted_channels TO authenticated;
