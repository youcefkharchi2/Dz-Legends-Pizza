# DZ Legends Pizza — Gestion & Caisse

Application privée de gestion de pizzeria, interface française charbon & or / lumière & or. Aucune donnée métier de démonstration n’est créée.

## Important : périmètre technique

C’est une application **Next.js 16 + React + PostgreSQL via Drizzle**. **Elle n’utilise pas SQLite.** Le mode serveur sert le frontend à `/`; `site/index.html` contient aussi l’interface HTML hors ligne décrite ci-dessous et ne redirige jamais vers un serveur arrêté.

## Mode HTML hors ligne

`site/index.html` est également utilisable directement par double-clic, sans serveur ni réseau. Il contient l’interface de gestion hors ligne en HTML/CSS/JavaScript natif : tableau de bord, caisse, commandes, produits, catégories, stock, dépenses, rapports, employés et paramètres. Les données et les images sont conservées dans IndexedDB du navigateur; les sauvegardes JSON et les tickets imprimables sont disponibles dans Paramètres.

Ce mode est local à un profil de navigateur. Il ne fournit pas une authentification réellement sécurisée, ne synchronise pas plusieurs navigateurs et ne remplace pas le mode PostgreSQL pour des comptes employés partagés. Certains navigateurs peuvent limiter IndexedDB pour `file://`; Chrome/Edge doivent autoriser le stockage local pour ce fichier.

Le lanceur Windows fourni nécessite Node.js et un PostgreSQL local fonctionnel. Ce dépôt n’est pas un installeur autonome et ne contient ni un binaire Node.js ni un moteur de base de données.

## Installation locale (Windows 11)

1. Installer Node.js 22 LTS ou plus récent et PostgreSQL 16+ avec un service démarrant automatiquement.
2. Créer une base PostgreSQL et un utilisateur dédiés. Configurer `DATABASE_URL` dans `.env` (exemple de forme : `postgresql://UTILISATEUR:MOT_DE_PASSE@127.0.0.1:5432/NOM_BASE`). Ne jamais diffuser ce fichier.
3. Copier tout le projet dans un dossier accessible en écriture.
4. Double-cliquer sur **Start DZ Legends Pizza.bat**. Au premier lancement, les dépendances sont installées (internet nécessaire), le schéma est appliqué, puis la version de production est construite. Le lanceur attend `/api/health` avant d’ouvrir le navigateur et affiche les erreurs de démarrage dans sa fenêtre.
5. Le navigateur par défaut est ouvert automatiquement uniquement quand le serveur et PostgreSQL sont prêts. Conserver la fenêtre du serveur ouverte pendant le service.
6. Cliquer sur **Configurer mon espace** pour créer le propriétaire. Aucun mot de passe public ou prédéfini.

Après installation et construction, les ressources (polices, photographie, icônes et scripts) sont locales; aucun service internet n’est requis pour la gestion courante. Le service PostgreSQL doit rester disponible. Le port est 3000 par défaut; `PORT` permet de le changer et le lanceur utilise automatiquement cette même valeur. La page `site/index.html` est un aide-mémoire pour le démarrage, pas le mode de lancement du serveur.

Pour une mise à jour du code, reconstruire avec `npm run build` avant de relancer. La fermeture du serveur ne réinitialise jamais les données. L’application écoute uniquement 127.0.0.1 avec le lanceur local. Ne pas exposer le port sur internet sans HTTPS, proxy et politique de sauvegarde adaptés. L’accès direct à `file://` ne peut pas fournir l’authentification, les images partagées et la base PostgreSQL : le fichier `.bat` est donc le mode de démarrage supporté.

## Fonctionnalités

- Dix sections, recherche globale, filtres, thème mémorisé (seul le thème utilise localStorage).
- Premier propriétaire, bcrypt (12 tours), sessions opaques de 12 h dans un cookie HttpOnly/SameSite strict, déconnexion, révocation des sessions lors de la modification d’un compte.
- Permissions de pages et actions vérifiées sur les API. Gestion des employés et sauvegardes réservées aux administrateurs.
- Produits, catégories, images PNG/JPEG/WebP (5 Mo maximum), activation, tailles, suppléments, recettes.
- Images conservées en base PostgreSQL, partagées entre navigateurs et incluses dans les sauvegardes.
- Caisse, panier conservé en mémoire pendant la navigation, remises autorisées, espèces/carte/autre, montant reçu, monnaie, attente et encaissement.
- Clé d’idempotence de vente, verrou transactionnel partagé et contrôle de version pour éviter les doublons et pertes de mises à jour.
- Commandes, préparation, finalisation, annulation et remboursement avec restitution des ingrédients. Le remboursement physique reste à effectuer par l’employé.
- Stocks, entrées/sorties, coûts moyens pondérés à l’achat, fournisseurs, seuils, mouvements historisés.
- Dépenses et achats de stock distingués pour éviter un double comptage.
- Graphique de bénéfice des sept derniers jours, rapports et filtres de dates, recettes, coûts, dépenses, bénéfice, produits, catégories, employés, consommation nette.
- CSV et PDF via la fenêtre d’impression du navigateur (choisir « Enregistrer en PDF »).
- Tickets thermiques 58/80 mm via le pilote d’impression du navigateur. Pas d’impression matérielle silencieuse ni de gestion spécifique ESC/POS.
- Export/restauration JSON comprenant images, paramètres et comptes hachés; copie de sécurité avant restauration/réinitialisation. Le propriétaire actuel reste préservé.
- Copie automatique horodatée avant la première mutation de chaque jour (14 copies conservées dans la base).
- Synchronisation toutes les 8 secondes lorsque la page est visible et au retour dans la fenêtre. Les commandes d’écriture sont immédiatement appliquées sur la base commune.

## Règles de calcul

`Bénéfice net = ventes Terminées − coût des produits vendus − charges d’exploitation`.

Le coût d’un produit est la somme des quantités de recette multipliées par les coûts unitaires de stock configurés. Sans recette, le coût direct du produit est utilisé. Le coût est figé dans la commande. Les suppléments ajoutent leur coût configuré. Aucun coût manquant n’est inventé.

Les recettes utilisent l’unité de stock choisie : 150 g se saisit 0,15 si l’unité est kg. Les tailles d’un même produit partagent la même recette; créer des produits distincts pour des recettes différentes.

Les achats de stock doivent être marqués « Achat de stock déjà valorisé » dans les dépenses. Ils restent visibles dans le suivi, sans être à nouveau soustraits au bénéfice. Les entrées valorisées mettent à jour le coût moyen du stock, pas les charges d’exploitation.

Seules les commandes Terminées contribuent au chiffre d’affaires et aux coûts. Une annulation retire la commande des calculs et restitue le stock une seule fois. Une mise en attente ne déduit pas le stock; il est vérifié à la finalisation. Les graphiques utilisent les jours calendaires du navigateur et les horodatages enregistrés. Configurez tous les navigateurs sur le même fuseau, celui de l’Algérie.

## Stockage et sauvegardes

PostgreSQL est l’unique source de vérité, jamais localStorage. Les tables `dz_*` sont définies dans `src/db/schema.ts`. Les sauvegardes automatiques sont stockées dans `dz_backups`, pas dans un dossier local; télécharger les exports vers un disque externe pour se prémunir contre une panne de la base ou du PC.

Les exports contiennent des informations privées et des mots de passe hachés. Les garder à l’abri. Ils n’incluent pas les sessions. Avant une réinitialisation destructive, exporter également une copie externe. La réinitialisation préserve le compte propriétaire, les fichiers et les copies de sécurité.

## Architecture

- `src/app/` : page principale, thème et API Next.js
- `src/components/` : navigation, tableau de bord, caisse, gestion, formulaires, rapports et paramètres
- `src/lib/` : types, sécurité, sessions et impression
- `src/db/` : connexion Drizzle et schéma PostgreSQL
- `public/` : ressources locales
- `server/launcher.mjs` et `Start DZ Legends Pizza.bat` : démarrage local
- `site/index.html` : raccourci HTML d’ouverture
- `tests/` : tests d’intégration et de navigation (si présents)

## Validation

Les commandes de validation sont `npx next typegen`, `npm exec tsc -- --noEmit --pretty false` et `npm run build`. La route `/api/health` contrôle la connexion PostgreSQL. Les tests de navigateur automatisés ne remplacent pas les essais physiques sur Windows 11, Chrome/Edge/Firefox installés et une imprimante thermique réelle.

Le compte rendu détaillé des 34 contrôles automatisés et des essais non réalisés est disponible dans **[TESTING.md](TESTING.md)**. Les scripts de `tests/` sont réservés à une base de test vide : ils comprennent volontairement des scénarios destructifs de réinitialisation et de restauration. Ils ne sont jamais exécutés au lancement normal du logiciel.
