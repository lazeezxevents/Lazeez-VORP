-- Communication hardening: removes recursive channel_members policies and
-- provides a safe server-side channel creation path with an owner membership.

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.communication_is_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.communication_is_channel_manager(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.communication_is_public_channel(p_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = p_channel_id AND is_private = false AND is_archived = false
  );
$$;

CREATE OR REPLACE FUNCTION public.communication_can_access_channel(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.communication_is_public_channel(p_channel_id)
      OR public.communication_is_channel_member(p_channel_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.create_communication_channel(
  p_department_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_purpose TEXT DEFAULT NULL,
  p_is_private BOOLEAN DEFAULT false
)
RETURNS public.channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_channel public.channels;
  clean_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = p_department_id) THEN
    RAISE EXCEPTION 'Department not found';
  END IF;

  clean_name := lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', '-', 'g'));
  IF clean_name = '' THEN
    RAISE EXCEPTION 'Channel name is required';
  END IF;

  INSERT INTO public.channels (department_id, name, description, purpose, is_private, created_by)
  VALUES (p_department_id, clean_name, nullif(trim(p_description), ''), nullif(trim(p_purpose), ''), coalesce(p_is_private, false), auth.uid())
  RETURNING * INTO new_channel;

  INSERT INTO public.channel_members (channel_id, user_id, role)
  VALUES (new_channel.id, auth.uid(), 'owner');

  RETURN new_channel;
END;
$$;

-- These policies previously queried channel_members from a channel_members policy,
-- which is the source of PostgreSQL's "infinite recursion" error.
DROP POLICY IF EXISTS "Users can view channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Channel owners can add members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.channel_members;
DROP POLICY IF EXISTS "Channel owners can remove members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;
DROP POLICY IF EXISTS "Users can create channels" ON public.channels;
DROP POLICY IF EXISTS "Channel owners can update channels" ON public.channels;
DROP POLICY IF EXISTS "Users can view channel messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Communication members can view members"
  ON public.channel_members FOR SELECT TO authenticated
  USING (public.communication_can_access_channel(channel_id, auth.uid()));

CREATE POLICY "Communication managers can add members"
  ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (
    public.communication_is_channel_manager(channel_id, auth.uid())
    OR (user_id = auth.uid() AND role = 'member' AND public.communication_is_public_channel(channel_id))
  );

CREATE POLICY "Communication members can update membership"
  ON public.channel_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.communication_is_channel_manager(channel_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.communication_is_channel_manager(channel_id, auth.uid()));

CREATE POLICY "Communication managers can remove members"
  ON public.channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.communication_is_channel_manager(channel_id, auth.uid()));

CREATE POLICY "Communication users can view channels"
  ON public.channels FOR SELECT TO authenticated
  USING ((is_private = false AND is_archived = false) OR public.communication_is_channel_member(id, auth.uid()));

CREATE POLICY "Communication channels created through RPC"
  ON public.channels FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Communication managers can update channels"
  ON public.channels FOR UPDATE TO authenticated
  USING (public.communication_is_channel_manager(id, auth.uid()))
  WITH CHECK (public.communication_is_channel_manager(id, auth.uid()));

CREATE POLICY "Communication users can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.communication_can_access_channel(channel_id, auth.uid()));

CREATE POLICY "Communication users can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.communication_can_access_channel(channel_id, auth.uid()));

-- A universal, public #general channel is always available after this migration.
DO $$
DECLARE
  general_department_id UUID;
BEGIN
  INSERT INTO public.departments (name, description)
  VALUES ('General', 'Company-wide communication')
  ON CONFLICT (name) DO UPDATE SET description = COALESCE(public.departments.description, EXCLUDED.description)
  RETURNING id INTO general_department_id;

  INSERT INTO public.channels (department_id, name, description, purpose, is_private, is_archived)
  VALUES (general_department_id, 'general', 'Company-wide announcements and discussion', 'A shared channel for everyone', false, false)
  ON CONFLICT (department_id, name) DO UPDATE
    SET is_private = false, is_archived = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_communication_channel(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.communication_is_channel_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.communication_is_channel_manager(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.communication_is_public_channel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.communication_can_access_channel(UUID, UUID) TO authenticated;
