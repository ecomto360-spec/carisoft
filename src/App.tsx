/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/auth/LoginPage';
import { DemoLoginPage } from './pages/auth/DemoLoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { SetupCompanyPage } from './pages/auth/SetupCompanyPage';
import { useAuthStore } from './store/authStore';
import { PrintDeliveryPage } from './pages/deliveries/PrintDeliveryPage';
import { SuperAdminPanel } from './pages/admin/SuperAdminPanel';
import { 
  Clients, Products, Logistics, Orders, 
  Deliveries, Invoices, Payments, Reports, 
  Users, Settings, Maintenance 
} from './pages/Placeholders';
import { AlertCircle } from 'lucide-react';
import { firestore } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { TrialBanner } from './components/TrialBanner';

function UserSyncManager() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const syncUserProfile = async () => {
      try {
        let foundData: any = null;

        // 1. Try by user.id if present
        if (user.id) {
          const userDocRef = doc(firestore, 'users', user.id);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            foundData = snap.data();
          } else if (user.companyId) {
            // Repair missing user document in Firestore (due to previous rule error)
            try {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userDocRef, {
                companyId: user.companyId,
                email: user.email,
                name: user.name,
                role: user.role,
                active: user.active,
                createdAt: new Date().toISOString()
              }, { merge: true });
              foundData = user;
            } catch (e) {
              console.error("Failed to repair missing user doc in Firestore", e);
            }
          }
        }

        // 2. If not found by ID, try query by email
        if (!foundData && user.email) {
          const q = query(collection(firestore, 'users'), where('email', '==', user.email.toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            foundData = snap.docs[0].data();
          }
        }

        // 3. Try query by username
        if (!foundData && user.username) {
          const q = query(collection(firestore, 'users'), where('username', '==', user.username.toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            foundData = snap.docs[0].data();
          }
        }

        if (foundData && isMounted) {
          const newName = foundData.name || foundData.username;
          if (
            (newName && newName !== user.name) ||
            (foundData.username && foundData.username !== user.username) ||
            (foundData.role && foundData.role !== user.role) ||
            (foundData.companyId && foundData.companyId !== user.companyId)
          ) {
            useAuthStore.getState().updateUser({
              name: newName,
              username: foundData.username || user.username,
              role: foundData.role || user.role,
              companyId: foundData.companyId || user.companyId
            });
          }
        }
      } catch (err) {
        console.warn("User sync error:", err);
      }
    };

    syncUserProfile();

    // Re-sync on window focus
    const handleFocus = () => syncUserProfile();
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, user?.email, user?.username]);

  return null;
}

function FirebaseStatusBanner() {
  const [isFirebaseDown, setIsFirebaseDown] = useState(false);

  useEffect(() => {
    // Basic connectivity check: attempt to read a system check document
    const checkFirebase = async () => {
      try {
        const dummyRef = doc(firestore, '_system_check', 'ping');
        await Promise.race([
          getDoc(dummyRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000))
        ]);
        setIsFirebaseDown(false);
      } catch (err: any) {
        // If it's permission-denied or document not found, backend is reachable
        if (err.code === 'permission-denied' || err.code === 'not-found') {
          setIsFirebaseDown(false);
          return;
        }
        if (err.message && (err.message.includes("Database '(default)' not found") || err.message === "timeout" || err.message.includes("the client is offline"))) {
          setIsFirebaseDown(true);
        }
      }
    };
    checkFirebase();
  }, []);

  if (!isFirebaseDown) return null;

  return (
    <div className="bg-amber-900/90 text-amber-100 px-4 py-2 text-sm flex items-center justify-center gap-2 z-50 relative">
      <AlertCircle className="h-4 w-4 text-amber-400" />
      <span>
        Attention : Base de données Cloud indisponible. L'application fonctionne en mode hors-ligne local (Dexie).
      </span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Handle multi-tenant redirection
  const isSetupRoute = location.pathname === '/setup';
  if (!user?.companyId && !isSetupRoute) {
    return <Navigate to="/setup" replace />;
  }
  
  if (user?.companyId && isSetupRoute) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Router>
      <UserSyncManager />
      <FirebaseStatusBanner />
      <TrialBanner />
      <Routes>
        <Route 
          path="/demo" 
          element={<DemoLoginPage />} 
        />
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
        />
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} 
        />
        <Route 
          path="/forgot-password" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />} 
        />
        <Route 
          path="/reset-password" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPasswordPage />} 
        />
        
        <Route 
          path="/setup" 
          element={
            <ProtectedRoute>
              <SetupCompanyPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/superadmin" 
          element={
            <ProtectedRoute>
              <SuperAdminPanel />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/print/bl/:id" 
          element={
            <ProtectedRoute>
              <PrintDeliveryPage />
            </ProtectedRoute>
          } 
        />

        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients/*" element={<Clients />} />
          <Route path="products/*" element={<Products />} />
          <Route path="logistics/*" element={<Logistics />} />
          <Route path="orders/*" element={<Orders />} />
          <Route path="deliveries/*" element={<Deliveries />} />
          <Route path="invoices/*" element={<Invoices />} />
          <Route path="payments/*" element={<Payments />} />
          <Route path="reports/*" element={<Reports />} />
          <Route path="users/*" element={<Users />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="maintenance/*" element={<Maintenance />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
