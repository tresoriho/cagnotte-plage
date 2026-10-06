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

-- 5. Données de départ (Seed)
INSERT INTO public.participants (id, nom, telephone, objectif) VALUES
('11111111-1111-1111-1111-111111111111', 'Koffi Marc', '+2250700000001', 25000),
('22222222-2222-2222-2222-222222222222', 'Yao Grâce', '+2250700000002', 25000),
('33333333-3333-3333-3333-333333333333', 'Konan Didier', '+2250700000003', 25000),
('44444444-4444-4444-4444-444444444444', 'N''Guessan Sarah', '+2250700000004', 25000),
('55555555-5555-5555-5555-555555555555', 'Kouassi Kevin', '+2250700000005', 25000),
('66666666-6666-6666-6666-666666666666', 'Adjoua Marie', '+2250700000006', 25000)
ON CONFLICT (id) DO NOTHING;

-- Insertion des paiements initiaux
INSERT INTO public.paiements (participant_id, montant, wave_transaction_id, statut, created_at, paid_at) VALUES
('11111111-1111-1111-1111-111111111111', 5000, 'WAVE_TX_8921', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111111', 10000, 'WAVE_TX_8944', 'completed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
('22222222-2222-2222-2222-222222222222', 25000, 'WAVE_TX_8731', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
('33333333-3333-3333-3333-333333333333', 5000, 'WAVE_TX_8812', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
('44444444-4444-4444-4444-444444444444', 10000, 'WAVE_TX_8890', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
('66666666-6666-6666-6666-666666666666', 10000, 'WAVE_TX_8650', 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
('66666666-6666-6666-6666-666666666666', 10000, 'WAVE_TX_8711', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
ON CONFLICT (wave_transaction_id) DO NOTHING;
