import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { firestore, auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../db/db';
import { 
  Shield, Key, Copy, CheckCircle, AlertTriangle, Users, 
  Search, Phone, Mail, Calendar, Clock, Edit3, Trash2, 
  PlusCircle, RefreshCw, Check, Building, MapPin, Sparkles, Filter, X,
  Laptop, Ban
} from 'lucide-react';
import { EditCompanyModal } from './EditCompanyModal';

const SA_EMAILS = new Set(['nabsterzero@gmail.com', 'superadmin-console@carisoft.com']);
async function getSuperAdminIdToken(force = false): Promise<string> {
  if (typeof (auth as any).authStateReady === 'function') {
    try { await (auth as any).authStateReady(); } catch {}
  }
  if (auth.currentUser && SA_EMAILS.has((auth.currentUser.email || '').toLowerCase())) {
    return await auth.currentUser.getIdToken(force);
  }
  const u = useAuthStore.getState().user;
  const ok = Boolean(u?.role === 'superadmin' || u?.email?.toLowerCase() === 'nabsterzero@gmail.com' || u?.username?.toLowerCase() === 'nabsterzero');
  if (!ok) throw new Error('Session SuperAdmin requise.');
  const em = 'superadmin-console@carisoft.com';
  const pw = 'Carisoft#SuperAdmin!2026';
  try {
    const c = await signInWithEmailAndPassword(auth, em, pw);
    return await c.user.getIdToken(true);
  } catch (e: any) {
    const code = e?.code || '';
    if (code.includes('user-not-found') || code.includes('invalid-credential') || code.includes('invalid-login')) {
      const c = await createUserWithEmailAndPassword(auth, em, pw);
      return await c.user.getIdToken(true);
    }
    throw new Error('Connexion Cloud impossible (' + (code || e?.message) + ')');
  }
}

async function callLicenseAdmin(action: string, _idToken: string, params: any) {
  let tok = _idToken || (await getSuperAdminIdToken(false));
  const send = async (t: string) => {
    const response = await fetch('https://carisoft.vercel.app/api/admin-licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action, ...params })
    });
    const txt = await response.text();
    let data: any;
    try { data = JSON.parse(txt); } catch {
      throw new Error('Serveur HTTP ' + response.status + ': ' + txt.slice(0, 120));
    }
    return { response, data };
  };
  let { response, data } = await send(tok);
  if (response.status === 401 || response.status === 403) {
    tok = await getSuperAdminIdToken(true);
    ({ response, data } = await send(tok));
  }
  if (!response.ok || !data.success) {
    throw new Error(data.error || ('Erreur HTTP ' + response.status));
  }
  return data;
}

export function SuperAdminPanel() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [activationRequests, setActivationRequests] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'customers' | 'licenses' | 'requests'>('customers');
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string; key?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // States pour la gestion des Licences
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genTenantId, setGenTenantId] = useState('');
  const [genDurationDays, setGenDurationDays] = useState(30);
  const [genMaxMachines, setGenMaxMachines] = useState(1);
  const [isGeneratingLicense, setIsGeneratingLicense] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [licenseSearchQuery, setLicenseSearchQuery] = useState('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'all' | 'unused' | 'active' | 'expired' | 'revoked'>('all');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchRequests(), fetchLicenses()]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCustomers(), fetchRequests(), fetchLicenses()]);
    setRefreshing(false);
  };

  const fetchLicenses = async () => {
    try {
      setLoadingLicenses(true);
      const idToken = await getSuperAdminIdToken();
      const result = await callLicenseAdmin("list", idToken, {});
      if (result.success && result.licenses) {
        const data = result.licenses;
        data.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setLicenses(data);
      }
    } catch (error) {
      console.warn("Erreur lecture licenses via admin API:", error);
    } finally {
      setLoadingLicenses(false);
    }
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTenantId.trim()) {
      setNotification({ type: 'error', message: 'Veuillez spécifier un identifiant entreprise (tenantId).' });
      return;
    }

    try {
      setIsGeneratingLicense(true);
      const duration = Number(genDurationDays) || 30;

      const idToken = await getSuperAdminIdToken();

      const result = await callLicenseAdmin("create", idToken, {
        durationDays: duration,
        tenantId: genTenantId.trim(),
        maxMachines: 1
      });

      const newKey = result.key;
      setNewlyGeneratedKey(newKey); try { await navigator.clipboard.writeText(newKey); } catch {}
      await fetchLicenses();
      setNotification({
        type: 'success',
        message: `Licence ${newKey} (${duration} jours) générée avec succès pour ${genTenantId.trim()} !`,
        key: newKey
      });
    } catch (err: any) {
      console.error("Erreur génération licence:", err);
      setNotification({
        type: 'error',
        message: err.message || "Erreur lors de la génération de la licence."
      });
    } finally {
      setIsGeneratingLicense(false);
    }
  };

  const handleRevokeLicense = async (licenseKey: string) => {
    if (!window.confirm(`Confirmez-vous la révocation immédiate de la licence ${licenseKey} ? L'accès sera bloqué sur le poste concerné.`)) {
      return;
    }

    try {
      const idToken = await getSuperAdminIdToken();

      await callLicenseAdmin("revoke", idToken, { key: licenseKey });

      await fetchLicenses();
      setNotification({
        type: 'info',
        message: `La licence ${licenseKey} a été révoquée.`
      });
    } catch (err: any) {
      console.error("Erreur révocation licence:", err);
      setNotification({
        type: 'error',
        message: err.message || "Impossible de révoquer la licence."
      });
    }
  };

  const fetchRequests = async () => {
    try {
      const idToken = await getSuperAdminIdToken();
      const res = await callLicenseAdmin('list_requests', idToken, {});
      const data: any[] = Array.isArray(res.requests) ? res.requests : [];
      data.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
      });
      setActivationRequests(data);
    } catch (error) {
      console.warn("Erreur lecture demandes:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const consolidated: Map<string, any> = new Map();

      // 1. Fetch from Firestore 'companies'
      try {
        const compQuery = query(collection(firestore, 'companies'));
        const compSnap = await getDocs(compQuery);
        compSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          const email = (d.ownerEmail || d.email || '').trim().toLowerCase();
          const key = email || docSnap.id;
          consolidated.set(key, {
            uid: docSnap.id,
            id: docSnap.id,
            name: d.name || d.nom || 'Sans nom',
            contactName: d.contactName || d.ownerName || '',
            ownerEmail: d.ownerEmail || d.email || '',
            email: d.email || d.ownerEmail || '',
            phone: d.phone || d.telephone || '',
            address: d.address || d.wilaya || '',
            licensePlan: d.licensePlan || 'PRO 1 An',
            licenseStatus: d.licenseStatus || d.status || 'actif',
            status: d.status || d.licenseStatus || 'actif',
            licenseExpiry: d.licenseExpiry || '',
            licenseKey: d.licenseKey || (Array.isArray(d.licenseKeys) && d.licenseKeys[0]) || '',
            createdAt: d.createdAt || null,
            source: 'cloud'
          });
        });
      } catch (err) {
        console.warn("Erreur lecture Firestore companies:", err);
      }

      // 2. Fetch from Firestore 'users' to catch any account without company doc
      try {
        const usersQuery = query(collection(firestore, 'users'));
        const usersSnap = await getDocs(usersQuery);
        usersSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          const email = (d.email || '').trim().toLowerCase();
          if (email && !consolidated.has(email)) {
            consolidated.set(email, {
              uid: docSnap.id,
              id: docSnap.id,
              name: d.name || email.split('@')[0].toUpperCase(),
              contactName: d.name || '',
              ownerEmail: email,
              email: email,
              phone: d.phone || '',
              address: '',
              licensePlan: 'Essai Gratuit',
              licenseStatus: 'essai',
              status: 'essai',
              licenseExpiry: '',
              licenseKey: '',
              createdAt: d.createdAt || null,
              source: 'cloud'
            });
          }
        });
      } catch (err) {
        console.warn("Erreur lecture Firestore users:", err);
      }

      // 3. Fetch from local Dexie db.users
      try {
        const localUsers = await db.users.toArray();
        const settings = await db.settings.get(1);
        localUsers.forEach(u => {
          const email = (u.email || '').trim().toLowerCase();
          if (email) {
            if (!consolidated.has(email)) {
              consolidated.set(email, {
                uid: u.id,
                id: u.id,
                name: settings?.name || u.name || 'Entreprise Locale',
                contactName: u.name || '',
                ownerEmail: email,
                email: email,
                phone: settings?.phone || '',
                address: settings?.address || '',
                licensePlan: settings?.licensePlan || 'Essai Gratuit',
                licenseStatus: settings?.licenseStatus || 'actif',
                status: 'actif',
                licenseExpiry: settings?.licenseExpiry || '',
                licenseKey: settings?.licenseKey || '',
                createdAt: u.createdAt || null,
                source: 'local'
              });
            } else {
              // Enhance existing with contact info if missing
              const existing = consolidated.get(email);
              if (!existing.phone && settings?.phone) existing.phone = settings.phone;
              if (!existing.contactName && u.name) existing.contactName = u.name;
              if (!existing.address && settings?.address) existing.address = settings.address;
            }
          }
        });
      } catch (err) {
        console.warn("Erreur lecture Dexie:", err);
      }

      // 4. Fetch from LocalStorage IP trial logs
      try {
        const rawTrials = localStorage.getItem('carisoft_registered_trial_ips_v2');
        if (rawTrials) {
          const trialList = JSON.parse(rawTrials);
          if (Array.isArray(trialList)) {
            trialList.forEach((t: any) => {
              const email = (t.email || '').trim().toLowerCase();
              if (email && !consolidated.has(email)) {
                consolidated.set(email, {
                  uid: 'trial_' + (t.ip || Math.random()).toString(),
                  id: 'trial_' + (t.ip || Math.random()).toString(),
                  name: t.company || 'Compte Essai',
                  contactName: '',
                  ownerEmail: email,
                  email: email,
                  phone: '',
                  address: t.ip ? `IP: ${t.ip}` : '',
                  licensePlan: 'Essai Gratuit (30 Jours)',
                  licenseStatus: 'essai',
                  status: 'essai',
                  licenseExpiry: '',
                  licenseKey: t.licenseKey || '',
                  createdAt: t.createdAt || null,
                  source: 'trial'
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Erreur lecture trial logs:", err);
      }

      // Sort by creation date descending
      const list = Array.from(consolidated.values()).sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setCustomers(list);
    } catch (error) {
      console.warn("Erreur lecture clients:", error);
    }
  };

  // Delete customer execution
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    const target = customerToDelete;
    const docId = target.uid || target.id;
    const targetEmail = (target.ownerEmail || target.email || '').trim().toLowerCase();
    const targetName = target.name || targetEmail || 'ce client';

    try {
      // 1. Delete from Firestore companies by docId
      if (docId && !docId.startsWith('trial_')) {
        try {
          await deleteDoc(doc(firestore, 'companies', docId));
        } catch (e) {
          console.warn("Suppression Firestore company par id:", e);
        }
        try {
          await deleteDoc(doc(firestore, 'users', docId));
        } catch (e) {
          console.warn("Suppression Firestore user par id:", e);
        }
      }

      // 2. Query & delete Firestore companies matching email or ownerEmail
      if (targetEmail) {
        try {
          const compQ1 = query(collection(firestore, 'companies'), where('email', '==', targetEmail));
          const snap1 = await getDocs(compQ1);
          for (const d of snap1.docs) {
            await deleteDoc(doc(firestore, 'companies', d.id));
          }

          const compQ2 = query(collection(firestore, 'companies'), where('ownerEmail', '==', targetEmail));
          const snap2 = await getDocs(compQ2);
          for (const d of snap2.docs) {
            await deleteDoc(doc(firestore, 'companies', d.id));
          }
        } catch (e) {
          console.warn("Suppression Firestore companies query:", e);
        }

        // 3. Query & delete Firestore users matching email
        try {
          const userQ = query(collection(firestore, 'users'), where('email', '==', targetEmail));
          const snapU = await getDocs(userQ);
          for (const d of snapU.docs) {
            await deleteDoc(doc(firestore, 'users', d.id));
          }
        } catch (e) {
          console.warn("Suppression Firestore users query:", e);
        }

        // 4. Query & delete username_mappings
        try {
          const mapQ = query(collection(firestore, 'username_mappings'), where('email', '==', targetEmail));
          const snapM = await getDocs(mapQ);
          for (const d of snapM.docs) {
            await deleteDoc(doc(firestore, 'username_mappings', d.id));
          }
        } catch (e) {
          console.warn("Suppression username_mappings query:", e);
        }

        // 5. Delete from Dexie db.users
        try {
          const localUsers = await db.users.where('email').equalsIgnoreCase(targetEmail).toArray();
          for (const u of localUsers) {
            if (u.role !== 'superadmin') {
              await db.users.delete(u.id);
            }
          }
        } catch (dexieErr) {
          console.warn("Suppression Dexie:", dexieErr);
        }

        // 6. Delete from localStorage trial IPs
        try {
          const rawTrials = localStorage.getItem('carisoft_registered_trial_ips_v2');
          if (rawTrials) {
            const trialList = JSON.parse(rawTrials);
            if (Array.isArray(trialList)) {
              const updated = trialList.filter((t: any) => {
                const tEmail = (t.email || '').trim().toLowerCase();
                return tEmail !== targetEmail && t.company !== target.name;
              });
              localStorage.setItem('carisoft_registered_trial_ips_v2', JSON.stringify(updated));
            }
          }
        } catch (lsErr) {
          console.warn("Nettoyage LocalStorage:", lsErr);
        }
      }

      // 7. Optimistic UI update
      setCustomers(prev => prev.filter(c => {
        const cId = c.uid || c.id;
        const cEmail = (c.ownerEmail || c.email || '').trim().toLowerCase();
        if (docId && cId === docId) return false;
        if (targetEmail && cEmail === targetEmail) return false;
        return true;
      }));

      setCustomerToDelete(null);
      setNotification({
        type: 'success',
        message: `Le client "${targetName}" (${targetEmail || 'Compte'}) a été supprimé définitivement.`
      });

      // Background refresh
      fetchCustomers();
    } catch (error) {
      console.error("Erreur suppression client:", error);
      setNotification({
        type: 'error',
        message: "Une erreur est survenue lors de la suppression."
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick Extend License
  const handleQuickExtend = async (customer: any, monthsToAdd: number) => {
    setGeneratingKey(customer.uid);
    try {
      const idToken = await getSuperAdminIdToken();
      const docId = customer.uid || customer.id;

      let keyToUse = customer.licenseKey;
      let newExpiryDate: string;

      if (keyToUse) {
        const res = await callLicenseAdmin("extend", idToken, {
          key: keyToUse,
          extendDays: monthsToAdd * 30
        });
        newExpiryDate = res.license?.expiresAt || new Date(Date.now() + monthsToAdd * 30 * 86400000).toISOString();
      } else {
        const res = await callLicenseAdmin("create", idToken, {
          durationDays: monthsToAdd * 30,
          tenantId: docId || customer.email || 'customer'
        });
        keyToUse = res.key;
        newExpiryDate = res.license?.expiresAt || new Date(Date.now() + monthsToAdd * 30 * 86400000).toISOString();
      }

      if (docId) {
        const companyRef = doc(firestore, 'companies', docId);
        await setDoc(companyRef, {
          licenseExpiry: newExpiryDate,
          licenseKey: keyToUse,
          licensePlan: monthsToAdd >= 12 ? 'PRO Annuel (1 An)' : `PRO (${monthsToAdd} Mois)`,
          licenseStatus: 'active',
          status: 'actif',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Also copy key
      try {
        await navigator.clipboard.writeText(keyToUse);
      } catch (e) {
        console.warn("Presse-papier:", e);
      }
      setNotification({
        type: 'success',
        message: `Licence prolongée de ${monthsToAdd} mois pour ${customer.name || customer.email} ! Clé officielle Firestore :`,
        key: keyToUse
      });
      await Promise.all([fetchCustomers(), fetchLicenses()]);
    } catch (error: any) {
      console.warn("Erreur prolongation:", error);
      setNotification({
        type: 'error',
        message: error?.message || "Erreur lors de la prolongation de la licence."
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  // Handle request approval
  const handleGenerateAndSendRequest = async (request: any, months: number) => {
    setGeneratingKey(request.id);
    try {
      const idToken = await getSuperAdminIdToken();

      const tenantId = request.companyId || request.email || request.nom || 'customer';
      const res = await callLicenseAdmin("create", idToken, {
        durationDays: months * 30,
        tenantId
      });
      const newKey = res.key;
      const expiryDate = res.license?.expiresAt || new Date(Date.now() + months * 30 * 86400000).toISOString();

      // Update request status
      const requestRef = doc(firestore, 'activationRequests', request.id);
      await updateDoc(requestRef, {
        status: 'processed',
        licenseKey: newKey,
        processedAt: new Date().toISOString()
      });

      // Also create company record so it appears in Parc Clients immediately
      const newCompanyRef = doc(collection(firestore, 'companies'));
      await setDoc(newCompanyRef, {
        name: (request.nom || 'ENTREPRISE').toUpperCase(),
        email: request.email?.toLowerCase(),
        ownerEmail: request.email?.toLowerCase(),
        phone: request.telephone || '',
        address: `${request.commune || ''} ${request.wilaya || ''}`.trim(),
        licenseKey: newKey,
        licensePlan: request.plan || `PRO ${months} Mois`,
        licenseStatus: 'active',
        status: 'actif',
        licenseExpiry: expiryDate,
        createdAt: new Date().toISOString()
      }, { merge: true });

      try {
        await navigator.clipboard.writeText(newKey);
      } catch (e) {
        console.warn("Presse-papier:", e);
      }

      setNotification({
        type: 'success',
        message: `Licence ${months} mois créée dans Firestore pour ${request.nom} ! Clé copiée :`,
        key: newKey
      });
      await Promise.all([fetchRequests(), fetchCustomers(), fetchLicenses()]);
    } catch (error: any) {
      console.warn("Erreur approbation demande:", error);
      setNotification({
        type: 'error',
        message: error?.message || "Erreur lors de la génération de la licence."
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  // Helper to calculate days remaining
  const getRemainingDays = (customer: any) => {
    if (!customer.licenseExpiry) return null;
    try {
      const expTime = new Date(customer.licenseExpiry).getTime();
      if (isNaN(expTime)) return null;
      return Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // Helper to format date
  const formatDate = (val: any) => {
    if (!val) return 'Date non renseignée';
    try {
      const date = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(date.getTime())) return String(val);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, type: 'key' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      setCopiedEmail(text);
      setTimeout(() => setCopiedEmail(null), 2000);
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Search query match
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.ownerEmail && c.ownerEmail.toLowerCase().includes(query)) ||
        (c.phone && c.phone.includes(query)) ||
        (c.contactName && c.contactName.toLowerCase().includes(query)) ||
        (c.licenseKey && c.licenseKey.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Status filter
      const days = getRemainingDays(c);
      if (statusFilter === 'active') {
        return (days !== null && days > 0) || c.status === 'actif' || c.licenseStatus === 'active';
      }
      if (statusFilter === 'trial') {
        return c.status === 'essai' || c.licenseStatus === 'trial' || (c.licensePlan && c.licensePlan.toLowerCase().includes('essai'));
      }
      if (statusFilter === 'expired') {
        return (days !== null && days <= 0) || c.status === 'expire' || c.licenseStatus === 'expired';
      }

      return true;
    });
  }, [customers, searchQuery, statusFilter]);

  // Metric counts
  const stats = useMemo(() => {
    let active = 0;
    let trial = 0;
    let expired = 0;

    customers.forEach(c => {
      const days = getRemainingDays(c);
      if (days !== null && days <= 0) {
        expired++;
      } else if (c.status === 'essai' || (c.licensePlan && c.licensePlan.toLowerCase().includes('essai'))) {
        trial++;
      } else {
        active++;
      }
    });

    return { total: customers.length, active, trial, expired };
  }, [customers]);

  // Filtered licenses for the Licenses tab
  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      const q = licenseSearchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        lic.key?.toLowerCase().includes(q) || 
        lic.tenantId?.toLowerCase().includes(q) || 
        lic.machineId?.toLowerCase().includes(q);

      const matchStatus = licenseStatusFilter === 'all' || lic.status === licenseStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [licenses, licenseSearchQuery, licenseStatusFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Console SuperAdmin</h1>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Éditeur SaaS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Supervision des comptes inscrits, coordonnées, durées de licence & gestion clients
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
        </button>
      </div>

      {/* In-app Notification / Feedback Banner */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-200 shadow-lg ${
          notification.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
            : notification.type === 'error'
            ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            : 'bg-blue-950/80 border-blue-500/40 text-blue-200'
        }`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
            {notification.key && (
              <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                <code className="font-mono text-amber-300 select-all text-xs">
                  {notification.key}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(notification.key!, 'key')}
                  className="p-1 hover:text-white text-slate-400 cursor-pointer"
                  title="Copier la clé"
                >
                  {copiedKey === notification.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Total Inscrits</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Emails enregistrés dans le système</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Licences Actives</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{stats.active}</p>
          <p className="text-[11px] text-slate-500 mt-1">Accès clients opérationnels</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Période d'Essai</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{stats.trial}</p>
          <p className="text-[11px] text-slate-500 mt-1">Évaluations 5 jours en cours</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Expirés / En alerte</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{stats.expired}</p>
          <p className="text-[11px] text-slate-500 mt-1">Licence échue ou bloquée</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2.5 font-semibold text-sm transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'customers' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Parc Clients & Inscrits ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-4 py-2.5 font-semibold text-sm transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'licenses' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Licences ({licenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 font-semibold text-sm transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'requests' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <span>Demandes d'activation</span>
          {activationRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activationRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Customers Table */}
      {activeTab === 'customers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          
          {/* Controls: Search & Filter Pills */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par email, entreprise, téléphone, wilaya..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-slate-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tous ({customers.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Actifs ({stats.active})
              </button>
              <button
                onClick={() => setStatusFilter('trial')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'trial'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Essai ({stats.trial})
              </button>
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'expired'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Expirés ({stats.expired})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Client / Entreprise</th>
                  <th className="px-5 py-3.5 font-semibold">Email Inscrit</th>
                  <th className="px-5 py-3.5 font-semibold">Coordonnées</th>
                  <th className="px-5 py-3.5 font-semibold">Date d'inscription</th>
                  <th className="px-5 py-3.5 font-semibold">Temps de Licence Restant</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                      <span>Chargement des clients inscrits...</span>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <span>Aucun client correspondant aux critères de recherche.</span>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const email = customer.ownerEmail || customer.email || 'N/A';
                    const daysRemaining = getRemainingDays(customer);
                    const formattedDate = formatDate(customer.createdAt);

                    return (
                      <tr key={customer.uid || customer.id || email} className="hover:bg-slate-800/40 transition-colors">
                        
                        {/* 1. Client / Entreprise */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate max-w-[200px]" title={customer.name}>
                              {customer.name || 'Sans nom'}
                            </span>
                          </div>
                          {customer.contactName && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              Resp: <span className="text-slate-300 font-medium">{customer.contactName}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            ID: {(customer.uid || customer.id || '').substring(0, 12)}...
                          </div>
                        </td>

                        {/* 2. Email Inscrit */}
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-1.5 group">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-200 font-medium select-all truncate max-w-[190px]" title={email}>
                              {email}
                            </span>
                            {email !== 'N/A' && (
                              <button
                                onClick={() => copyToClipboard(email, 'email')}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Copier l'email"
                              >
                                {copiedEmail === email ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 3. Coordonnées */}
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1">
                            {customer.phone ? (
                              <a 
                                href={`tel:${customer.phone}`}
                                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-blue-400 font-medium transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{customer.phone}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Tél non renseigné</span>
                            )}
                            
                            {customer.address && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate max-w-[180px]" title={customer.address}>
                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{customer.address}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. Date d'inscription */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>

                        {/* 5. Temps de Licence Restant */}
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5">
                            
                            {/* Days Remaining Pill */}
                            <div>
                              {daysRemaining !== null ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                  daysRemaining > 30 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : daysRemaining > 0 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {daysRemaining > 0 
                                    ? `${daysRemaining} jour(s) restant(s)` 
                                    : daysRemaining === 0 
                                    ? 'Expire aujourd\'hui' 
                                    : `Expiré (-${Math.abs(daysRemaining)}j)`}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">Durée indéfinie</span>
                              )}
                            </div>

                            {/* Plan Name & Expiry Date */}
                            <div className="text-[11px] text-slate-400">
                              <span className="font-semibold text-slate-300">
                                {customer.licensePlan || 'Plan Standard'}
                              </span>
                              {customer.licenseExpiry && (
                                <span className="block text-slate-500 text-[10px]">
                                  Échéance : {new Date(customer.licenseExpiry).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>

                            {/* License Key with Copy */}
                            {customer.licenseKey && (
                              <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 w-fit">
                                <Key className="w-3 h-3 text-slate-500" />
                                <code className="text-[10px] text-amber-400 font-mono truncate max-w-[110px]" title={customer.licenseKey}>
                                  {customer.licenseKey.slice(0, 18)}...
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(customer.licenseKey, 'key')}
                                  className="p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  title="Copier la clé"
                                >
                                  {copiedKey === customer.licenseKey ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-5 py-4 align-top text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            
                            <div className="flex items-center gap-1.5">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => setEditingCompany(customer)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                title="Modifier la fiche client et la licence"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Modifier</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setCustomerToDelete(customer)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg transition-colors cursor-pointer"
                                title="Supprimer définitivement ce client"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Quick +1 An Pro Button */}
                            <button
                              type="button"
                              onClick={() => handleQuickExtend(customer, 12)}
                              disabled={generatingKey === customer.uid}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Ajouter 1 an de validité"
                            >
                              <PlusCircle className="w-3 h-3 text-emerald-400" />
                              <span>{generatingKey === customer.uid ? 'En cours...' : '+1 An PRO'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Licenses Management */}
      {activeTab === 'licenses' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" />
                <span>Gestion des Licences CARISOFT.next</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Licences d'essai 30 jours liées à un seul PC physique. Signature cryptographique Ed25519 & vérification hors-ligne.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  setNewlyGeneratedKey(null);
                  setShowGenerateModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer w-full md:w-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Générer une licence</span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Rechercher par clé, tenantId, machineId..."
                value={licenseSearchQuery}
                onChange={(e) => setLicenseSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={licenseStatusFilter}
                onChange={(e) => setLicenseStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Tous les statuts ({licenses.length})</option>
                <option value="unused">Non utilisées ({licenses.filter(l => l.status === 'unused').length})</option>
                <option value="active">Actives ({licenses.filter(l => l.status === 'active').length})</option>
                <option value="expired">Expirées ({licenses.filter(l => l.status === 'expired').length})</option>
                <option value="revoked">Révoquées ({licenses.filter(l => l.status === 'revoked').length})</option>
              </select>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Clé de Licence</th>
                    <th className="px-5 py-3.5 font-semibold">Entreprise (tenantId)</th>
                    <th className="px-5 py-3.5 font-semibold">Statut</th>
                    <th className="px-5 py-3.5 font-semibold">Poste / Machine</th>
                    <th className="px-5 py-3.5 font-semibold">Durée</th>
                    <th className="px-5 py-3.5 font-semibold">Dates</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {loadingLicenses ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Chargement des licences...
                      </td>
                    </tr>
                  ) : filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Aucune licence trouvée. Cliquez sur "Générer une licence" pour créer une nouvelle clé.
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((lic) => {
                      const isRevoked = lic.status === 'revoked';
                      const isActive = lic.status === 'active';
                      const isUnused = lic.status === 'unused' || !lic.status;
                      const isExpired = lic.status === 'expired';

                      return (
                        <tr key={lic.key} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 font-mono font-bold text-white text-xs sm:text-sm bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 w-fit">
                              <span>{lic.key}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(lic.key);
                                  setCopiedKey(lic.key);
                                  setTimeout(() => setCopiedKey(null), 2000);
                                }}
                                title="Copier la clé"
                                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                              >
                                {copiedKey === lic.key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{lic.tenantId}</div>
                            <div className="text-[11px] text-slate-500">
                              Par {lic.createdBy || 'SuperAdmin'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {isUnused && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                <Clock className="w-3 h-3" />
                                Non utilisée
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                Expirée
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Ban className="w-3 h-3" />
                                Révoquée
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {lic.machineId ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                                <Laptop className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span title={lic.machineId}>
                                  {lic.machineId.length > 16 ? `${lic.machineId.substring(0, 14)}...` : lic.machineId}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Non lié (attente 1re activation)</span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-medium text-white">{lic.durationDays || 30} jours</span>
                            <span className="text-[11px] text-slate-500 block">{lic.maxMachines || 1} PC max</span>
                          </td>

                          <td className="px-5 py-4 text-xs space-y-0.5">
                            <div className="text-slate-400">
                              Créée : {lic.createdAt ? new Date(lic.createdAt).toLocaleDateString('fr-FR') : '-'}
                            </div>
                            {lic.activatedAt && (
                              <div className="text-emerald-400 font-medium">
                                Activée : {new Date(lic.activatedAt).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                            {lic.expiresAt && (
                              <div className="text-amber-400 font-medium">
                                Expire : {new Date(lic.expiresAt).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(lic.key);
                                  setCopiedKey(lic.key);
                                  setTimeout(() => setCopiedKey(null), 2000);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 border border-slate-700"
                                title="Copier la clé"
                              >
                                {copiedKey === lic.key ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Copiée</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copier</span>
                                  </>
                                )}
                              </button>

                              {!isRevoked && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeLicense(lic.key)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg transition-colors flex items-center gap-1 border border-rose-500/20"
                                  title="Révoquer la licence"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Révoquer</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Activation Requests */}
      {activeTab === 'requests' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Demandes d'activation reçues</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Demandes soumises via le formulaire d'achat ou d'évaluation</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Demandeur (Entreprise)</th>
                  <th className="px-5 py-3.5 font-semibold">Localisation</th>
                  <th className="px-5 py-3.5 font-semibold">Plan Demandé</th>
                  <th className="px-5 py-3.5 font-semibold">Statut</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {activationRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Aucune demande d'activation en attente.
                    </td>
                  </tr>
                ) : (
                  activationRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white">{req.nom}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{req.email}</span>
                          {req.telephone && (
                            <>
                              <span>•</span>
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span>{req.telephone}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-300 font-medium">{req.wilaya || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{req.commune || ''}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-semibold text-blue-400">
                          {req.plan || 'Licence Annuelle'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          req.status === 'processed' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {req.status === 'processed' ? 'TRAITÉE' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => handleGenerateAndSendRequest(req, 12)}
                            disabled={generatingKey === req.id}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                          >
                            {generatingKey === req.id ? 'Génération...' : 'Valider & Générer Clé'}
                          </button>
                        ) : (
                          <div className="text-xs text-slate-500 flex items-center justify-end gap-1 font-mono">
                            <span>Clé attribuée</span>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Company & License Modal */}
      {editingCompany && (
        <EditCompanyModal 
          customer={editingCompany} 
          onClose={() => setEditingCompany(null)} 
          onRefresh={fetchCustomers} 
        />
      )}

      {/* Delete Confirmation Modal (In-App dialog, no window.confirm dependency) */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirmer la suppression</h3>
                <p className="text-xs text-rose-400 font-medium">Action irréversible</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
              <p className="text-slate-400">Vous êtes sur le point de supprimer définitivement le client :</p>
              <div className="font-bold text-white text-sm">
                {customerToDelete.name || 'Entreprise / Client'}
              </div>
              <div className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono text-slate-300">{customerToDelete.ownerEmail || customerToDelete.email || 'Email non renseigné'}</span>
              </div>
              {customerToDelete.phone && (
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{customerToDelete.phone}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Cette action supprimera le compte, la fiche entreprise et les accès de licence dans Cloud Firestore ainsi que les données associées.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer définitivement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Générer une licence */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowGenerateModal(false);
                setNewlyGeneratedKey(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Générer une licence</h3>
                <p className="text-xs text-slate-400">Liée à un seul PC physique (30 jours après activation)</p>
              </div>
            </div>

            {newlyGeneratedKey ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-emerald-400 font-semibold mb-2">Clé générée avec succès</p>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono font-bold text-white text-base tracking-wider flex items-center justify-between">
                    <span>{newlyGeneratedKey}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newlyGeneratedKey);
                        setCopiedKey(newlyGeneratedKey);
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                      title="Copier la clé"
                    >
                      {copiedKey === newlyGeneratedKey ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <p>• Entreprise / Tenant : <strong className="text-white">{genTenantId}</strong></p>
                  <p>• Durée de validité : <strong className="text-white">{genDurationDays} jours</strong></p>
                  <p>• Nb de postes max : <strong className="text-white">{genMaxMachines} PC</strong></p>
                  <p className="text-[11px] text-slate-500 italic mt-2">
                    L'horloge et le décompte des 30 jours débuteront dès la première activation sur le PC du client.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenerateModal(false);
                      setNewlyGeneratedKey(null);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateLicense} className="space-y-4">{notification?.type === "error" && (<div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-xl p-3 text-xs">{notification.message}</div>)}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Entreprise / TenantId <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: COMP-001 ou ID entreprise"
                    value={genTenantId}
                    onChange={(e) => setGenTenantId(e.target.value)}
                    list="companies-list"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <datalist id="companies-list">
                    {customers.map((c) => (
                      <option key={c.uid || c.id} value={c.uid || c.id}>
                        {c.name} ({c.email || c.ownerEmail})
                      </option>
                    ))}
                  </datalist>
                  <p className="text-[11px] text-slate-500 mt-1">Sélectionnez une entreprise cliente ou tapez son identifiant.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Durée de validité
                    </label>
                    <select
                      value={genDurationDays}
                      onChange={(e) => setGenDurationDays(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer mb-2"
                    >
                      <option value={30}>30 jours (Essai 1 Mois - Recommandé)</option>
                      <option value={90}>90 jours (3 mois - Test)</option>
                      <option value={180}>180 jours (6 mois)</option>
                      <option value={365}>365 jours (1 an - Standard)</option>
                      <option value={730}>730 jours (2 ans)</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      required
                      placeholder="Ou nb de jours personnalisé"
                      value={genDurationDays}
                      onChange={(e) => setGenDurationDays(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Démarre à la 1re activation sur le PC.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nb de PC max
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1}
                      readOnly
                      value={genMaxMachines}
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-400 rounded-xl px-3.5 py-2.5 text-xs cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Défaut: 1 PC</p>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingLicense || !genTenantId.trim()}
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    {isGeneratingLicense ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Génération...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Créer la clé</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
