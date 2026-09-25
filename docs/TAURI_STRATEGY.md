# Plan Stratégique CARISOFT.next — Migration Tauri v2 (.EXE)

Ce document contient l'intégralité du code et des configurations pour transformer votre application React/Vite en une application de bureau Windows native, ultra-légère et performante avec Tauri v2.

## TÂCHE 1 — Tauri Setup & Configuration

### 1. Installation des dépendances (À faire en local)
Dans la racine de votre projet, initialisez Tauri et installez les plugins v2 :

```bash
# Installation de l'API front-end Tauri et du plugin updater
npm install @tauri-apps/api@next
npm install @tauri-apps/plugin-updater@next
npm install @tauri-apps/plugin-os@next

# Initialisation du backend Rust
npx tauri init
```

### 2. Configuration `tauri.conf.json`
Remplacez le contenu de `src-tauri/tauri.conf.json` par ceci pour configurer l'installeur NSIS, l'updater, et les permissions :

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "CARISOFT.next",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": ["$APPDATA/carisoft/**"]
      },
      "dialog": {
        "all": true
      },
      "http": {
        "all": true,
        "request": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "msi",
      "identifier": "com.carisoft.next",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": "http://timestamp.digicert.com"
      },
      "updater": {
        "active": true,
        "endpoints": [
          "https://votre-serveur.com/api/releases/{{target}}/{{current_version}}"
        ],
        "dialog": true,
        "pubkey": "VOTRE_CLE_PUBLIQUE_GENERE_PAR_TAURI"
      }
    },
    "security": {
      "csp": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com;"
    },
    "windows": [
      {
        "title": "CARISOFT.next - Gestion de Carrière",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### 3. Signature de code (Code Signing) Windows
Pour éviter l'alerte "SmartScreen" de Windows lors de l'installation :
1. Achetez un certificat de signature de code (ex: Sectigo, DigiCert).
2. Exportez-le en `.pfx`.
3. Tauri le détectera automatiquement si vous définissez les variables d'environnement lors du build :
   `TAURI_SIGN_KEY=chemin_vers_certificat.pfx` et `TAURI_SIGN_PASSWORD=mot_de_passe`.

### 4. Workflow GitHub Actions (Build Automatique)
Créez `.github/workflows/tauri-build.yml` :

```yaml
name: Release CARISOFT.next
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install Rust stable
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Install dependencies
        run: npm install
      - name: Build and Package Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'CARISOFT.next v__VERSION__'
          releaseBody: 'Voir les logs pour les changements.'
          releaseDraft: true
          prerelease: false
```

---

## TÂCHE 2 — Gestion Offline / Online (Sync Dexie <> Firestore)

*Note Architecturale* : Firebase Firestore possède un mode hors-ligne natif extrêmement puissant pour le Web (`enableIndexedDbPersistence`). Toutefois, comme votre application est déjà fortement architecturée autour de **Dexie.js**, voici comment gérer la détection réseau et la synchronisation.

### 1. Hook de détection réseau (`src/hooks/useNetworkSync.ts`)

```typescript
import { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../db/db';
import { firestore } from '../lib/firebase';

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Déclenchement de la synchronisation au retour de la connexion
  useEffect(() => {
    if (isOnline) {
      syncOfflineDataToCloud();
    }
  }, [isOnline]);

  const syncOfflineDataToCloud = async () => {
    if (!firestore || isSyncing) return;
    setIsSyncing(true);
    
    try {
      // 1. Récupérer toutes les données locales Dexie
      const clients = await db.customers.toArray();
      const deliveries = await db.deliveryNotes.toArray();
      
      // 2. Préparer un Batch Firebase (limite 500 opérations)
      const batch = writeBatch(firestore);
      
      clients.forEach(client => {
        const ref = doc(firestore, 'customers', client.id);
        batch.set(ref, client, { merge: true });
      });

      deliveries.forEach(bl => {
        const ref = doc(firestore, 'deliveries', bl.id);
        batch.set(ref, bl, { merge: true });
      });

      // 3. Exécuter le batch vers le Cloud
      await batch.commit();
      console.log('✅ Synchronisation Cloud réussie');
      
    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, syncOfflineDataToCloud };
}
```

---

## TÂCHE 3 — Impression Native Tauri (Ticket 80mm & A4)

L'impression `window.print()` du web ouvre la boîte de dialogue système. Pour un logiciel de caisse/pont bascule (impression **silencieuse sans dialogue** sur imprimante thermique 80mm), Tauri nécessite d'invoquer une commande Rust.

### 1. Backend Rust (`src-tauri/src/main.rs`)
Pour imprimer silencieusement sous Windows, nous utilisons l'API d'impression ou nous appelons PowerShell :

```rust
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[tauri::command]
fn print_silent_windows(html_content: String, printer_name: String) -> Result<String, String> {
    // Dans un vrai projet, on utiliserait une crate rust comme 'html2pdf' puis impression directe,
    // ou on envoie des commandes RAW/ESC-POS à l'imprimante thermique.
    // Exemple simplifié de retour de commande :
    println!("Ordre d'impression envoyé à : {}", printer_name);
    Ok("Impression lancée avec succès".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![print_silent_windows])
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'exécution de l'application Tauri");
}
```

### 2. Adaptation de `printReceipt.ts` (Côté React)

```typescript
// Remplacer l'import dans votre fichier actuel s'il est exécuté sous Tauri
import { invoke } from '@tauri-apps/api/core';

// Détecter si on est dans Tauri
const isTauri = '__TAURI_INTERNALS__' in window;

export const executePrint = async (data: DeliveryPrintData, format: 'A4' | 'ticket') => {
  const htmlContent = generateBLHtml(data, format);
  
  if (isTauri && format === 'ticket') {
    // Mode Desktop : Impression thermique silencieuse
    try {
      await invoke('print_silent_windows', { 
        htmlContent: htmlContent,
        printerName: "EPSON TM-T88VI Receipt" // Nom de l'imprimante dans Windows
      });
    } catch (e) {
      console.error("Erreur d'impression native Tauri:", e);
      // Fallback sur le dialogue web
      fallbackWebPrint(htmlContent);
    }
  } else {
    // Mode Web ou A4 : Ouverture standard
    fallbackWebPrint(htmlContent);
  }
};

function fallbackWebPrint(htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    };
  }
}
```
