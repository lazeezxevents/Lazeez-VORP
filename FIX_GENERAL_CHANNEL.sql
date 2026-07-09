-- Fix General Channel Visibility
-- This script ensures the #general channel exists and ALL users are members
-- Run this if #general channel is not showing in the sidebar

DO $$
DECLARE
  dept_id UUID;
  chan_id UUID;
  admin_user_id UUID;
  user_count INTEGER;
  member_count INTEGER;
BEGIN
  -- Step 1: Find or verify General department
  SELECT id INTO dept_id FROM departments WHERE name = 'General';
  
  IF dept_id IS NULL THEN
    RAISE EXCEPTION 'General department not found. Please run the main migration first.';
  END IF;
  
  RAISE NOTICE '✓ General department found: %', dept_id;
  
  -- Step 2: Find first admin user
  SELECT id INTO admin_user_id 
  FROM profiles 
  WHERE main_role = 'admin' 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;
  
  RAISE NOTICE '✓ Admin user found: %', admin_user_id;
  
  -- Step 3: Find or create general channel
  SELECT id INTO chan_id 
  FROM channels 
  WHERE department_id = dept_id AND LOWER(name) = 'general';
  
  IF chan_id IS NULL THEN
    -- Create general channel
    INSERT INTO channels (department_id, name, description, purpose, is_private, is_archived)
    VALUES (
      dept_id, 
      'general', 
      'Universal channel for all team members', 
      'A place for general team discussions and announcements',
      false,
      false
    )
    RETURNING id INTO chan_id;
    
    RAISE NOTICE '✓ Created general channel: %', chan_id;
  ELSE
    RAISE NOTICE '✓ General channel already exists: %', chan_id;
    
    -- Make sure it's not archived and is public
    UPDATE channels 
    SET is_archived = false, is_private = false
    WHERE id = chan_id;
  END IF;
  
  -- Step 4: Add admin as owner
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (chan_id, admin_user_id, 'owner')
  ON CONFLICT (channel_id, user_id) DO UPDATE
  SET role = 'owner';
  
  RAISE NOTICE '✓ Admin added as owner';
  
  -- Step 5: Add ALL users as members
  INSERT INTO channel_members (channel_id, user_id, role)
  SELECT chan_id, id, 'member'
  FROM profiles
  WHERE id != admin_user_id
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  -- Step 6: Count results
  SELECT COUNT(*) INTO user_count FROM profiles;
  SELECT COUNT(*) INTO member_count FROM channel_members WHERE channel_id = chan_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SUCCESS! General channel is now set up';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Channel ID: %', chan_id;
  RAISE NOTICE 'Total users: %', user_count;
  RAISE NOTICE 'Channel members: %', member_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh the Communication page';
  RAISE NOTICE '2. You should see #general at the top under "Universal"';
  RAISE NOTICE '3. Click on #general to start messaging!';
  RAISE NOTICE '';
  
  IF member_count < user_count THEN
    RAISE WARNING 'Warning: Not all users are members. Expected %, got %', user_count, member_count;
  END IF;
END $$;

-- Verify the setup
SELECT 
  c.id as channel_id,
  c.name as channel_name,
  d.name as department_name,
  c.is_private,
  c.is_archived,
  COUNT(cm.user_id) as member_count
FROM channels c
JOIN departments d ON d.id = c.department_id
LEFT JOIN channel_members cm ON cm.channel_id = c.id
WHERE LOWER(c.name) = 'general'
GROUP BY c.id, c.name, d.name, c.is_private, c.is_archived;
