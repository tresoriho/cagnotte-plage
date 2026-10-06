-- ==============================================================================
-- SCHEMA SUPABASE : CAGNOTTE SORTIE PLAGE 🏖️ (VERSION COMPLÈTE & TEMPS RÉEL)
-- ==============================================================================

-- 1. Table des participants préenregistrés
CREATE TABLE IF NOT EXISTS public.participants (
    id TEXT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    telephone VARCHAR(30),
    objectif INTEGER NOT NULL DEFAULT 25000 CHECK (objectif > 0),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table des versements / paiements
CREATE TABLE IF NOT EXISTS public.paiements (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    montant INTEGER NOT NULL CHECK (montant > 0),
    wave_transaction_id VARCHAR(120),
    wave_checkout_id VARCHAR(120),
    statut VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 3. Table des annonces / notifications broadcast
CREATE TABLE IF NOT EXISTS public.annonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table des réglages généraux synchronisés en temps réel
CREATE TABLE IF NOT EXISTS public.config_event (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main_event',
    app_name TEXT,
    app_tagline TEXT,
    event_location TEXT,
    event_meeting_info TEXT,
    event_inclusions TEXT,
    event_date TEXT,
    target_per_participant INTEGER,
    total_custom_goal INTEGER,
    wave_payment_url TEXT,
    hero_image TEXT,
    bottom_banner_image TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS idx_paiements_participant_id ON public.paiements(participant_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.paiements(statut);

-- 5. Activation de Row Level Security (RLS)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des participants" ON public.participants;
CREATE POLICY "Lecture publique des participants" 
ON public.participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture publique des paiements confirmés" ON public.paiements;
DROP POLICY IF EXISTS "Insertion réservée au Service Role" ON public.paiements;
DROP POLICY IF EXISTS "Gestion publique des paiements" ON public.paiements;
CREATE POLICY "Gestion publique des paiements" 
ON public.paiements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture publique des annonces" ON public.annonces;
CREATE POLICY "Lecture publique des annonces" 
ON public.annonces FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture publique config" ON public.config_event;
CREATE POLICY "Lecture publique config" 
ON public.config_event FOR ALL USING (true) WITH CHECK (true);

-- 6. Publication Realtime Supabase (Sans erreur si déjà activé)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.annonces;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config_event;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 7. Données de départ : Les 11 Vrais Participants
INSERT INTO public.participants (id, nom, telephone, objectif) VALUES
('1', 'Albak', '', 25000),
('2', 'AKB', '', 25000),
('3', 'Amporio', '', 25000),
('4', 'Arthur', '', 25000),
('5', 'Basil', '', 25000),
('6', 'David', '', 25000),
('7', 'Papos', '', 25000),
('8', 'Stephane', '', 25000),
('9', 'Tony', '', 25000),
('10', 'Tresor', '', 25000),
('11', 'Yves', '', 25000)
ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom, objectif = EXCLUDED.objectif;
