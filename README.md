# Cagnotte Sortie Plage 🏖️ — Single Page Application (SPA)

Application web moderne, mobile-first et élégante pour gérer les cotisations d'une sortie à la plage entre amis avec paiement **Wave**, suivi des objectifs individuels et globaux, et notifications en **temps réel**.

![Aperçu Plage](assets/images/hero-beach.jpg)

---

## 🌟 Points Forts & Fonctionnalités

1. **Zéro compte utilisateur** : Aucun mot de passe, aucune inscription. Les participants sont préenregistrés.
2. **Calculs dynamiques** :
   - Objectif global calculé dynamiquement : `Nombre de participants × 25 000 FCFA` (ex: 6 × 25 000 = **150 000 FCFA**).
   - Somme des versements confirmés en temps réel.
   - Reste à collecter et pourcentage d'avancement.
3. **Statuts automatiques** :
   - `Non commencé` (0 FCFA)
   - `En cours` (entre 1 et 24 999 FCFA)
   - `Soldé ✅` (25 000 FCFA ou plus)
4. **Paiement Wave & Sécurité** :
   - Sélection du participant et montant libre ou rapide (5 000 FCFA, 10 000 FCFA, Reste à solder).
   - Validation stricte (interdiction de dépasser le reste à payer, interdiction de payer pour un participant déjà soldé).
   - Architecture sécurisée avec Backend Serverless (Netlify Functions) + Webhook Wave avec signature HMAC SHA256.
5. **Expérience Temps Réel & Célébration** :
   - Notifications Toast automatiques avec carillon audio synthétisé (sans fichier lourd).
   - Écran de célébration post-paiement avec comparatif `Avant → Après` et confettis HTML5 Canvas.
   - Compte à rebours précis jusqu'au jour de la sortie.
6. **Mobile First & Zéro Débordement Horizontal** :
   - Design testé et adapté de 320px à 1920px+.
   - Navigation mobile fixe en bas avec indicateurs actifs.

---

## 🚀 Démarrage Rapide en Local

Vous pouvez ouvrir directement le fichier `index.html` dans votre navigateur ou lancer un petit serveur local HTTP :

### Option 1 : Via Python
```bash
python -m http.server 3000
```
Puis ouvrez `http://localhost:3000` dans votre navigateur.

### Option 2 : Via Node.js (npx serve)
```bash
npx serve .
```

---

## 🧪 Scénarios de Test Validés

- **Test 1** : Sélectionner **Koffi Marc** (15 000 FCFA déjà versés). Cliquer sur « Reste à solder » (10 000 FCFA) ou verser 10 000 FCFA → Total : **25 000 / 25 000 FCFA**, badge passe automatiquement à **Soldé ✅**.
- **Test 2** : Sélectionner **Kouassi Kevin** (0 FCFA). Effectuer un versement de 10 000 FCFA → Total : **10 000 / 25 000 FCFA**, badge passe à **En cours ⏳**.
- **Test 3** : À chaque paiement confirmé, un **Toast en temps réel** apparaît avec son et détails du versement.
- **Test 4** : La barre globale et le montant collecté sont immédiatement recalculés.
- **Test 5** : Vérifier sur mobile (320px - 430px) : aucun défilement horizontal, interface 100% fluide.
- **Test 6 & 7** : Saisir un montant supérieur au reste à payer ou tenter de payer pour un participant soldé : le système bloque l'action avec un message explicite.

---

## 🗄️ Connexion Supabase en Production

1. Créez un projet sur [Supabase](https://supabase.com/).
2. Exécutez le script SQL présent dans `supabase/schema.sql` dans l'éditeur SQL de Supabase.
3. Dans `js/config.js`, renseignez :
```javascript
SUPABASE_URL: "https://votre-projet.supabase.co",
SUPABASE_ANON_KEY: "votre-cle-anon-publique-supabase",
```
4. Déployez les fonctions serverless dans `netlify/functions/` avec vos variables d'environnement Wave (`WAVE_SECRET_API_KEY`, `WAVE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
