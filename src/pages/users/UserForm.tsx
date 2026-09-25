import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ArrowLeft, Save, Eye, EyeOff, Lock, User as UserIcon, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function UserForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const isSuperAdmin = Boolean(
    currentUser?.role === 'superadmin' || 
    currentUser?.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
    currentUser?.username?.toLowerCase() === 'nabsterzero'
  );
  
  const [userDoc, setUserDoc] = useState<any>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (id) {
      const fetchUser = async () => {
        const docRef = doc(firestore, 'users', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedUser: any = { id: docSnap.id, ...docSnap.data() };
          setUserDoc(fetchedUser);
          
          if ((fetchedUser.role === 'superadmin' || fetchedUser.email === 'nabsterzero@gmail.com') && !isSuperAdmin) {
            navigate('/users', { replace: true });
            return;
          }
          setName(fetchedUser.name || '');
          setUsername(fetchedUser.username || fetchedUser.email?.split('@')[0] || '');
          setEmail(fetchedUser.email || '');
          setRole(fetchedUser.role === 'owner' ? 'admin' : (fetchedUser.role || 'viewer'));
          setActive(fetchedUser.active !== false);
        }
      };
      fetchUser();
    }
  }, [id, isSuperAdmin, navigate]);

  const handleSave = async () => {
    if (!username.trim()) {
      alert('Veuillez saisir un identifiant.');
      return;
    }

    if (!email.trim()) {
      alert('Veuillez saisir une adresse email valide.');
      return;
    }

    if (role === 'superadmin' && userDoc?.role !== 'superadmin') {
      alert('Impossible d\'attribuer le rôle Super Administrateur via ce formulaire.');
      return;
    }

    // Password validation for new user
    if (!id && !password) {
      alert('Veuillez définir un mot de passe pour le nouvel utilisateur.');
      return;
    }

    // Password match check
    if (password && password !== confirmPassword) {
      alert('Les mots de passe saisis ne correspondent pas.');
      return;
    }

    try {
      const userEmail = email.trim().toLowerCase();
      const userPass = password.trim();
      const cleanUsername = username.trim().toLowerCase();

      let fbUid: string | null = null;
      // Use full-stack backend (server.ts) to manage Firebase Auth
      try {
        if (id) {
          // Update existing user via Admin SDK
          const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, password: userPass || undefined, displayName: name.trim() || username.trim(), disabled: !active })
          });
          const data = await response.json();
          if (data.error) {
            console.warn("API Update Error:", data.error);
            // Non-blocking for local prototype if user doesn't exist in auth yet
          }
        } else {
          // Create new user via Admin SDK
          const signUpPass = userPass || (userDoc?.password) || 'admin';
          const response = await fetch(`/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, password: signUpPass, displayName: name.trim() || username.trim(), disabled: !active })
          });
          const data = await response.json();
          if (data.error) {
            if (data.error.includes('EMAIL_EXISTS')) {
              alert("Un compte cloud existe déjà avec cette adresse email.");
              return;
            }
            console.warn("API Create Error:", data.error);
            alert("Avertissement: Compte Auth non créé. Vérifiez vos variables d'environnement côté serveur.");
          } else if (data.uid) {
            fbUid = data.uid;
          }
        }
      } catch (authErr) {
        console.warn("Could not communicate with backend server /api/users", authErr);
      }

      // Public Username Mapping (for login by username on fresh device)
      if (cleanUsername) {
        try {
           const mapRef = doc(firestore, 'username_mappings', cleanUsername);
           await setDoc(mapRef, { email: userEmail });
        } catch(e) {
           console.warn("Could not write username mapping", e);
        }
      }

      if (id) {
        const updateData: any = {
          name: name.trim() || username.trim(),
          username: username.trim(),
          email: userEmail,
          role: role as any,
          active
        };

        // Only update password if a new one was entered
        if (userPass) {
          updateData.password = userPass;
        }

        const docRef = doc(firestore, 'users', id);
        await updateDoc(docRef, updateData);

        // If the updated user is the currently logged-in user, immediately update authStore session
        const isCurrent = currentUser && (
          currentUser.id === id || 
          currentUser.email?.toLowerCase() === userEmail || 
          currentUser.username?.toLowerCase() === cleanUsername ||
          userDoc?.email?.toLowerCase() === currentUser.email?.toLowerCase() ||
          userDoc?.username?.toLowerCase() === currentUser.username?.toLowerCase()
        );
        if (isCurrent) {
          useAuthStore.getState().updateUser({
            name: updateData.name,
            username: updateData.username,
            email: updateData.email,
            role: updateData.role,
          });
        }
      } else {
        let newId = fbUid || crypto.randomUUID();
        const docRef = doc(firestore, 'users', newId);
        await setDoc(docRef, {
          id: newId,
          companyId: currentUser?.companyId,
          name: name.trim() || username.trim(),
          username: username.trim(),
          email: userEmail,
          password: userPass || 'admin',
          role: role as any,
          active,
          createdAt: new Date().toISOString()
        });
      }
      navigate('/users');
    } catch (error) {
      console.error(error);
      alert('Erreur lors de l\'enregistrement de l\'utilisateur');
    }
  };

  const roleOptions = [
    ...(userDoc?.role === 'superadmin' ? [{ value: 'superadmin', label: '👑 Super Admin (Éditeur SaaS & Clés de licence)' }] : []),
    { value: 'admin', label: 'Administrateur (Tous les droits carrière)' },
    { value: 'manager', label: 'Manager (Exploitation, Commandes, BL)' },
    { value: 'billing', label: 'Facturation (Factures, Règlements, BL)' },
    { value: 'viewer', label: 'Consultation (Lecture seule)' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {id ? "Modifier l'utilisateur & Accès" : 'Nouvel Utilisateur'}
          </h1>
          <p className="text-sm text-slate-500">
            {id ? "Mettre à jour les informations, rôle et mot de passe" : "Créer un compte d'accès avec email et mot de passe"}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Informations Générales
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Nom & Prénom" 
              placeholder="ex: Ahmed Benali"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input 
              label="Identifiant unique (Login) *" 
              placeholder="ex: abenali"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Adresse Email de connexion *" 
              type="email"
              placeholder="ex: abenali@carisoft.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            
            <Select 
              label="Rôle attribué *"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={roleOptions}
            />
          </div>
        </div>

        {/* Security & Password */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Sécurité & Mot de passe
            </h3>
            {id && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                Laissez vide pour ne pas modifier le mot de passe actuel
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {id ? 'Nouveau mot de passe' : 'Mot de passe initial *'}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder={id ? '•••••••• (inchangé)' : 'Saisir le mot de passe'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Confirmer le mot de passe
              </label>
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="Ressaisir le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-800">Compte Actif</span>
              <p className="text-xs text-slate-500">Autorise cet utilisateur à se connecter à la plateforme</p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="outline" onClick={() => navigate('/users')}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {id ? 'Mettre à jour' : 'Créer le compte'}
          </Button>
        </div>
      </div>
    </div>
  );
}
