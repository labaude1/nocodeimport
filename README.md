# NCB Import - Importateur de commandes Nocodebackend

## Vue d'ensemble

Application React 18 + Vite permettant d'importer un fichier JSONL volumineux (1.5 GB, ~50k lignes) dans Nocodebackend, avec :
- **Streaming** : traite le fichier ligne par ligne sans charger en mémoire
- **Déduplication** : agrège les clients par email (lowercase + trim)
- **Anti-doublons** : vérifie et ignore les clients déjà présents dans la base
- **Throttling adaptatif** : compatible Tier 1 (20 req/10s) avec gestion intelligente des 429
- **Pause/Resume/Cancel** : contrôle total de l'import
- **Retry automatique** : 3 tentatives avec backoff exponentiel (1s, 2s, 4s)

---

## URLs & Accès

- **Production** : https://nocodeimport.pages.dev
- **GitHub** : https://github.com/labaude1/nocodeimport
- **API Nocodebackend** : https://api.nocodebackend.com
- **Instance** : 44716_e_commerce_order_import

---

## Architecture des données

### Tables Nocodebackend

1. **customers**
   - email (unique), first_name, last_name, phone (normalisé 33XXXXXXXXX)
   - title, zip_code, city, climate_zone
   - total_orders, total_spent (agrégés)
   - first_order_date, last_order_date (ISO 8601)
   - archetype, expertise_level, is_subscribed

2. **orders**
   - order_id (unique), customer_email (FK)
   - order_date (ISO 8601), state, order_type
   - total_price, currency, delivery_city, delivery_zip
   - items_count

3. **customer_products**
   - order_id (FK), customer_email (FK)
   - item_id, item_name, item_image
   - quantity, unit_price, item_state

### Services de stockage

- **Pas de backend persistant** : l'application fonctionne 100% côté client
- **localStorage** : persistance de la configuration (API URL, clé, paramètres)
- **Mémoire** : Map pour déduplication clients, Arrays pour orders/products

---

## Fonctionnalités

### ✅ Implémentées

#### Page 1 : Configuration
- Saisie API Root, Instance Name, Secret Key
- Test de connexion (GET /read/customers)
- Aperçu live de l'URL générée
- Validation et feedback

#### Page 2 : Dashboard d'import
- **A) Fichier** : drag & drop, estimation lignes/taille, preview 100 premières lignes
- **B) Paramètres** :
  - Concurrence : 1-10 (défaut 1 pour Tier 1)
  - Délai : 0-500ms (défaut 500ms pour Tier 1)
  - Mode simulation (dry-run)
  - **Ignorer les doublons** (défaut activé)
- **C) Actions** : Start, Pause, Resume, Cancel, Export JSON transformés
- **D) Progression** :
  - 3 barres animées (customers, orders, customer_products)
  - Compteurs : total, insérés, ignorés (doublons), échecs
  - Requêtes/sec, temps écoulé
- **E) Log live** : ~200 dernières entrées, filtres success/error/warning
- **F) Erreurs** : panel collapsible, export JSON, rejouer échecs

#### Page 3 : Rapport & Vérification
- Tableau récapitulatif (insérés/échecs par table)
- Vérification échantillon : 10 clients + 10 commandes (GET API)
- Export rapport JSON complet
- Export CSV clients dédupliqués

### Transformations de données

1. **Téléphones** : normalisation français → format international
   - "06 12 34 56 78" → "33612345678"
   - "0033612345678" → "33612345678"
   - "+33612345678" → "33612345678"

2. **Dates** : Unix timestamp → ISO 8601
   - 1672531200 → "2023-01-01T00:00:00.000Z"

3. **Adresses** : extraction ville/code postal depuis JSON

4. **Clients** : agrégation par email (lowercase, trim)
   - Total commandes, montant total dépensé
   - Dernière adresse, dernier téléphone
   - Première/dernière date de commande

---

## Gestion des limites Tier 1

### Limites Nocodebackend par plan

- **Tier 1** : 20 requêtes / 10 secondes = **2 req/sec max**
- **Tier 2+** : Aucune limite

### Stratégies anti-rate-limit

1. **Paramètres recommandés Tier 1** :
   - Concurrence = 1
   - Délai = 500ms (2 req/sec)
   
2. **Throttling adaptatif** :
   - Détecte les 429 consécutifs
   - Augmente automatiquement le délai (×1.5 jusqu'à 5s)
   - Pause globale de 5s après 429

3. **Anti-doublons multi-niveaux** :
   - **Batch check** : vérifie tous les emails avant insertion (mode reprise)
   - **Real-time check** : vérifie chaque client avant POST (filet de sécurité)
   - **Error handling** : détecte erreurs "unique constraint" et marque comme ignoré

4. **Retry intelligent** :
   - 3 tentatives avec backoff : 1s → 2s → 4s
   - 5s de pause supplémentaire sur 429
   - Ne retry pas les erreurs 4xx (sauf 429)

---

## Import sans doublons (mode reprise)

### Problème
- Fichier trop volumineux → import échoue en cours
- Relancer l'import → risque de créer 5000 clients en double

### Solution
1. **Activer "Ignorer les doublons"** (défaut ON)
2. Au début de la phase customers :
   - Batch check de TOUS les emails du fichier
   - Compare avec la base Nocodebackend
   - Filtre les clients existants AVANT insertion
3. Résultat : **0 duplicata**, même après 10 imports du même fichier

### Logs typiques
```
Vérification de 208,700 clients existants...
Vérification: 100/208,700 (12 doublons détectés)
Vérification: 200/208,700 (28 doublons détectés)
...
Vérification terminée: 5,432 clients déjà présents sur 208,700
5,432 clients déjà présents filtrés, 203,268 restants à insérer
```

---

## Guide d'utilisation

### Prérequis
1. Créer les 3 tables dans Nocodebackend (customers, orders, customer_products)
2. Obtenir l'API Root, Instance Name et Secret Key
3. Tester la connexion avec `curl` :
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     "https://api.nocodebackend.com/read/customers?Instance=YOUR_INSTANCE"
   ```

### Workflow d'import

#### 1️⃣ Configuration
- Page Config
- Saisir : `https://api.nocodebackend.com`, `44716_e_commerce_order_import`, `e2871fe4...`
- Clic "Tester la connexion" → doit retourner HTTP 200
- Clic "Suivant : Import"

#### 2️⃣ Simulation (dry-run)
- Dashboard : déposer le fichier JSONL
- **Activer "Mode simulation"**
- Concurrence = 1, Délai = 500ms
- Clic "Lancer la simulation"
- Vérifier les logs : transformations correctes ?
- Exporter les JSON transformés pour inspection

#### 3️⃣ Import réel (première fois)
- **Désactiver "Mode simulation"**
- **Activer "Ignorer les doublons"** ✅
- Concurrence = 1, Délai = 500ms
- Clic "Démarrer l'import"
- Surveiller :
  - Taux de requêtes (objectif : ~2 req/sec)
  - Erreurs 429 (si nombreux : pause + augmenter délai)
  - Clients ignorés (doublons détectés)

#### 4️⃣ En cas d'échec (429, network, etc.)
- L'import se met en pause automatiquement
- **NE PAS relancer un nouvel import complet**
- Options :
  - Clic "Reprendre" (continue où ça s'est arrêté)
  - Clic "Rejouer X échecs" (retry uniquement les échecs)
  - **OU** relancer un import complet avec "Ignorer les doublons" activé → 0 duplicata garanti

#### 5️⃣ Import suivant (même fichier)
- **Toujours activer "Ignorer les doublons"**
- L'application vérifie chaque email avant insertion
- Résultat : seuls les nouveaux clients sont insérés

---

## Déploiement

### Environnement de développement
```bash
npm install
npm run dev  # Vite dev server sur http://localhost:5173
```

### Production (Cloudflare Pages)
```bash
# Build
npm run build  # → dist/

# Test local
npm run preview

# Deploy
npx wrangler pages deploy dist --project-name ncb-import
```

### Variables d'environnement
Aucune variable d'environnement serveur nécessaire (app 100% client-side).

---

## Structure du projet

```
webapp/
├── src/
│   ├── components/
│   │   ├── ConfigPage.jsx          # Page 1 : config API
│   │   ├── ImportDashboard.jsx     # Page 2 : dashboard import
│   │   ├── VerificationReport.jsx  # Page 3 : rapport & vérification
│   │   ├── FileDropZone.jsx        # Zone drop fichier + preview
│   │   ├── ProgressSection.jsx     # Barres progression par table
│   │   ├── LiveLog.jsx             # Log temps réel scrollable
│   │   └── ErrorPanel.jsx          # Panel erreurs + export/retry
│   ├── lib/
│   │   ├── jsonlParser.js          # Parser JSONL streaming (FileReader)
│   │   ├── dataTransformer.js      # Transformations (phone, dates, etc.)
│   │   ├── customerDeduplicator.js # Déduplication par email (Map)
│   │   ├── apiClient.js            # Client API Nocodebackend + retry
│   │   ├── importEngine.js         # Moteur import (semaphore, batch check)
│   │   └── utils.js                # Helpers (formatters, sleep)
│   ├── stores/
│   │   └── importStore.js          # Zustand store global (config, state)
│   ├── App.jsx                     # Router 3 pages
│   └── main.jsx                    # Entry point
├── public/                         # Assets statiques
├── vite.config.js                  # Config Vite
├── package.json
├── .gitignore
└── README.md                       # Ce fichier
```

---

## Limitations connues

1. **Taille fichier** : testé jusqu'à 1.5 GB, streaming sans limite théorique
2. **Tier 1** : import complet ~208k clients ≈ 29h (2 req/sec)
   - Solution : Tier 2+ (unlimited) ou imports par lots
3. **Navigateur** : Chrome/Edge recommandés (Web Streams API)
4. **Mémoire** : garde tous les clients en Map pendant parsing
   - 200k clients ≈ 500 MB RAM (acceptable pour navigateurs modernes)

---

## Dépannage

### Erreurs 404 "Cannot POST /customers"
❌ **Mauvais** : POST https://api.nocodebackend.com/customers  
✅ **Correct** : POST https://api.nocodebackend.com/create/customers?Instance=44716_...

### Erreurs 429 "Rate limit exceeded"
- Tier 1 détecté → réduire concurrence à 1, délai à 500ms
- Activer throttling adaptatif (déjà intégré)
- Pour imports réguliers : upgrade Tier 2+

### Clients en double après import
- Vérifier que "Ignorer les doublons" est activé
- Mode reprise : batch check filtre automatiquement les existants
- En cas de doute : exécuter SQL `SELECT email, COUNT(*) FROM customers GROUP BY email HAVING COUNT(*) > 1`

### Import bloqué/gelé
- Ouvrir la console navigateur (F12) → vérifier erreurs JS
- Vérifier mémoire disponible (>2 GB recommandé)
- Relancer navigateur et réessayer

---

## Support & Contact

- **Issues GitHub** : https://github.com/labaude1/nocodeimport/issues
- **Documentation Nocodebackend** : https://docs.nocodebackend.com
- **API Docs** : https://api.nocodebackend.com/api-docs/?Instance=44716_e_commerce_order_import

---

## Changelog

### v1.1.0 (2026-04-08)
- ✅ Anti-doublons : batch check + filtrage avant insertion
- ✅ Throttling adaptatif Tier 1
- ✅ UI : toggle "Ignorer les doublons"
- ✅ Logs : compteur clients ignorés (doublons)
- ✅ Documentation : guide import sans doublons

### v1.0.0 (2026-04-06)
- ✅ Parsing JSONL streaming (FileReader 64 KB chunks)
- ✅ Déduplication clients par email
- ✅ Transformations : phone, dates, extraction adresses
- ✅ Import ordonné : customers → orders → customer_products
- ✅ Concurrency avec semaphore (1-10)
- ✅ Pause/Resume/Cancel
- ✅ Retry automatique (3×, backoff exponentiel)
- ✅ UI : 3 pages (Config, Dashboard, Rapport)
- ✅ Export JSON transformés
- ✅ Déploiement Cloudflare Pages

---

## Licence

Propriétaire - Tous droits réservés
