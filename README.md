# CRM Strasforma - Application de Gestion de la Relation Client

Une application CRM moderne inspirée de Pipedrive, construite avec React, Tailwind CSS et shadcn/ui.

## 🚀 Fonctionnalités

- **Système de Rôles :** Admin, Commercial, Prospecteur avec permissions granulaires.
- **Pipeline Kanban :** Gérez vos affaires par glisser-déposer.
- **Contacts Partagés :** Répertoire centralisé avec historique des interactions et import CSV.
- **Agenda Intelligent :** Vues Mois/Semaine/Liste et système de propositions de RDV entre prospecteurs et commerciaux.
- **Tableau d'Urgences :** Visualisez instantanément les actions prioritaires.
- **Persistance Locale :** Toutes les données sont sauvegardées dans votre navigateur via `localStorage`.

## 🛠️ Installation

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Lancez l'application en mode développement :
   ```bash
   npm run dev
   ```

3. Ouvrez votre navigateur à l'adresse indiquée par Vite (généralement `http://localhost:5173`).

## 👤 Utilisateurs de Démonstration (inclus)

- **Marie (Admin)** : Accès total.
- **Thomas (Commercial)** : Gère ses propres pipelines et son agenda (partagé).
- **Sophie (Prospecteur)** : Prospecte et propose des RDV aux commerciaux.
- **Lucas (Commercial)** : Gère ses affaires privées.

## 🏗️ Architecture

- `/src/context` : État global de l'application.
- `/src/components/pipeline` : Composants du tableau Kanban.
- `/src/components/agenda` : Gestion des tâches et du calendrier.
- `/src/components/contacts` : Liste et fiches détaillées des contacts.
- `/src/components/urgences` : Dashboard des actions prioritaires.
- `/src/lib` : Logique métier, permissions et données de démo.
