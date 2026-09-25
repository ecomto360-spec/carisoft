import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firestore } from '../lib/firebase';
import { X, Send, AlertCircle, CheckCircle } from 'lucide-react';

interface ActivationRequestModalProps {
  onClose: () => void;
  hwid: string;
}

export function ActivationRequestModal({ onClose, hwid }: ActivationRequestModalProps) {
  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    email: '',
    wilaya: '',
    commune: '',
    plan: 'PRO'
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (navigator.onLine) {
        // 1. Enregistrement Firestore
        let docId = '';
        try {
           const docRef = await addDoc(collection(firestore, 'activationRequests'), {
             ...formData,
             hwid,
             status: 'pending',
             dateCreated: serverTimestamp(),
           });
           docId = docRef.id;
        } catch (fsErr) {
           console.warn("Firestore save failed", fsErr);
        }

        // 2. Notification Cloud Function (Graceful fallback if not deployed)
        try {
          const functions = getFunctions();
          const notifyAdmin = httpsCallable(functions, 'notifySuperAdminNewRequest');
          if (docId) await notifyAdmin({ requestId: docId });
        } catch (funcErr) {
          console.warn("Cloud function notifySuperAdminNewRequest not deployed or failed:", funcErr);
        }
      }
      
      // Toujours envoyer l'email (même sans connexion Firebase)
      // On crée un formulaire temporaire dans le DOM et on le soumet
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://formsubmit.co/ecomto360@gmail.com';
      form.target = '_blank'; // Ouvre dans un nouvel onglet pour éviter de bloquer l'app

      const appendField = (name: string, value: string) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
      };

      appendField('_subject', `Nouvelle demande de licence - ${formData.nom}`);
      appendField('_captcha', 'false');
      appendField('_template', 'table');
      appendField("Nom de l'entreprise", formData.nom);
      appendField("Téléphone", formData.telephone);
      appendField("Email Client", formData.email);
      appendField("Wilaya", formData.wilaya);
      appendField("Commune", formData.commune);
      appendField("Identifiant Matériel (HWID)", hwid);
      
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => document.body.removeChild(form), 100);

      if (!firestore) {
        // Fallback local
        const requests = JSON.parse(localStorage.getItem('pending_activation_requests') || '[]');
        requests.push({ ...formData, hwid, dateCreated: new Date().toISOString() });
        localStorage.setItem('pending_activation_requests', JSON.stringify(requests));
      }
      
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError("Une erreur est survenue lors de l'envoi de la demande. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Demande d'Activation</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800">Demande Envoyée !</h3>
            <p className="text-slate-500">
              Votre demande a bien été transmise à l'équipe commerciale. Vous serez contacté sous peu pour finaliser l'activation.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full mt-4">
              <p className="text-sm text-slate-600 mb-2">Pour une assistance immédiate, contactez-nous sur WhatsApp :</p>
              <a 
                href="https://wa.me/213554252579" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium rounded-lg transition-colors w-full"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                +213 554 25 25 79
              </a>
            </div>
            <button 
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium w-full"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom / Entreprise (Carrière)</label>
              <input
                type="text"
                name="nom"
                required
                value={formData.nom}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="Ex: SARL Granulats..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  name="telephone"
                  required
                  value={formData.telephone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="05..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="contact@..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wilaya</label>
                <input
                  type="text"
                  name="wilaya"
                  required
                  value={formData.wilaya}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Commune</label>
                <input
                  type="text"
                  name="commune"
                  required
                  value={formData.commune}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer la demande
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
