-- Create Test Channel for Communication Module
-- Run this AFTER applying the migration

-- Step 1: Get your user ID
SELECT id, full_name, email FROM profiles LIMIT 5;

-- Step 2: Replace YOUR_USER_ID below with your actual user ID from Step 1
DO $$
DECLARE
  dept_id UUID;
  chan_id UUID;
  user_id UUID := 'YOUR_USER_ID'; -- ⚠️ REPLACE THIS WITH YOUR ACTUAL USER ID
BEGIN
  -- Get General department (created by migration)
  SELECT id INTO dept_id FROM departments WHERE name = 'General';
  
  IF dept_id IS NULL THEN
    RAISE EXCEPTION 'General department not found. Did you run the migration?';
  END IF;
  
  -- Create test channel
  INSERT INTO channels (department_id, name, description)
  VALUES (dept_id, 'test-channel', 'Test channel for real-time messaging')
  RETURNING id INTO chan_id;
  
  -- Add yourself as owner
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (chan_id, user_id, 'owner');
  
  RAISE NOTICE 'Success! Channel ID: %', chan_id;
  RAISE NOTICE 'Copy this channel ID for testing';
END $$;
