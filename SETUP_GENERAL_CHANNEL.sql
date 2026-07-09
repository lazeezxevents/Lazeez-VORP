-- Setup General Department and Channel (AUTOMATIC VERSION)
-- Run this AFTER applying the main migration
-- This creates the default General department with a general channel
-- This version automatically uses the FIRST admin user it finds

DO $$
DECLARE
  dept_id UUID;
  chan_id UUID;
  admin_user_id UUID;
BEGIN
  -- Find the first admin user
  SELECT id INTO admin_user_id 
  FROM profiles 
  WHERE main_role = 'admin' 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;
  
  RAISE NOTICE 'Using admin user: %', admin_user_id;
  
  -- Get or create General department (already created by migration)
  SELECT id INTO dept_id FROM departments WHERE name = 'General';
  
  IF dept_id IS NULL THEN
    RAISE EXCEPTION 'General department not found. Did you run the migration?';
  END IF;
  
  -- Check if general channel already exists
  SELECT id INTO chan_id FROM channels WHERE department_id = dept_id AND name = 'general';
  
  IF chan_id IS NOT NULL THEN
    RAISE NOTICE 'General channel already exists: %', chan_id;
  ELSE
    -- Create general channel
    INSERT INTO channels (department_id, name, description, purpose, is_private)
    VALUES (
      dept_id, 
      'general', 
      'General discussion channel', 
      'A place for general team discussions and announcements',
      false
    )
    RETURNING id INTO chan_id;
    
    RAISE NOTICE 'Created general channel: %', chan_id;
  END IF;
  
  -- Add admin as owner if not already a member
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (chan_id, admin_user_id, 'owner')
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Add ALL users as members of the general channel (visible to everyone)
  INSERT INTO channel_members (channel_id, user_id, role)
  SELECT chan_id, id, 'member'
  FROM profiles
  WHERE id != admin_user_id
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  RAISE NOTICE '✅ Success! General channel is now visible to ALL users';
  RAISE NOTICE 'Channel ID: %', chan_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh the Communication page';
  RAISE NOTICE '2. ALL users should see "General" department with #general channel';
  RAISE NOTICE '3. Click on #general to start messaging!';
END $$;
