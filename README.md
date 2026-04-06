# NCB Import — Importateur JSONL pour Nocodebackend

## Aperçu du projet
Application SPA (Single Page App) qui importe un fichier JSONL de grande taille (1,5 GB, ~50 000 lignes) dans 3 tables Nocodebackend via son API REST.

## Fonctionnalités implémentées

### ✅ Page 1 : Configuration
- Champ URL de base Nocodebackend (configurable)
- Clé secrète pré-remplie (ncb_12eddbee...)
- Bouton "Tester la connexion" avec GET vers /customers
- Indicateur vert/rouge de connexion

### ✅ Page 2 : Dashboard d'Import
- **Section A** : Zone drag & drop pour fichier .jsonl/.json.txt
  - Nom de fichier, taille en Go, lignes estimées
  - Analyse des 100 premières lignes (aperçu clients/commandes/produits)
- **Section B** : Contrôles
  - Slider concurrence (1-10, défaut 3)
  - Slider délai (0-500ms, défaut 100ms)
  - Mode simulation (dry run) — sans appels API
  - Boutons Démarrer / Pause / Reprendre / Annuler
  - Export données transformées (3 JSON)
- **Section C** : Progression en temps réel
  - 3 barres de progression (customers, orders, customer_products)
  - Compteurs insérés/échecs par table
  - Requêtes/seconde, temps écoulé, appels restants
  - Journal en direct (50 dernières entrées)
- **Section D** : Panneau d'erreurs
  - Liste collapsible des erreurs avec détails
  - Export JSON des erreurs
  - Bouton "Rejouer les échecs"

### ✅ Page 3 : Rapport & Vérification
- Tableau récapitulatif par table
- Vérification par échantillon (10 clients + 10 commandes GET)
- ✅/❌ pour chaque vérification
- Export rapport JSON complet
- Export CSV clients dédupliqués

### ✅ Transformations de données
- Normalisation téléphone (format 33XXXXXXXXX)
- Conversion timestamp Unix → ISO date
- Déduplication clients par email (Map en mémoire)
- Extraction prix avec fallbacks
- Extraction adresse livraison avec fallbacks
- Résolution état item depuis line_item_groups

### ✅ Performance
- Lecture streaming ligne par ligne (chunks 64KB, jamais de chargement complet)
- Sémaphore pour contrôle de concurrence
- Exponential backoff (1s, 2s, 4s) sur erreurs réseau/5xx
- Gestion 429 (rate limit) : pause 5s + retry
- Indicateur d'utilisation mémoire (performance.memory API)

### ✅ UX/UI
- Dark mode thème forêt (verts profonds + tons terreux)
- Tout en français
- Nombres en format français (1 000)
- Toasts de notification
- Animations de progression
- Persistance localStorage (URL, clé, paramètres)

## Pile technique
- React 18 + Vite
- Tailwind CSS v4
- Zustand (state management)
- Lucide React (icônes)
- React Hot Toast

## Structure des fichiers
```
src/
├── App.jsx                       // Point d'entrée + navigation
├── main.jsx
├── index.css                     // Theme sombre + variables CSS
├── components/
│   ├── ConfigPage.jsx            // Page 1 : Configuration
│   ├── ImportDashboard.jsx       // Page 2 : Dashboard principal
│   ├── VerificationReport.jsx    // Page 3 : Rapport
│   ├── FileDropZone.jsx          // Zone de dépôt de fichier
│   ├── ProgressSection.jsx       // Barres de progression
│   ├── LiveLog.jsx               // Journal en direct
│   └── ErrorPanel.jsx            // Panneau d'erreurs
├── lib/
│   ├── jsonlParser.js            // Parsing streaming JSONL
│   ├── dataTransformer.js        // Transformations des données
│   ├── customerDeduplicator.js   // Logique de déduplication
│   ├── apiClient.js              // Client API avec retry
│   ├── importEngine.js           // Orchestrateur d'import
│   └── utils.js                  // Utilitaires (format, dates, tél)
└── stores/
    └── importStore.js            // Store Zustand global
```

## Ordre d'import
1. **Parsing** : lecture streaming du fichier entier, construction map clients, collecte commandes/produits
2. **customers** : insertion de tous les clients dédupliqués
3. **orders** : insertion de toutes les commandes
4. **customer_products** : insertion de tous les produits
5. **Vérification** : échantillonnage GET aléatoire

## Avant l'import
1. ✅ Créer les 3 tables dans Nocodebackend (via MCP Cursor)
2. ✅ Vérifier l'URL API REST (test curl)
3. ✅ Confirmer la clé secrète
4. ✅ Lancer en mode simulation d'abord (dry run)

## Déploiement
- **Plateforme** : Cloudflare Pages (SPA statique)
- **Build** : `npm run build` → dist/
- **Dev local** : `npm run dev`
