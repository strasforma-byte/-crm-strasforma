-- 1. Ajouter la colonne d'approbation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- 2. Mettre à jour la fonction de trigger pour gérer l'approbation automatique de l'admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, color, role, is_approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'color',
    CASE 
      WHEN NEW.email = 'ismail.harrouchi@strasforma.fr' THEN 'admin'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'commercial')
    END,
    CASE 
      WHEN NEW.email = 'ismail.harrouchi@strasforma.fr' THEN true
      ELSE false
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mettre à jour l'admin s'il existe déjà
UPDATE profiles SET role = 'admin', is_approved = true WHERE email = 'ismail.harrouchi@strasforma.fr';
