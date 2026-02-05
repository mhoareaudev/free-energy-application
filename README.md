# Free Energy - Suivi des Prospects

Application web interne pour Free Energy permettant de remplacer le suivi Excel par une application moderne "Excel-like".

## Fonctionnalités

- **Interface Excel-like** : Tableau avec cellules éditables, colonnes figées, groupes de colonnes
- **3 onglets de suivi** :
  - Suivi activités BtoC – Comptant
  - Suivi activités BtoC – Abonnement
  - Suivi activités BtoB
- **Barre de style** : Mise en forme des cellules (police, taille, gras, italique, couleurs, alignement)
- **Menu contextuel** : Clic droit pour couper/copier/coller, insérer/supprimer lignes et colonnes
- **Gestion des rôles** : Administratif, Technique, Commercial, Administrateur
- **Demande de VT** : Modal de demande pour les utilisateurs Administratif
- **Espace Administrateur** : Gestion des profils utilisateurs

## Technologies

- **Frontend** : React 18 + Vite
- **Backend** : Supabase (PostgreSQL + Auth)
- **UI** : CSS personnalisé (thème rouge Free Energy)
- **Icônes** : Lucide React

## Installation

1. Cloner le projet :
```bash
cd Documents
git clone <repository-url> free-energy-prospects
cd free-energy-prospects
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer Supabase :
   - Créer un projet sur [Supabase](https://supabase.com)
   - Exécuter le script `supabase/schema.sql` dans l'éditeur SQL
   - Copier `.env.example` vers `.env` et remplir les variables

4. Lancer l'application :
```bash
npm run dev
```

## Configuration Supabase

1. Créer un fichier `.env` à la racine :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key
```

2. Dans Supabase, aller dans Settings > API pour récupérer :
   - Project URL
   - Anon public key

## Structure du projet

```
free-energy-prospects/
├── public/
│   └── logo.svg           # Logo Free Energy
├── src/
│   ├── components/        # Composants React
│   │   ├── TopBar.jsx     # Barre supérieure
│   │   ├── StyleBar.jsx   # Barre de style Excel
│   │   ├── Spreadsheet.jsx# Tableau principal
│   │   ├── SheetTabs.jsx  # Onglets des feuilles
│   │   ├── ContextMenu.jsx# Menu clic droit
│   │   ├── VTRequestModal.jsx
│   │   └── AdminPanel.jsx
│   ├── context/           # Contextes React
│   │   ├── AuthContext.jsx
│   │   └── SpreadsheetContext.jsx
│   ├── data/              # Configuration des colonnes
│   │   └── sheetsConfig.js
│   ├── lib/               # Utilitaires
│   │   └── supabase.js
│   ├── pages/             # Pages
│   │   └── Login.jsx
│   ├── styles/            # Styles globaux
│   │   ├── global.css
│   │   └── variables.css
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   └── schema.sql         # Schéma de base de données
└── package.json
```

## Rôles utilisateurs

| Rôle | Permissions |
|------|-------------|
| **Administrateur** | Accès complet, gestion des profils |
| **Administratif** | Lecture/écriture, demande de VT |
| **Technique** | Lecture/écriture |
| **Commercial** | Lecture/écriture |

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Z` | Annuler |
| `Ctrl+Shift+Z` | Rétablir |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+C` | Copier |
| `Ctrl+X` | Couper |
| `Ctrl+V` | Coller |
| `Ctrl+B` | Gras |
| `Ctrl+I` | Italique |
| `Ctrl+U` | Souligné |

## Scripts npm

```bash
npm run dev     # Lancer en développement
npm run build   # Construire pour production
npm run preview # Prévisualiser le build
```

## Personnalisation

### Logo
Remplacer `public/logo.svg` par votre logo (ou `logo.png`).

### Couleurs
Les couleurs sont définies dans `src/styles/variables.css`. La couleur principale est rouge (`--primary-600: #dc2626`).

### Colonnes
Les configurations des colonnes sont dans `src/data/sheetsConfig.js`. Chaque onglet a sa propre configuration avec :
- Colonnes figées
- Groupes de colonnes
- Largeurs personnalisées

## Licence

Propriétaire - Free Energy © 2024
