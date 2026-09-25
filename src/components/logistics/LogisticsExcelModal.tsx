import { useState, useRef, type ChangeEvent } from 'react';
import { db } from '../../db/db';
import { Truck, Driver } from '../../types';
import { 
  exportTrucksToExcel, 
  downloadTrucksTemplate, 
  parseTrucksFromExcel,
  exportDriversToExcel,
  downloadDriversTemplate,
  parseDriversFromExcel
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
  Truck as TruckIcon,
  UserCircle
} from 'lucide-react';

interface LogisticsExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'trucks' | 'drivers';
  trucks: Truck[];
  drivers: Driver[];
  companyId?: string;
}

export function LogisticsExcelModal({ 
  isOpen, 
  onClose, 
  targetType: initialTargetType, 
  trucks, 
  drivers, 
  companyId 
}: LogisticsExcelModalProps) {
  const [selectedType, setSelectedType] = useState<'trucks' | 'drivers'>(initialTargetType);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedTrucks, setParsedTrucks] = useState<Partial<Truck>[]>([]);
  const [parsedDrivers, setParsedDrivers] = useState<Partial<Driver>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    total: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'skip'>('merge');

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
      if (selectedType === 'trucks') {
        const { trucks: pTrucks, errors } = await parseTrucksFromExcel(selectedFile);
        setParsedTrucks(pTrucks);
        setParseErrors(errors);
      } else {
        const { drivers: pDrivers, errors } = await parseDriversFromExcel(selectedFile);
        setParsedDrivers(pDrivers);
        setParseErrors(errors);
      }
    } catch (err: any) {
      setParseErrors([err.message || 'Erreur lors de la lecture du fichier Excel.']);
      setParsedTrucks([]);
      setParsedDrivers([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    setIsProcessing(true);
    try {
      let inserted = 0;
      let updated = 0;

      if (selectedType === 'trucks') {
        if (parsedTrucks.length === 0) return;
        const existingTrucks = await db.trucks.where('companyId').equals(companyId).toArray();
        const existingDrivers = await db.drivers.where('companyId').equals(companyId).toArray();

        for (const item of parsedTrucks) {
          if (!item.matricule) continue;

          // Check if driver exists or needs to be registered
          let driverId = '';
          if (item.driverName && item.driverName.trim() !== '') {
            const foundDriver = existingDrivers.find(
              (d) => d.name.toLowerCase() === item.driverName?.toLowerCase()
            );
            if (foundDriver) {
              driverId = foundDriver.id;
            } else {
              // Create driver
              const newDId = `D_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              await db.drivers.add({
                id: newDId,
                name: item.driverName.trim(),
                phone: item.driverPhone || '',
                active: true,
              });
              driverId = newDId;
              existingDrivers.push({
                id: newDId,
                name: item.driverName.trim(),
                phone: item.driverPhone || '',
                active: true,
              });
            }
          }

          const match = existingTrucks.find(
            (t) => t.matricule.replace(/\s+/g, '') === item.matricule?.replace(/\s+/g, '')
          );

          if (match) {
            if (importMode === 'merge') {
              await db.trucks.update(match.id, {
                ...item,
                driverId: driverId || match.driverId,
                companyId: companyId || match.companyId,
              });
              updated++;
            }
          } else {
            const newTId = `T_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newTruck: Truck = {
              id: newTId,
              matricule: item.matricule,
              tare: item.tare || 0,
              mnTonne: item.mnTonne || 0,
              volumeM3: item.volumeM3 || 0,
              driverName: item.driverName || '',
              driverPhone: item.driverPhone || '',
              driverId: driverId,
              brand: item.brand || '',
              allowDiscount: item.allowDiscount || false,
              isFavorite: item.isFavorite || false,
              active: item.active !== false,
              companyId: companyId,
            };
            await db.trucks.add(newTruck);
            inserted++;
          }
        }

        setImportResult({
          inserted,
          updated,
          total: parsedTrucks.length,
        });
        setParsedTrucks([]);
      } else {
        // Drivers import
        if (parsedDrivers.length === 0) return;
        const existingDrivers = await db.drivers.where('companyId').equals(companyId).toArray();

        for (const item of parsedDrivers) {
          if (!item.name) continue;

          const match = existingDrivers.find(
            (d) => d.name.toLowerCase() === item.name?.toLowerCase()
          );

          if (match) {
            if (importMode === 'merge') {
              await db.drivers.update(match.id, {
                ...item,
              });
              updated++;
            }
          } else {
            const newDId = `D_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newDriver: Driver = {
              id: newDId,
              name: item.name,
              phone: item.phone || '',
              active: item.active !== false,
            };
            await db.drivers.add(newDriver);
            inserted++;
          }
        }

        setImportResult({
          inserted,
          updated,
          total: parsedDrivers.length,
        });
        setParsedDrivers([]);
      }

      setFile(null);
    } catch (err: any) {
      setParseErrors([err?.message || 'Erreur lors de l\'enregistrement en base de données.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedTrucks([]);
    setParsedDrivers([]);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentParsedCount = selectedType === 'trucks' ? parsedTrucks.length : parsedDrivers.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Gestion Excel • {selectedType === 'trucks' ? 'Camions' : 'Chauffeurs'}</h2>
              <p className="text-xs text-slate-400">Exportation et importation groupée du parc logistique</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entity Switcher (Camions vs Chauffeurs) */}
        <div className="flex bg-slate-100 p-2 gap-2 border-b border-slate-200">
          <button
            onClick={() => { setSelectedType('trucks'); handleReset(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'trucks'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <TruckIcon className="h-4 w-4" />
            Camions ({trucks.length})
          </button>
          <button
            onClick={() => { setSelectedType('drivers'); handleReset(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'drivers'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <UserCircle className="h-4 w-4" />
            Chauffeurs ({drivers.length})
          </button>
        </div>

        {/* Action Tabs */}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-base">
                    Exporter les {selectedType === 'trucks' ? 'Camions' : 'Chauffeurs'}
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    {selectedType === 'trucks'
                      ? `Le fichier Excel contiendra la liste des ${trucks.length} camion(s) avec leurs matricules, tares, volumes (m³), chauffeurs associés et statuts.`
                      : `Le fichier Excel contiendra la liste des ${drivers.length} chauffeur(s) avec leurs noms, coordonnées téléphoniques et statuts.`
                    }
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Colonnes incluses dans le fichier</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedType === 'trucks' ? [
                    'Matricule', 'Marque', 'Tare (Tonnes)', 'Mn Tonne', 'Volume (m³)', 'Chauffeur', 'Téléphone Chauffeur', 'Remise Autorisée', 'Favori', 'Statut'
                  ] : [
                    'Nom et Prénom', 'Téléphone', 'Statut'
                  ]).map((col) => (
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
                  onClick={() => {
                    if (selectedType === 'trucks') {
                      exportTrucksToExcel(trucks, drivers);
                    } else {
                      exportDriversToExcel(drivers);
                    }
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter {selectedType === 'trucks' ? `${trucks.length} Camion(s)` : `${drivers.length} Chauffeur(s)`} (.xlsx)
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
                    <div className="text-xs text-blue-700">Téléchargez le fichier modèle pour structurer vos données de {selectedType === 'trucks' ? 'camions' : 'chauffeurs'}.</div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectedType === 'trucks' ? downloadTrucksTemplate : downloadDriversTemplate}
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
                      <div className="text-xs font-bold text-emerald-700">Nouveaux ajouts</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200">
                      <div className="text-2xl font-black text-blue-600">{importResult.updated}</div>
                      <div className="text-xs font-bold text-blue-700">Éléments mis à jour</div>
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
                          {file ? file.name : `Sélectionner le fichier Excel de ${selectedType === 'trucks' ? 'camions' : 'chauffeurs'}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Formats acceptés : .xlsx, .xls, .csv
                        </p>
                      </div>
                      {file && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg shadow-2xs">
                          <span>{(file.size / 1024).toFixed(1)} Ko</span>
                          <span>•</span>
                          <span>{currentParsedCount} élément(s) détecté(s)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Duplicate Resolution Options */}
                  {currentParsedCount > 0 && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">En cas d'élément existant :</div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="importModeLogistics" 
                            value="merge" 
                            checked={importMode === 'merge'} 
                            onChange={() => setImportMode('merge')} 
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Mettre à jour les informations existantes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="importModeLogistics" 
                            value="skip" 
                            checked={importMode === 'skip'} 
                            onChange={() => setImportMode('skip')} 
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Ignorer les doublons</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Data Preview Table */}
                  {selectedType === 'trucks' && parsedTrucks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span>Aperçu des 5 premiers camions sur {parsedTrucks.length} :</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-48">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Matricule</th>
                              <th className="p-2.5">Marque</th>
                              <th className="p-2.5 text-right">Tare (T)</th>
                              <th className="p-2.5 text-right">Volume (m³)</th>
                              <th className="p-2.5">Chauffeur</th>
                              <th className="p-2.5">Remise</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedTrucks.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-bold text-slate-800">{row.matricule}</td>
                                <td className="p-2.5 text-slate-700">{row.brand || '-'}</td>
                                <td className="p-2.5 text-right font-mono text-blue-700 font-bold">{row.tare?.toFixed(2)} T</td>
                                <td className="p-2.5 text-right font-mono text-amber-800">{row.volumeM3 || '-'} m³</td>
                                <td className="p-2.5 font-semibold text-slate-900">{row.driverName || '-'}</td>
                                <td className="p-2.5 text-slate-600">{row.allowDiscount ? 'Oui' : 'Non'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedType === 'drivers' && parsedDrivers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span>Aperçu des 5 premiers chauffeurs sur {parsedDrivers.length} :</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-48">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Nom et Prénom</th>
                              <th className="p-2.5">Téléphone</th>
                              <th className="p-2.5">Statut</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedDrivers.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-semibold text-slate-900">{row.name}</td>
                                <td className="p-2.5 font-mono text-slate-600">{row.phone || '-'}</td>
                                <td className="p-2.5 text-slate-600">{row.active ? 'Actif' : 'Inactif'}</td>
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
                {currentParsedCount > 0 && !importResult && (
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
                        Confirmer l'import de {currentParsedCount} {selectedType === 'trucks' ? 'Camion(s)' : 'Chauffeur(s)'}
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
