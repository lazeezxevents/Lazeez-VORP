-- ============================================================================
-- MIGRATION: Add Role Promotion Notifications
-- ============================================================================
-- This migration enhances the role promotion trigger to create notifications
-- when users are promoted from employee to manager or vice versa.

-- Enhanced function to automatically promote employee to manager and create notifications
CREATE OR REPLACE FUNCTION sync_main_role_from_designation()
RETURNS TRIGGER AS $$
DECLARE
  designation_main_role VARCHAR(50);
  user_current_role VARCHAR(50);
  designation_display_name VARCHAR(255);
BEGIN
  -- Get the main_role and display_name from the custom_roles table for the assigned designation
  SELECT main_role, display_name INTO designation_main_role, designation_display_name
  FROM custom_roles
  WHERE id = NEW.role_id;
  
  -- Get the user's current main_role
  SELECT main_role INTO user_current_role
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If designation requires manager role and user is currently employee, promote them
  IF designation_main_role = 'manager' AND user_current_role = 'employee' THEN
    UPDATE profiles
    SET main_role = 'manager'
    WHERE id = NEW.user_id;
    
    -- Create notification for role promotion
    INSERT INTO notifications (
      user_id,
      type,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      NEW.user_id,
      'success',
      'hr',
      'Role Promotion',
      'You have been promoted from Employee to Manager',
      'role_assignment',
      NEW.id,
      '/dashboard',
      jsonb_build_object('from_role', 'employee', 'to_role', 'manager', 'designation', designation_display_name)
    );
    
    RAISE NOTICE 'User % promoted from employee to manager due to manager designation assignment', NEW.user_id;
  END IF;
  
  -- If designation requires employee role and user is currently manager, demote them
  IF designation_main_role = 'employee' AND user_current_role = 'manager' THEN
    UPDATE profiles
    SET main_role = 'employee'
    WHERE id = NEW.user_id;
    
    -- Create notification for role demotion
    INSERT INTO notifications (
      user_id,
      type,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      NEW.user_id,
      'info',
      'hr',
      'Role Update',
      'Your role has been updated from Manager to Employee',
      'role_assignment',
      NEW.id,
      '/dashboard',
      jsonb_build_object('from_role', 'manager', 'to_role', 'employee', 'designation', designation_display_name)
    );
    
    RAISE NOTICE 'User % demoted from manager to employee due to employee designation assignment', NEW.user_id;
  END IF;
  
  -- Update the designation display name in profiles
  UPDATE profiles
  SET designation = designation_display_name
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, so we don't need to recreate it
-- It will automatically use the updated function

-- Add comment for documentation
COMMENT ON FUNCTION sync_main_role_from_designation IS 'Automatically promotes/demotes users based on designation main_role and creates notifications for role changes';