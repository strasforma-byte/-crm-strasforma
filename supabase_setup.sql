-- Supprimer les tables si elles existent (Attention: supprime les données)
-- DROP TABLE IF EXISTS rdv_proposals;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS pipeline_cards;
-- DROP TABLE IF EXISTS pipeline_columns;
-- DROP TABLE IF EXISTS pipelines;
-- DROP TABLE IF EXISTS contacts;
-- DROP TABLE IF EXISTS contact_lists;
-- DROP TABLE IF EXISTS profiles;

-- 1. Table des Profils (utilisateurs)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'commercial',
  color TEXT,
  settings JSONB DEFAULT '{"shareAgendaWithProspectors": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Active RLS sur profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Table des Listes de Contacts
CREATE TABLE contact_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to contact_lists" ON contact_lists FOR ALL USING (true);

-- 3. Table des Contacts
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  siret TEXT,
  postal_code TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  interactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to contacts" ON contacts FOR ALL USING (true);

-- 4. Table des Pipelines
CREATE TABLE pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to pipelines" ON pipelines FOR ALL USING (true);

-- 5. Table des Colonnes de Pipeline
CREATE TABLE pipeline_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE pipeline_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to pipeline_columns" ON pipeline_columns FOR ALL USING (true);

-- 6. Table des Cartes de Pipeline
CREATE TABLE pipeline_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID REFERENCES pipeline_columns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title TEXT,
  value NUMERIC DEFAULT 0,
  priority TEXT DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE pipeline_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to pipeline_cards" ON pipeline_cards FOR ALL USING (true);

-- 7. Table des Tâches
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true);

-- 8. Table des Propositions RDV
CREATE TABLE rdv_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_slots JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE rdv_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to rdv_proposals" ON rdv_proposals FOR ALL USING (true);

-- 9. Table des Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to notifications" ON notifications FOR ALL USING (true);

-- Fonction pour mettre à jour automatiquement les profils lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, color, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'color',
    COALESCE(NEW.raw_user_meta_data->>'role', 'commercial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour l'inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
