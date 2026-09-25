import { useState, useEffect, type FormEvent } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Edit, Trash2, Plus, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import { useAuthStore } from '../../store/authStore';

export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = useAuthStore(state => state.user);
  const isSuperAdmin = Boolean(
    currentUser?.role === 'superadmin' || 
    currentUser?.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
    currentUser?.username?.toLowerCase() === 'nabsterzero'
  );
  const navigate = useNavigate();

  // Reset password modal state
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser?.companyId) return;
      try {
        const q = query(
          collection(firestore, 'users'), 
          where('companyId', '==', currentUser.companyId)
        );
        const snapshot = await getDocs(q);
        const fetchedUsers: User[] = [];
        snapshot.forEach(doc => {
          fetchedUsers.push({ id: doc.id, ...doc.data() } as User);
        });
        setUsers(fetchedUsers);
      } catch (err) {
        console.warn("Could not fetch users from Firestore (offline or no permission)", err);
      }
    };
    fetchUsers();
  }, [currentUser?.companyId]);

  const visibleUsers = (users || []).filter(u => {
    const isTargetSuperAdmin = 
      u.role === 'superadmin' || 
      u.id === 'U0' || 
      u.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
      u.username?.toLowerCase() === 'nabsterzero' ||
      (u.name && u.name.toLowerCase().includes('super admin'));

    if (isTargetSuperAdmin) {
      return isSuperAdmin;
    }
    return true;
  });

  const handleToggleStatus = async (user: User) => {
    const isTargetSuperAdmin = 
      user.role === 'superadmin' || 
      user.id === 'U0' || 
      user.email?.toLowerCase() === 'nabsterzero@gmail.com';
      
    if (isTargetSuperAdmin && !isSuperAdmin) {
      alert('Action non autorisée');
      return;
    }
    const action = user.active !== false ? 'désactiver' : 'activer';
    if (window.confirm(`Voulez-vous vraiment ${action} cet utilisateur (${user.username}) ?`)) {
      try {
        const userRef = doc(firestore, 'users', user.id);
        const newActiveState = user.active === false ? true : false;
        await updateDoc(userRef, { active: newActiveState });
        setUsers(users.map(u => u.id === user.id ? { ...u, active: newActiveState } : u));
      } catch (err) {
        console.warn("Could not update user in Firestore (offline or no permission)", err);
      }
    }
  };

  const handleQuickPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword.trim()) return;

    try {
      const userRef = doc(firestore, 'users', resetModalUser.id);
      await updateDoc(userRef, { password: newPassword.trim() });
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        setResetModalUser(null);
        setNewPassword('');
      }, 1500);
    } catch (err) {
      console.warn("Could not reset password in Firestore (offline or no permission)", err);
      alert('Erreur lors du changement de mot de passe (vous êtes peut-être hors-ligne)');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Utilisateurs & Rôles</h1>
          <p className="text-slate-500">Contrôle des accès, identifiants, emails et mots de passe</p>
        </div>
        <Button onClick={() => navigate('new')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel Utilisateur
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur & Identifiant</TableHead>
              <TableHead>Email de connexion</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {visibleUsers?.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-semibold text-slate-800">{u.name || u.username}</div>
                  <div className="text-xs text-slate-400 font-mono">@{u.username}</div>
                </TableCell>
                <TableCell className="text-slate-600 font-medium text-sm">
                  {u.email || `${u.username}@carisoft.com`}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                    u.role === 'superadmin'
                      ? 'bg-purple-900 text-purple-100 border border-purple-800'
                      : (u.role === 'admin' || u.role === 'owner')
                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                      : u.role === 'billing'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : u.role === 'manager'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {u.role === 'superadmin' && '👑 Super Admin'}
                    {(u.role === 'admin' || u.role === 'owner') && 'Administrateur'}
                    {u.role === 'billing' && 'Facturation'}
                    {u.role === 'manager' && 'Manager'}
                    {u.role === 'viewer' && 'Consultation'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                    u.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {u.active !== false ? 'Actif' : 'Inactif'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setResetModalUser(u);
                        setNewPassword('');
                        setResetSuccess(false);
                      }} 
                      title="Changer le mot de passe"
                      className="text-slate-600 hover:text-blue-600"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate(u.id)} 
                      title="Modifier utilisateur"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleToggleStatus(u)} 
                      title={u.active !== false ? "Désactiver le compte" : "Réactiver le compte"}
                    >
                      <Trash2 className={`h-4 w-4 ${u.active !== false ? 'text-red-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'}`} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visibleUsers?.length === 0 && (
               <TableRow>
                 <TableCell colSpan={5} className="text-center py-8 text-slate-500">Aucun utilisateur enregistré</TableCell>
               </TableRow>
            )}
          </tbody>
        </Table>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Changer le mot de passe</h3>
                <p className="text-xs text-slate-500">Pour l'utilisateur <span className="font-semibold text-slate-700">{resetModalUser.name || resetModalUser.username}</span></p>
              </div>
            </div>

            {resetSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Le mot de passe a été mis à jour avec succès !</span>
              </div>
            ) : (
              <form onSubmit={handleQuickPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nouveau mot de passe *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="Saisir le nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setResetModalUser(null)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    Enregistrer le mot de passe
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
