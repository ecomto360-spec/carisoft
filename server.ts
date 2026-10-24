import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Firebase Admin
  const adminApp: any = admin;
  if (!adminApp.apps?.length && !adminApp.getApps?.()?.length) {
    try {
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        adminApp.initializeApp({
          credential: adminApp.credential?.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        console.log("Firebase Admin initialized successfully.");
      } else {
        console.warn("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY. Admin SDK not initialized.");
      }
    } catch (e) {
      console.error("Failed to initialize Firebase Admin:", e);
    }
  }

  // API Route: Create User
  app.post("/api/users", async (req, res) => {
    try {
      const { email, password, displayName, disabled } = req.body;
      const isInit = adminApp.apps?.length || adminApp.getApps?.()?.length;
      if (!isInit) {
        return res.status(500).json({ error: "Firebase Admin SDK non configuré (vérifiez les variables d'environnement)." });
      }

      const auth = adminApp.auth();
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        disabled
      });

      res.json({ uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // API Route: Update User
  app.put("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const { email, password, displayName, disabled } = req.body;
      const isInit = adminApp.apps?.length || adminApp.getApps?.()?.length;
      if (!isInit) {
        return res.status(500).json({ error: "Firebase Admin SDK non configuré." });
      }

      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (displayName) updateData.displayName = displayName;
      if (disabled !== undefined) updateData.disabled = disabled;

      const auth = adminApp.auth();
      const userRecord = await auth.updateUser(uid, updateData);
      res.json({ uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // API Route: Activate License (Serverless & Express integration)
  app.post("/api/activate-license", async (req, res) => {
    try {
      const activateHandler = (await import("./api/activate-license.js")).default || (await import("./api/activate-license.ts")).default;
      await activateHandler(req, res);
    } catch (err: any) {
      console.error("Error invoking activate-license handler:", err);
      res.status(500).json({ error: err.message || "Erreur activation licence" });
    }
  });

  // API Route: Check License (Revocation check)
  app.post("/api/check-license", async (req, res) => {
    try {
      const checkHandler = (await import("./api/check-license.js")).default || (await import("./api/check-license.ts")).default;
      await checkHandler(req, res);
    } catch (err: any) {
      console.error("Error invoking check-license handler:", err);
      res.status(500).json({ error: err.message || "Erreur vérification licence" });
    }
  });

  // API Route: Generate Keys
  app.post("/api/generate-keys", async (req, res) => {
    try {
      const genHandler = (await import("./api/generate-keys.js")).default || (await import("./api/generate-keys.ts")).default;
      await genHandler(req, res);
    } catch (err: any) {
      console.error("Error invoking generate-keys handler:", err);
      res.status(500).json({ error: err.message || "Erreur génération clés" });
    }
  });

  // API Route: Admin Licenses
  app.post("/api/admin-licenses", async (req, res) => {
    try {
      const adminLicensesHandler = (await import("./api/admin-licenses.js")).default || (await import("./api/admin-licenses.ts")).default;
      await adminLicensesHandler(req, res);
    } catch (err: any) {
      console.error("Error invoking admin-licenses handler:", err);
      res.status(500).json({ error: err.message || "Erreur admin-licenses" });
    }
  });

  // API Route: Revoke Key
  app.post("/api/revoke-key", async (req, res) => {
    try {
      const revokeHandler = (await import("./api/revoke-key.js")).default || (await import("./api/revoke-key.ts")).default;
      await revokeHandler(req, res);
    } catch (err: any) {
      console.error("Error invoking revoke-key handler:", err);
      res.status(500).json({ error: err.message || "Erreur révocation clé" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
        hmr: false
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
