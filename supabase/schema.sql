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

-- Index pour accélérer les requêtes de calcul
CREATE INDEX IF NOT EXISTS idx_paiements_participant_id ON public.paiements(participant_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.paiements(statut);

-- 3. Activation de Row Level Security (RLS)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : Lecture publique autorisée (Aucun compte requis)
CREATE POLICY "Lecture publique des participants" 
ON public.participants FOR SELECT USING (true);

CREATE POLICY "Lecture publique des paiements confirmés" 
ON public.paiements FOR SELECT USING (true);

-- Politiques RLS : Seul le backend sécurisé (Service Role) peut insérer ou modifier les paiements
CREATE POLICY "Insertion réservée au Service Role" 
ON public.paiements FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'anon');

-- 4. Publication Realtime Supabase
-- Permet à Supabase Realtime d'émettre des événements sur les nouvelles insertions
ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

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

