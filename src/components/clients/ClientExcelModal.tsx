import { useState, useRef, type ChangeEvent } from 'react';
import { db } from '../../db/db';
import { Customer } from '../../types';
import { 
  exportClientsToExcel, 
  downloadClientsTemplate, 
  parseClientsFromExcel 
} from '../../lib/excelUtils';
import { Button } from '../ui/Button';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface ClientExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Customer[];
  companyId?: string;
}

export function ClientExcelModal({ isOpen, onClose, clients, companyId = '' }: ClientExcelModalProps) {
  const currentCompanyId = companyId;
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<Customer>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    total: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'skip'>('merge'); // merge = update existing by code/name, skip = skip duplicate

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setParseErrors([]);
    setImportResult(null);

    try {
      const { clients: parsedClients, errors } = await parseClientsFromExcel(selectedFile);
      setParsedData(parsedClients);
      setParseErrors(errors);
    } catch (err: any) {
      setParseErrors([err.message || 'Erreur lors de la lecture du fichier Excel.']);
      setParsedData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);

    try {
      const existingCustomers = await db.customers.where('companyId').equals(currentCompanyId).toArray();
      let inserted = 0;
      let updated = 0;

      for (const item of parsedData) {
        if (!item.name) continue;

        // Try to match existing customer by code or name
        const match = existingCustomers.find(
          (c) => (item.code && c.code.toLowerCase() === item.code.toLowerCase()) || 
                 (c.name.toLowerCase() === item.name?.toLowerCase())
        );

        if (match) {
          if (importMode === 'merge') {
            await db.customers.update(match.id, {
              ...item,
              companyId: companyId || match.companyId,
            });
            updated++;
          }
          // if skip, do nothing
        } else {
          const newId = `C_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const newClient: Customer = {
            id: newId,
            code: item.code || `CL-${Math.floor(1000 + Math.random() * 9000)}`,
            name: item.name || '',
            type: item.type || 'DIVERS',
            address: item.address || '',
            phone: item.phone || '',
            mobile: item.mobile || '',
            email: item.email || '',
            rc: item.rc || '',
            nif: item.nif || '',
            nis: item.nis || '',
            article: item.article || '',
            bank: item.bank || '',
            familyId: item.familyId || 'CONV1',
            tvaExempt: item.tvaExempt || false,
            hidePricesOnDeliveryNote: item.hidePricesOnDeliveryNote || false,
            initialDebt: item.initialDebt || 0,
            creditLimit: item.creditLimit || 0,
            balance: item.balance ?? (-(item.initialDebt || 0)),
            active: item.active !== false,
            companyId: companyId,
          };
          await db.customers.add(newClient);
          inserted++;
        }
      }

      setImportResult({
        inserted,
        updated,
        total: parsedData.length,
      });
      setParsedData([]);
      setFile(null);
    } catch (err: any) {
      setParseErrors([err?.message || 'Erreur lors de l\'enregistrement en base de données.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Gestion Excel • Clients</h2>
              <p className="text-xs text-slate-400">Exportation et importation groupée de vos clients et conventions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab('export'); handleReset(); }}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Download className="h-4 w-4" />
            Exporter vers Excel
          </button>
          <button
            onClick={() => { setActiveTab('import'); handleReset(); }}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Upload className="h-4 w-4" />
            Importer depuis Excel
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-base">Télécharger la liste complète des clients</h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Le fichier Excel contiendra tous les détails de vos <strong>{clients.length} client(s)</strong> : 
                    Coordonnées, NIF/NIS/RC, soldes actuels, dettes initiales, plafonds de crédit et statuts.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Aperçu des colonnes exportées</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Code Client', 'Nom / Raison Sociale', 'Type / Catégorie', 'Téléphone', 'Mobile',
                    'Email', 'Adresse', 'RC', 'NIF', 'NIS', 'Article Imposition', 'Banque', 'Dette Initiale',
                    'Plafond Crédit', 'Solde Actuel', 'Exonéré TVA', 'Masquer Prix', 'Statut'
                  ].map((col) => (
                    <span key={col} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-xs font-medium">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={onClose}>
                  Fermer
                </Button>
                <Button 
                  onClick={() => exportClientsToExcel(clients)} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter {clients.length} Client(s) (.xlsx)
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Template Download Banner */}
              <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-blue-950">Modèle de fichier Excel recommandé</div>
                    <div className="text-xs text-blue-700">Téléchargez le modèle avec les en-têtes pré-formatés pour éviter les erreurs.</div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadClientsTemplate}
                  className="bg-white border-blue-300 text-blue-800 hover:bg-blue-50 font-bold shrink-0 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Télécharger Modèle
                </Button>
              </div>

              {/* Import Result Feedback */}
              {importResult && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-emerald-800 font-bold text-base">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    Importation réussie avec succès !
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-white rounded-xl border border-emerald-200">
                      <div className="text-2xl font-black text-slate-800">{importResult.total}</div>
                      <div className="text-xs font-bold text-slate-500">Lignes traitées</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200">
                      <div className="text-2xl font-black text-emerald-600">+{importResult.inserted}</div>
                      <div className="text-xs font-bold text-emerald-700">Nouveaux clients</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200">
                      <div className="text-2xl font-black text-blue-600">{importResult.updated}</div>
                      <div className="text-xs font-bold text-blue-700">Clients mis à jour</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors Display */}
              {parseErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Remarques lors de l'analyse du fichier :
                  </div>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dropzone File Upload */}
              {!importResult && (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      file 
                        ? 'border-blue-400 bg-blue-50/30' 
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx, .xls, .csv"
                      className="hidden" 
                    />
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 bg-blue-100 text-blue-700 rounded-full">
                        <Upload className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {file ? file.name : "Cliquez ou glissez-déposez votre fichier Excel ici"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Formats acceptés : .xlsx, .xls, .csv (taille max 10 Mo)
                        </p>
                      </div>
                      {file && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg shadow-2xs">
                          <span>{(file.size / 1024).toFixed(1)} Ko</span>
                          <span>•</span>
                          <span>{parsedData.length} client(s) détecté(s)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Duplicate Resolution Options */}
                  {parsedData.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Comportement en cas de doublon (même code ou nom) :</div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="importMode" 
                            value="merge" 
                            checked={importMode === 'merge'} 
                            onChange={() => setImportMode('merge')} 
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Mettre à jour les informations du client existant</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="importMode" 
                            value="skip" 
                            checked={importMode === 'skip'} 
                            onChange={() => setImportMode('skip')} 
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Ignorer (garder les données actuelles)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Data Preview Table */}
                  {parsedData.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span>Aperçu des 5 premières lignes sur {parsedData.length} :</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-48">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Code</th>
                              <th className="p-2.5">Nom</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Téléphone</th>
                              <th className="p-2.5">Dette Initiale</th>
                              <th className="p-2.5">Plafond</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedData.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-bold text-slate-800">{row.code || '-'}</td>
                                <td className="p-2.5 font-semibold text-slate-900">{row.name}</td>
                                <td className="p-2.5 text-slate-600">{row.type}</td>
                                <td className="p-2.5 font-mono text-slate-600">{row.phone || '-'}</td>
                                <td className="p-2.5 font-mono text-slate-600">{row.initialDebt || 0} DA</td>
                                <td className="p-2.5 font-mono text-slate-600">{row.creditLimit || 0} DA</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={importResult ? onClose : handleReset}>
                  {importResult ? 'Terminer' : 'Annuler'}
                </Button>
                {parsedData.length > 0 && !importResult && (
                  <Button 
                    onClick={handleExecuteImport} 
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importation en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Confirmer l'import de {parsedData.length} Client(s)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
