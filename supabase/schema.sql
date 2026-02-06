-- Free Energy Prospects - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  identifiant VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'commercial' CHECK (role IN ('administratif', 'technique', 'commercial', 'administrateur')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VT Requests table
CREATE TABLE IF NOT EXISTS vt_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  commercial VARCHAR(200),
  type_client VARCHAR(20) DEFAULT 'btoc' CHECK (type_client IN ('btoc', 'btob')),
  type_contrat VARCHAR(20) DEFAULT 'comptant' CHECK (type_contrat IN ('comptant', 'abonnement')),
  target_sheet VARCHAR(50),
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter existing table if needed (run separately if table already exists)
-- ALTER TABLE vt_requests ADD COLUMN IF NOT EXISTS commercial VARCHAR(200);
-- ALTER TABLE vt_requests ADD COLUMN IF NOT EXISTS type_client VARCHAR(20) DEFAULT 'btoc';
-- ALTER TABLE vt_requests ADD COLUMN IF NOT EXISTS type_contrat VARCHAR(20) DEFAULT 'comptant';
-- ALTER TABLE vt_requests ADD COLUMN IF NOT EXISTS target_sheet VARCHAR(50);

-- Sheets table to store sheet data
CREATE TABLE IF NOT EXISTS sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}',
  styles JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sheet_id)
);

-- Cell history for audit trail
CREATE TABLE IF NOT EXISTS cell_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id VARCHAR(50) NOT NULL,
  cell_id VARCHAR(20) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies

-- Profiles: Users can read all profiles, but only admins can insert/update/delete
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

-- VT Requests: Administratif users can create, all authenticated can read
ALTER TABLE vt_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VT requests are viewable by authenticated users" ON vt_requests
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create VT requests" ON vt_requests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update VT requests" ON vt_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

-- Sheets: All authenticated users can read and write
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sheets are viewable by authenticated users" ON sheets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sheets" ON sheets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update sheets" ON sheets
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Cell history: All authenticated users can read, only system can write
ALTER TABLE cell_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cell history is viewable by authenticated users" ON cell_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cell history" ON cell_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_vt_requests_status ON vt_requests(status);
CREATE INDEX IF NOT EXISTS idx_vt_requests_requested_by ON vt_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_sheets_sheet_id ON sheets(sheet_id);
CREATE INDEX IF NOT EXISTS idx_cell_history_sheet_cell ON cell_history(sheet_id, cell_id);

-- Functions

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vt_requests_updated_at
  BEFORE UPDATE ON vt_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sheets_updated_at
  BEFORE UPDATE ON sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, identifiant, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Utilisateur'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'commercial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);

-- Enable realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Role visibility table (controls which column groups each role can see)
CREATE TABLE IF NOT EXISTS role_visibility (
  role VARCHAR(50) PRIMARY KEY CHECK (role IN ('administratif', 'technique', 'commercial')),
  hidden_groups JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE role_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role visibility is viewable by authenticated users" ON role_visibility
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert role visibility" ON role_visibility
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

CREATE POLICY "Admins can update role visibility" ON role_visibility
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrateur'
    )
  );

CREATE TRIGGER update_role_visibility_updated_at
  BEFORE UPDATE ON role_visibility
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create default admin user (run this manually after creating a user in Auth)
-- INSERT INTO profiles (id, nom, prenom, identifiant, role)
-- VALUES ('your-user-uuid', 'Admin', 'Free Energy', 'admin@free-energy.fr', 'administrateur');
