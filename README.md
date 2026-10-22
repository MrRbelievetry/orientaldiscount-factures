# OrientalDiscount — Modification des factures

Application statique en français : importez un PDF OrientalDiscount, collez la nouvelle adresse et générez **BX FA[numéro].pdf**. Aucun compte, serveur de traitement, cookie ou stockage des coordonnées. Le PDF original reste intact.

## Traitement

PDF.js analyse les textes et leurs positions. Les titres livraison/facturation et la ligne « Numéro de facture » définissent la zone, sans coordonnées fixes. Le moteur analyse lexicalement le flux TCPDF et supprime les objets texte de livraison correspondants. pdf-lib remplace le flux d’origine puis ajoute le nouveau titre et l’adresse, avec les polices Bitstream Vera intégrées par fontkit. Il ne s’agit pas d’un rectangle blanc ni d’une reconstruction de la facture.

Le document final est rouvert avec PDF.js. Chaque texte hors du bloc modifié est comparé à l’original, avec sa position ; toute différence bloque le téléchargement. Le contenu extractible du bloc doit correspondre exactement au nouveau titre et aux lignes renseignées. La facturation peut contenir les mêmes coordonnées que l’ancienne livraison : elles sont volontairement conservées. **Le document n’est pas anonymisé.** Les ressources originales de polices restent intégrées ; cette application n’est pas un outil de purge de données forensique.

## Compatibilité

PDF A4 portrait textuel PrestaShop/TCPDF, un seul bloc de livraison et un bloc facturation à sa droite, flux de contenu unique par page, lignes TCPDF isolées en `BT x y Td [...] TJ ET`. Les scans, PDF protégés, rotations, formulaires/signatures, pièces jointes, annotations, flux partagés et structures ambiguës sont refusés. Une structure différente exige une adaptation et des tests avant usage.

Les sauts de ligne sont conservés. Taille automatique entre 10,5 et 8 points ; au-delà de la place disponible, une erreur invite à raccourcir l’adresse. Accents, apostrophes et caractères couverts par Bitstream Vera sont acceptés ; les autres alphabets nécessitent une transcription latine. Maximum 20 Mo, 18 lignes et 1 800 caractères.

## Bibliothèques

- pdf-lib **1.17.1** (MIT)
- PDF.js / pdfjs-dist **4.10.38** (Apache-2.0)
- @pdf-lib/fontkit **1.1.1** (MIT)
- Bitstream Vera / Vera Bold (licence dans `FONT-LICENSE.txt`)

Les versions directes sont exactes dans package.json. Le verrou complet est produit par l’installation et doit être conservé dans le dépôt. Les fichiers de production incluent toutes les bibliothèques et polices localement. Aucun CDN ni télémétrie à l’exécution. La politique CSP interdit les connexions à d’autres origines. Les seuls fetch applicatifs chargent les deux polices statiques sur la même origine.

## Maintenance

Node.js 22 : `npm ci`, puis `npm test` et `npm run build`. Servir `dist/` avec un serveur statique. Les fontes source sont en base64 pour permettre un transfert fiable ; le build les décode. Le verrou package-lock.json est conservé dans le dépôt.

`engine.js` contient la détection, le parseur restrictif et les vérifications ; `app.js` gère l’interface et le téléchargement. `preview.js` compare le rendu original et final, pixel par pixel hors du bloc de livraison, avant d’autoriser le téléchargement et de présenter un aperçu. Ne jamais ajouter de facture réelle aux tests ou au dépôt. Tester avec les factures privées localement et avec des documents synthétiques pour l’intégration continue.

Avant toute évolution du moteur : comparer visuellement original/résultat, vérifier les coordonnées extractibles uniquement dans le bloc livraison, comparer la facturation, les montants et l’ensemble des pixels hors du bloc. Tester une adresse courte, longue, accentuée et un document incompatible. Les tests unitaires seuls ne certifient pas un nouveau modèle de facture.

## GitHub Pages

Dans Settings → Pages, choisir **GitHub Actions**. Le workflow `.github/workflows/pages.yml` installe les dépendances verrouillées, exécute les tests, prépare `dist/` puis déploie. Tout push sur main relance ce processus. Si le verrou manque lors de la première installation, le workflow le crée et l’enregistre dans le dépôt.

Les factures restent uniquement en mémoire sur l’ordinateur. GitHub reçoit les requêtes de chargement des fichiers statiques, jamais les PDF ni les adresses. Fermer l’onglet efface l’état de travail.
