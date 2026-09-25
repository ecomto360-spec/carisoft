import React, { useState } from 'react';
import { 
  X, Bug, CheckCircle2, Clock, Trash2, Filter, 
  ExternalLink, Search, Download, AlertTriangle 
} from 'lucide-react';
import { useAnomalyStore, AnomalyReport } from '../../store/anomalyStore';

export function AnomalyListModal() {
  const { 
    isListModalOpen, 
    closeListModal, 
    anomalies, 
    updateAnomalyStatus, 
    deleteAnomaly, 
    clearAll 
  } = useAnomalyStore();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyReport | null>(null);

  if (!isListModalOpen) return null;

  const filtered = anomalies.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q) ||
        (item.reporterName && item.reporterName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(anomalies, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `carisoft_anomalies_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Anomalies & Retours Démo</h3>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {anomalies.length} signalement{anomalies.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Suivi des retours et anomalies remontés par les clients testeurs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {anomalies.length > 0 && (
              <button
                type="button"
                onClick={exportToJson}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Exporter en JSON"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeListModal}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par titre, module, client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="nouveau">Nouveaux</option>
              <option value="en_cours">En cours d'analyse</option>
              <option value="resolu">Résolus / Corrigés</option>
            </select>

            {anomalies.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Voulez-vous vraiment effacer tous les signalements d'anomalies ?")) {
                    clearAll();
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ml-2"
                title="Vider la liste"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <h4 className="font-semibold text-slate-700 text-sm">Aucune anomalie signalée</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {anomalies.length === 0 
                  ? "Aucun client n'a encore transmis d'anomalie. Donnez-leur le lien démo pour tester."
                  : "Aucun résultat ne correspond à votre filtre de recherche."}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div 
                key={item.id} 
                className="p-4 hover:bg-slate-50/80 transition-colors rounded-xl space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        item.severity === 'bloquant' ? 'bg-red-100 text-red-700 border border-red-200' :
                        item.severity === 'moyen' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        item.severity === 'mineur' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.module}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.title}
                    </h4>
                  </div>

                  {/* Status Badges & Switcher */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => updateAnomalyStatus(item.id, e.target.value as any)}
                      className={`text-xs font-semibold rounded-lg px-2 py-1 border cursor-pointer ${
                        item.status === 'resolu' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                        item.status === 'en_cours' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                        'bg-blue-50 text-blue-700 border-blue-300'
                      }`}
                    >
                      <option value="nouveau">Nouveau</option>
                      <option value="en_cours">En cours</option>
                      <option value="resolu">Résolu</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => deleteAnomaly(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {item.description}
                </p>

                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-3">
                    {item.reporterName && (
                      <span>👤 Par : <strong>{item.reporterName}</strong></span>
                    )}
                    {item.reporterContact && (
                      <span>📞 Contact : <strong>{item.reporterContact}</strong></span>
                    )}
                  </div>
                  {item.currentUrl && (
                    <span className="text-slate-400 font-mono text-[10px]">
                      Écran : {item.currentUrl}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Total : <strong>{filtered.length}</strong> anomalie(s)</span>
          <button
            type="button"
            onClick={closeListModal}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
