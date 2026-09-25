import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../../components/ui/Button';
import { 
  Download, Upload, Database, AlertTriangle, CheckCircle2, 
  RotateCcw, Users, FileText, Receipt, CreditCard, 
  Package, Truck, FileJson, X, RefreshCw, HardDrive,
  Sparkles, Bug, Copy, Check, ExternalLink, ListFilter
} from 'lucide-react';
import { db, ensureDefaultUsersAndSettings, resetToDemoData } from '../../db/db';
import { useAnomalyStore } from '../../store/anomalyStore';
import { getShareableDemoUrl } from '../../lib/demoAuth';

export function MaintenanceModule() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [filePreview, setFilePreview] = useState<{
    name: string;
    size: string;
    format: string;
    tableCount: number;
    rowCount: number;
    lastModified?: string;
  } | null>(null);

  const [feedbackAlert, setFeedbackAlert] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const [copiedDemo, setCopiedDemo] = useState(false);
  const { openReportModal, openListModal, anomalies } = useAnomalyStore();

  const handleCopyDemo = () => {
    const url = getShareableDemoUrl();
    navigator.clipboard.writeText(url);
    setCopiedDemo(true);
    setTimeout(() => setCopiedDemo(false), 2500);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Database counts
  const stats = useLiveQuery(async () => {
    const [
      customers,
      deliveryNotes,
      invoices,
      payments,
      products,
      trucks,
      drivers,
      orders
    ] = await Promise.all([
      db.customers.count(),
      db.deliveryNotes.count(),
      db.invoices.count(),
      db.payments.count(),
      db.products.count(),
      db.trucks.count(),
      db.drivers.count(),
      db.orders.count()
    ]);
    return {
      customers,
      deliveryNotes,
      invoices,
      payments,
      products,
      trucks,
      drivers,
      orders,
      total: customers + deliveryNotes + invoices + payments + products + trucks + drivers + orders
    };
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setFeedbackAlert(null);
    try {
      const { exportDB } = await import('dexie-export-import');
      const blob = await exportDB(db, { prettyJson: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `carisoft_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedbackAlert({
        type: 'success',
        title: 'Sauvegarde exportée avec succès',
        message: `Le fichier carisoft_backup_${dateStr}.json a été téléchargé sur votre appareil.`
      });
    } catch (error: any) {
      console.error('Erreur export:', error);
      setFeedbackAlert({
        type: 'error',
        title: "Erreur lors de l'exportation",
        message: error?.message || "Impossible d'exporter la base de données locale."
      });
    } finally {
      setIsExporting(false);
    }
  };

  const analyzeAndPrepareFile = async (file: File) => {
    setFeedbackAlert(null);
    if (!file) return;

    if (!file.name.endsWith('.json') && file.type && !file.type.includes('json')) {
      setFeedbackAlert({
        type: 'error',
        title: 'Format non supporté',
        message: 'Veuillez sélectionner un fichier de sauvegarde au format JSON (.json).'
      });
      return;
    }

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        setFeedbackAlert({
          type: 'error',
          title: 'Fichier invalide',
          message: 'Le fichier sélectionné n\'est pas un fichier JSON valide ou est corrompu.'
        });
        return;
      }

      let tableCount = 0;
      let rowCount = 0;
      let format = 'Format JSON standard';

      if (parsed.formatName === 'dexie' && parsed.data?.tables) {
        format = `Format Dexie Natif (Base v${parsed.data.databaseVersion || 6})`;
        tableCount = parsed.data.tables.length;
        rowCount = parsed.data.tables.reduce((acc: number, t: any) => acc + (t.rows?.length || 0), 0);
      } else if (typeof parsed === 'object' && parsed !== null) {
        const knownTables = db.tables.map(t => t.name);
        const matchingKeys = Object.keys(parsed).filter(k => knownTables.includes(k) && Array.isArray(parsed[k]));
        if (matchingKeys.length > 0) {
          format = 'Format Tables Carisoft JSON';
          tableCount = matchingKeys.length;
          rowCount = matchingKeys.reduce((acc: number, k: string) => acc + parsed[k].length, 0);
        } else {
          format = 'Structure JSON personnalisée';
        }
      }

      const sizeStr = file.size < 1024 * 1024 
        ? `${(file.size / 1024).toFixed(1)} Ko` 
        : `${(file.size / (1024 * 1024)).toFixed(2)} Mo`;

      setPendingFile(file);
      setParsedData(parsed);
      setFilePreview({
        name: file.name,
        size: sizeStr,
        format,
        tableCount,
        rowCount,
        lastModified: file.lastModified ? new Date(file.lastModified).toLocaleDateString('fr-FR') : undefined
      });
      setShowConfirmModal(true);
    } catch (err: any) {
      console.error('Erreur analyse fichier:', err);
      setFeedbackAlert({
        type: 'error',
        title: 'Erreur d\'analyse du fichier',
        message: err?.message || 'Impossible de lire le fichier de sauvegarde.'
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeAndPrepareFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      analyzeAndPrepareFile(file);
    }
  };

  const executeRestore = async () => {
    if (!pendingFile || !parsedData) return;

    setIsRestoring(true);
    setFeedbackAlert(null);

    try {
      let restoredCount = 0;
      let successMethod = false;

      // Method 1: If native dexie export, try importInto
      if (parsedData.formatName === 'dexie') {
        try {
          const { importInto } = await import('dexie-export-import');
          await importInto(db, pendingFile, {
            clearTablesBeforeImport: true,
            overwriteValues: true,
            acceptVersionDiff: true,
            acceptMissingTables: true,
            acceptNameDiff: true,
          });
          successMethod = true;
          restoredCount = filePreview?.rowCount || 0;
        } catch (importErr) {
          console.warn('importInto a rencontré une incompatibilité, bascule vers réintégration manuelle des tables:', importErr);
        }
      }

      // Method 2 (Direct table insertion fallback)
      if (!successMethod) {
        if (parsedData.data?.tables && Array.isArray(parsedData.data.tables)) {
          await db.transaction('rw', db.tables, async () => {
            for (const tableExport of parsedData.data.tables) {
              const tableName = tableExport.name;
              if (db.tables.some(t => t.name === tableName)) {
                const table = db.table(tableName);
                await table.clear();
                if (tableExport.rows && tableExport.rows.length > 0) {
                  const items = tableExport.rows.map((r: any) => {
                    if (Array.isArray(r) && r.length === 2 && typeof r[1] === 'object' && r[1] !== null) {
                      return r[1];
                    }
                    return r;
                  });
                  await table.bulkPut(items);
                  restoredCount += items.length;
                }
              }
            }
          });
          successMethod = true;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          await db.transaction('rw', db.tables, async () => {
            for (const [key, rows] of Object.entries(parsedData)) {
              if (Array.isArray(rows) && db.tables.some(t => t.name === key)) {
                const table = db.table(key);
                await table.clear();
                if (rows.length > 0) {
                  await table.bulkPut(rows);
                  restoredCount += rows.length;
                }
              }
            }
          });
          successMethod = true;
        }
      }

      if (!successMethod) {
        throw new Error('Le format du fichier de sauvegarde n\'est pas reconnu par le système.');
      }

      // Guarantee essential defaults and users exist
      await ensureDefaultUsersAndSettings();

      setShowConfirmModal(false);
      setPendingFile(null);
      setParsedData(null);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setFeedbackAlert({
        type: 'success',
        title: 'Restauration réussie !',
        message: `La base de données a été restaurée avec succès (${restoredCount} enregistrements chargés). Vos données sont à jour.`
      });
    } catch (error: any) {
      console.error('Erreur restauration:', error);
      setFeedbackAlert({
        type: 'error',
        title: 'Échec de la restauration',
        message: error?.message || 'Une erreur est survenue lors de la réintégration des données de sauvegarde.'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetToDemo = async () => {
    if (!window.confirm('Attention : Cette action effacera toutes vos données locales actuelles pour recharger le jeu de démonstration initial (Carrière Mahajir Sidar). Confirmez-vous la réinitialisation ?')) {
      return;
    }
    setIsResetting(true);
    setFeedbackAlert(null);
    try {
      await resetToDemoData();
      setFeedbackAlert({
        type: 'info',
        title: 'Données réinitialisées',
        message: 'La base de données locale a été réinitialisée avec succès aux valeurs de démonstration d\'origine.'
      });
    } catch (error: any) {
      console.error('Erreur réinitialisation:', error);
      setFeedbackAlert({
        type: 'error',
        title: 'Erreur de réinitialisation',
        message: error?.message || 'Impossible de réinitialiser la base de données.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Database className="h-6 w-6 text-blue-600" />
            Maintenance & Sauvegardes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Sauvegardez, restaurez et sécurisez l'ensemble de vos données d'exploitation locales.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 self-start">
          <HardDrive className="h-3.5 w-3.5 text-slate-500" />
          <span>Stockage Local (IndexedDB v6)</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackAlert && (
        <div 
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
            feedbackAlert.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : feedbackAlert.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedbackAlert.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
            {feedbackAlert.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
            {feedbackAlert.type === 'info' && <RefreshCw className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-sm">{feedbackAlert.title}</p>
              <p className="text-xs mt-0.5 opacity-90">{feedbackAlert.message}</p>
              {feedbackAlert.type === 'success' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs font-semibold underline text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  Actualiser la page pour voir les changements partout
                </button>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setFeedbackAlert(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Database Quick Health / Statistics */}
      <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold tracking-wide">État de la Base de Données Actuelle</span>
          </div>
          <span className="text-xs text-slate-400">
            {stats ? `${stats.total} enregistrements actifs` : 'Calcul en cours...'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span>Clients</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.customers ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bons de Livraison</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.deliveryNotes ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Receipt className="h-3.5 w-3.5 text-amber-400" />
              <span>Factures</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.invoices ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <CreditCard className="h-3.5 w-3.5 text-purple-400" />
              <span>Règlements</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.payments ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Package className="h-3.5 w-3.5 text-rose-400" />
              <span>Produits</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.products ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Truck className="h-3.5 w-3.5 text-sky-400" />
              <span>Camions</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.trucks ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Users className="h-3.5 w-3.5 text-teal-400" />
              <span>Chauffeurs</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.drivers ?? '...'}</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              <span>Commandes</span>
            </div>
            <span className="text-lg font-bold text-white">{stats?.orders ?? '...'}</span>
          </div>
        </div>
      </div>

      {/* Demo Link & Client Testing Feedback Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-lg border border-blue-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">
                  Lien Démo Client (Sans Mot de Passe)
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Actif
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Permettez à vos clients ou partenaires de tester CARISOFT en 1 clic et de vous transmettre leurs remarques & anomalies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openListModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer border border-white/10"
            >
              <ListFilter className="h-4 w-4 text-blue-300" />
              <span>Anomalies signalées ({anomalies.length})</span>
            </button>

            <button
              type="button"
              onClick={() => openReportModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Bug className="h-4 w-4" />
              <span>Signaler anomalie</span>
            </button>
          </div>
        </div>

        {/* Shareable Link Box */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Lien direct à copier et envoyer à votre client (WhatsApp / Email / SMS) :
            </span>
            <div className="font-mono text-xs text-amber-300 select-all truncate bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              {getShareableDemoUrl()}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyDemo}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm"
            >
              {copiedDemo ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              <span>{copiedDemo ? 'Lien copié !' : 'Copier le lien'}</span>
            </button>

            <a
              href="/demo"
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Tester dans un nouvel onglet"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Sauvegarde Complète */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Sauvegarde complète (Backup)</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Télécharge un fichier de sauvegarde <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 text-xs">.json</code> contenant 
              toutes les tables de votre logiciel : clients, tarifs, bons de livraison, facturation, véhicules et paramètres d'entreprise.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">Recommandation :</p>
              <p>Effectuez une sauvegarde régulière à la fin de chaque journée ou avant une réinitialisation.</p>
            </div>
          </div>

          <Button 
            onClick={handleExport} 
            isLoading={isExporting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer mt-2"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger la sauvegarde (.json)
          </Button>
        </div>

        {/* Card 2: Restauration de Sauvegarde */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Upload className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Restauration (Restore)</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Importez un fichier de sauvegarde <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 text-xs">.json</code> pour 
              restituer l'ensemble de votre base de données locale.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Attention :</strong> La restauration remplacera les données actuelles de la base par les données du fichier.
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50/50' 
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Glissez-déposez votre fichier de sauvegarde ici
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ou cliquez pour parcourir vos fichiers (.json)
            </p>
          </div>

          <Button 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
          >
            <Upload className="h-4 w-4 mr-2" />
            Sélectionner un fichier de sauvegarde
          </Button>
        </div>
      </div>

      {/* Card 3: Réinitialisation aux données d'exemple */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-slate-600" />
              Réinitialisation aux données d'exemple
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Si vous souhaitez repartir sur une base d'essai propre avec les clients, transporteurs et factures d'exemple de la carrière SIDAR.
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={handleResetToDemo}
            isLoading={isResetting}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer self-start sm:self-auto shrink-0 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Réinitialiser la Démo
          </Button>
        </div>
      </div>

      {/* Confirmation Modal before restoring */}
      {showConfirmModal && filePreview && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileJson className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-800">Confirmer la restauration</h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingFile(null);
                  setFilePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nom du fichier :</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]" title={filePreview.name}>
                  {filePreview.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Taille :</span>
                <span className="font-semibold text-slate-800">{filePreview.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Format détecté :</span>
                <span className="font-semibold text-blue-700">{filePreview.format}</span>
              </div>
              {filePreview.rowCount > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Données trouvées :</span>
                  <span className="font-semibold text-emerald-700">
                    {filePreview.rowCount} enregistrements ({filePreview.tableCount} tables)
                  </span>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Attention à l'écrasement</p>
                <p className="mt-0.5 text-red-800 leading-relaxed">
                  Cette opération remplacera les données actuelles de votre base locale par celles de ce fichier de sauvegarde.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingFile(null);
                  setFilePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={isRestoring}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={executeRestore}
                isLoading={isRestoring}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Confirmer la restauration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
