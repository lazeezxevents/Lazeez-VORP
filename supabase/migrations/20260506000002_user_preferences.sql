    -- User Preferences for Communication Module
    -- Stores user-specific settings like department order

    CREATE TABLE IF NOT EXISTS user_communication_preferences (
        user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        department_order JSONB DEFAULT '[]'::jsonb,
        enable_department_reordering BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- RLS Policies
    ALTER TABLE user_communication_preferences ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view own preferences" ON user_communication_preferences;
    DROP POLICY IF EXISTS "Users can update own preferences" ON user_communication_preferences;
    DROP POLICY IF EXISTS "Users can insert own preferences" ON user_communication_preferences;

    CREATE POLICY "Users can view own preferences" 
    ON user_communication_preferences FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());

    CREATE POLICY "Users can update own preferences" 
    ON user_communication_preferences FOR UPDATE 
    TO authenticated 
    USING (user_id = auth.uid()) 
    WITH CHECK (user_id = auth.uid());

    CREATE POLICY "Users can insert own preferences" 
    ON user_communication_preferences FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

    -- Trigger to update updated_at
    CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_communication_preferences;
    CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_communication_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

    -- Grant permissions
    GRANT ALL ON user_communication_preferences TO authenticated;
