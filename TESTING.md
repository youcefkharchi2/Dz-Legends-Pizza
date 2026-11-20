# Validation — DZ Legends Pizza

## Résumé

**34 contrôles automatisés réussis** : 27 scénarios d’intégration, 6 contrôles Chromium/Firefox et 1 vérification de persistance après redémarrage du serveur de production.

Environnement : Linux, Node.js 22, Next.js 16.4.2, PostgreSQL, navigateurs Chromium et Firefox automatisés par Playwright. Les tests utilisent uniquement des comptes et données temporaires préfixés QA et une base initialement vide. Ils ne créent pas de données de démonstration à livrer.

## Contrôles réussis

### Démarrage et interface

- Génération des types Next.js, contrôle TypeScript sans émission et compilation de production.
- Démarrage géré du serveur et réponse positive de `/api/health` avec PostgreSQL.
- État initial sans produits, catégories, stocks, commandes, dépenses ou employés.
- Exactement sept barres de bénéfice à zéro au premier lancement.
- Ouverture des dix pages, sans changement automatique de page lors d’une synchronisation.
- Modes sombre et clair appliqués instantanément et mémorisés après rechargement.
- Mise en page mobile, menu repliable et absence de débordement horizontal au format contrôlé.
- Aucune erreur JavaScript pendant les parcours automatisés.

### Comptes et sécurité

- Création du premier propriétaire, sans identifiant public prédéfini.
- Connexion administrateur dans deux sessions isolées.
- Création d’un caissier et limitation du menu aux pages autorisées.
- Refus côté API des opérations interdites sur employés, produits, dépenses, paramètres, sauvegardes, remises et remboursements.
- Masquage des coûts directs, des coûts des suppléments et des coûts des lignes de vente pour un profil sans permission financière.
- Révocation immédiate des sessions après désactivation d’un compte.
- Export contenant les mots de passe hachés, jamais le mot de passe de test en clair.
- Audit des dépendances de production : `npm audit --omit=dev` ne signale aucune vulnérabilité au moment du contrôle. Cela ne signifie pas qu’aucune vulnérabilité future ou dans les outils de développement n’existe.

### Carte, caisse et commandes

- Création d’un produit depuis le formulaire, image téléversée, catégorie, taille, supplément et recette.
- Images de caisse de largeur et hauteur identiques, rayon CSS de 50 % et `object-fit: cover` dans Chromium et Firefox.
- Accès aux mêmes images et données depuis des sessions et moteurs de navigateur indépendants.
- Encaissement avec deux articles, supplément, remise, montant reçu, monnaie et caissier enregistrés.
- Coût des produits et quantités de recette correctement déduits.
- Quatre demandes d’encaissement concurrentes avec la même clé ne créent qu’une vente et une consommation.
- Refus d’une vente sans stock suffisant, avec annulation transactionnelle de toutes les modifications.
- Mise en attente, préparation, statut prête, finalisation et remboursement.
- Réintégration du stock et retrait des recettes financières exactement une fois lors du remboursement.
- Rejet d’une modification utilisant une version périmée.
- Suppression individuelle d’un produit sans modification des ventes passées.
- Renommage et suppression d’une catégorie sans perte de la catégorie historique dans les rapports.

### Stocks, dépenses et rapports

- Entrées et sorties de stock, historique et calcul du coût moyen pondéré.
- Édition d’un stock dont le coût moyen contient plusieurs décimales.
- Dépenses d’exploitation déduites du bénéfice et achats de stock valorisés exclus du double comptage.
- Modification et suppression d’une dépense avec recalcul du bénéfice.
- Graphique représentant un bénéfice réel négatif, avec infobulle exacte et jour courant en jaune.
- Une dépense créée dans Chromium actualise le tableau de bord Firefox sans rechargement manuel.
- La synchronisation ne change pas la page sélectionnée.
- Rapports calculés sur les données sauvegardées, chemin d’export CSV et génération d’un PDF de navigateur.
- Tickets HTML 58 mm et 80 mm contenant numéro, caissier, articles, total, paiement et monnaie.

### Sauvegardes et persistance

- Export complet incluant images, paramètres, comptes hachés et données métier.
- Existence d’une sauvegarde automatique horodatée.
- Rejet d’une restauration malformée avant toute suppression.
- Refus d’une réinitialisation sans confirmation exacte.
- Réinitialisation avec remise à zéro du graphique et préservation du propriétaire.
- Restauration des images, produits, stocks, commandes, paramètres et chiffres financiers.
- Conservation des données, images et sessions après redémarrage de la production.
- Retrait explicite des comptes et données de test avant livraison, sans mécanisme de réinitialisation automatique au lancement.

## Limites et essais non réalisés

- **Le lanceur `.bat` n’a pas été exécuté sur Windows 11.** Sa logique Node.js a été vérifiée syntaxiquement et son comportement lorsqu’un serveur est déjà disponible a été exercé sous Linux. L’installation Windows et l’ouverture du navigateur par défaut doivent encore être vérifiées sur un PC Windows réel.
- **Google Chrome et Microsoft Edge installés n’ont pas été lancés.** Les tests ont utilisé Chromium et Firefox sous Linux. Ils prouvent le partage entre sessions et moteurs indépendants, pas une certification spécifique à ces deux produits Windows.
- **Aucune imprimante thermique physique n’a été connectée.** Les tickets, formats de page et fenêtres d’impression sont contrôlés; le pilote, la découpe et la sortie papier doivent être vérifiés sur le matériel cible.
- L’application est en **Next.js/PostgreSQL**, pas en HTML autonome/SQLite. Elle n’est pas livrée comme un installeur Windows autonome. Voir README.md.
- Les exports PDF utilisent la fonction d’impression du navigateur. Aucun service externe ni impression silencieuse ESC/POS n’est intégré.
- Une sauvegarde à restaurer est limitée à 80 Mo et les images téléversées à 5 Mo chacune. Les tests ne constituent pas un essai de charge prolongé ni un audit de sécurité indépendant.

## Reproduire les tests

Ne jamais exécuter la suite d’intégration sur une base métier utilisée : elle comprend volontairement des tests de réinitialisation et de restauration. Le script refuse de démarrer si un propriétaire existe déjà. La suppression des fixtures refuse les comptes dont l’identifiant ne commence pas par `qa-`.

1. Préparer une base PostgreSQL de test vide et démarrer l’application.
2. Installer les navigateurs et dépendances Playwright : `npx playwright install --with-deps chromium firefox`.
3. Exécuter `DZ_TEST_EMPTY_DB=1 node tests/integration.mjs` (adapter la définition de variable pour PowerShell).
4. Exécuter `node tests/cross-browser.mjs`.
5. Redémarrer le serveur et exécuter `node tests/integration.mjs --verify-restart`.
6. Supprimer uniquement les fixtures : `DZ_TEST_EMPTY_DB=1 npx tsx tests/cleanup-fixtures.ts`.

Les captures, PDF et comptes rendus sont générés dans `test-results/`, ignoré par Git. Les états de session de test doivent être supprimés après vérification. Ils ne contiennent pas de mot de passe en clair, mais les cookies restent des informations sensibles.
