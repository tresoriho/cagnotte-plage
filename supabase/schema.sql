-- ==============================================================================
-- SCHEMA SUPABASE : CAGNOTTE SORTIE PLAGE 🏖️
-- ==============================================================================

-- 1. Table des participants préenregistrés
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(100) NOT NULL,
    telephone VARCHAR(30),
    objectif INTEGER NOT NULL DEFAULT 25000 CHECK (objectif > 0),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table des versements / paiements
CREATE TABLE IF NOT EXISTS public.paiements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    montant INTEGER NOT NULL CHECK (montant > 0),
    wave_transaction_id VARCHAR(120) UNIQUE,
    wave_checkout_id VARCHAR(120),
    statut VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending', 'completed', 'failed', 'cancelled')),
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

-- Index pour accélérer les requêtes de calcul
CREATE INDEX IF NOT EXISTS idx_paiements_participant_id ON public.paiements(participant_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.paiements(statut);

-- 4. Activation de Row Level Security (RLS)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;

-- Politiques RLS réexécutables (Supprime l'ancienne si elle existe)
DROP POLICY IF EXISTS "Lecture publique des participants" ON public.participants;
CREATE POLICY "Lecture publique des participants" 
ON public.participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecture publique des paiements confirmés" ON public.paiements;
CREATE POLICY "Lecture publique des paiements confirmés" 
ON public.paiements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecture publique des annonces" ON public.annonces;
CREATE POLICY "Lecture publique des annonces" 
ON public.annonces FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insertion publique des annonces" ON public.annonces;
CREATE POLICY "Insertion publique des annonces" 
ON public.annonces FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Insertion réservée au Service Role" ON public.paiements;
CREATE POLICY "Insertion réservée au Service Role" 
ON public.paiements FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'anon');

-- 5. Publication Realtime Supabase (Sans erreur si déjà activé)
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
END $$;

-- 5. Données de départ : Les 11 Vrais Participants (0 donnée fictive)
INSERT INTO public.participants (id, nom, telephone, objectif) VALUES
('11111111-1111-1111-1111-000000000001', 'Albak', '', 25000),
('11111111-1111-1111-1111-000000000002', 'AKB', '', 25000),
('11111111-1111-1111-1111-000000000003', 'Amporio', '', 25000),
('11111111-1111-1111-1111-000000000004', 'Arthur', '', 25000),
('11111111-1111-1111-1111-000000000005', 'Basil', '', 25000),
('11111111-1111-1111-1111-000000000006', 'David', '', 25000),
('11111111-1111-1111-1111-000000000007', 'Papos', '', 25000),
('11111111-1111-1111-1111-000000000008', 'Stephane', '', 25000),
('11111111-1111-1111-1111-000000000009', 'Tony', '', 25000),
('11111111-1111-1111-1111-000000000010', 'Tresor', '', 25000),
('11111111-1111-1111-1111-000000000011', 'Yves', '', 25000)
ON CONFLICT (id) DO NOTHING;

-- Note : La table paiements démarre à 0 FCFA pour la vraie collecte.

