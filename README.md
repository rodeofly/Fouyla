# 🌍 Fouyla - Moteur Voxel Web

> Un mini-monde voxel procédural tournant entièrement dans le navigateur avec Three.js et Cannon-es.

[![Démo en ligne](https://img.shields.io/badge/🎮_Essayer_la_Démo-Cliquez_ici-success?style=for-the-badge&logo=html5)](https://rodeofly.github.io/Fouyla/)

![Capture d'écran du jeu](https://github.com/rodeofly/Fouyla/blob/main/screenshot1.png)

---

## 📖 À propos

**Fouyla** est un prototype de moteur de jeu de type "sandbox" (bac à sable) inspiré de Minecraft. Il a été conçu pour être **léger**, **performant** et **pédagogique**.

L'objectif est de démontrer comment créer un monde 3D infini (ou presque), gérer la physique, les collisions et les interactions joueur, le tout sans moteur de jeu lourd comme Unity ou Unreal, juste avec du JavaScript moderne.

### ✨ Fonctionnalités Clés

* **Génération Procédurale** : Terrain unique à chaque fois grâce au bruit de Perlin (Simplex Noise). Biomes variés (Plaines, Forêts, Montagnes).
* **Moteur Physique Réel** : Utilisation de `cannon-es` pour une physique robuste (collisions, gravité, poussée).
* **Système de "Bulle Physique"** : Optimisation majeure qui ne calcule la physique qu'autour du joueur pour permettre des mondes immenses sans lag.
* **Interaction Complète** :
    * ⛏️ **Miner** (Clic Gauche) et **Poser** (Clic Droit) des blocs.
    * 🎒 **Inventaire** et **Crafting** basique (Touche `E`).
    * 🔦 **Lampe torche** (Touche `F`) et **Accroupissement** (Touche `C`).
* **Mobs Intelligents** : Des cochons cubiques qui évitent l'eau, sautent les obstacles et flottent !
* **Cycle Jour/Nuit** : Ambiance dynamique modifiable en temps réel.

---

## 🚀 Comment l'utiliser ?

### 1. Tester directement
Pas besoin d'installation, le jeu tourne dans votre navigateur :
👉 **[Lancer la Démo](https://rodeofly.github.io/Fouyla/)**

### 2. Installation Locale (Pour les développeurs)

Si vous souhaitez modifier le code, vous devez le faire tourner sur un serveur local (à cause des modules ES6).

1.  **Cloner le projet** (ou télécharger le ZIP) :
    ```bash
    git clone [https://github.com/rodeofly/Fouyla.git](https://github.com/rodeofly/Fouyla.git)
    cd Fouyla
    ```

2.  **Lancer un serveur local** :
    * Si vous avez **Python** : `python -m http.server`
    * Si vous avez **Node.js** : `npx serve`
    * Ou via l'extension **Live Server** de VS Code.

3.  Ouvrez `http://localhost:8000` (ou le port indiqué) dans votre navigateur.

---

## 🎮 Contrôles

| Action | Touche / Souris |
| :--- | :--- |
| **Se déplacer** | `Z` `Q` `S` `D` |
| **Sauter** | `Espace` |
| **Courir** | `Maj` (Shift) |
| **S'accroupir** | `C` |
| **Lampe Torche** | `F` |
| **Miner / Attaquer** | `Clic Gauche` |
| **Poser un bloc** | `Clic Droit` |
| **Changer d'objet** | `Molette` ou `1-5` |
| **Inventaire / Craft**| `E` |
| **Menu / Pause** | `Echap` |
| **Respawn** | `R` |

---

## 🛠️ Architecture Technique

Le projet est découpé en modules ES6 clairs pour faciliter la lecture et la maintenance.

### Arborescence des fichiers

```text
/
├── index.html       # Point d'entrée, interface HTML (Menu, HUD)
├── styles.css       # Styles de l'interface
└── src/
    ├── main.js      # Chef d'orchestre : Boucle de jeu, Gestion des événements
    ├── World.js     # Génération du terrain, Mèches 3D, Gestion des blocs
    ├── Physics.js   # Wrapper pour Cannon-es, gestion des collisions
    ├── Player.js    # Contrôleur du joueur, Mouvements, Caméra
    ├── Mobs.js      # Gestion des entités (Cochons), IA simple
    ├── UI.js        # Gestion de l'inventaire et du HUD
    └── Constants.js # Configuration globale (IDs des blocs, recettes, gravité...)