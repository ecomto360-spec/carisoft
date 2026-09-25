import * as XLSX from 'xlsx';
import { Customer, Truck, Driver } from '../types';

// Helper to normalize keys for matching
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ''); // keep alphanumeric only
}

// -------------------------------------------------------------
// CLIENTS EXCEL
// -------------------------------------------------------------

export function exportClientsToExcel(clients: Customer[], filename?: string) {
  const data = clients.map((c) => ({
    'Code Client': c.code,
    'Nom / Raison Sociale': c.name,
    'Type / Catégorie': c.type || 'DIVERS',
    'Téléphone': c.phone || '',
    'Mobile': c.mobile || '',
    'Email': c.email || '',
    'Adresse': c.address || '',
    'N° Registre Commerce (RC)': c.rc || '',
    'NIF': c.nif || '',
    'NIS': c.nis || '',
    'Article d\'Imposition (AI)': c.article || '',
    'Banque / N° Compte': c.bank || '',
    'Dette Initiale (DA)': c.initialDebt || 0,
    'Plafond Crédit (DA)': c.creditLimit || 0,
    'Solde Actuel (DA)': c.balance || 0,
    'Exonéré TVA': c.tvaExempt ? 'OUI' : 'NON',
    'Masquer Prix sur BL': c.hidePricesOnDeliveryNote ? 'OUI' : 'NON',
    'Statut': c.active !== false ? 'Actif' : 'Inactif',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Code
    { wch: 30 }, // Nom
    { wch: 18 }, // Type
    { wch: 16 }, // Tel
    { wch: 16 }, // Mobile
    { wch: 22 }, // Email
    { wch: 30 }, // Adresse
    { wch: 20 }, // RC
    { wch: 20 }, // NIF
    { wch: 20 }, // NIS
    { wch: 18 }, // AI
    { wch: 25 }, // Banque
    { wch: 18 }, // Dette Initiale
    { wch: 18 }, // Plafond
    { wch: 18 }, // Solde
    { wch: 14 }, // Exonere TVA
    { wch: 20 }, // Masquer Prix
    { wch: 12 }, // Statut
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  const fname = filename || `Clients_CARISOFT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function downloadClientsTemplate() {
  const sample = [
    {
      'Code Client': 'CL-1001',
      'Nom / Raison Sociale': 'ENTREPRISE TRAVAUX PUBLICS SARL',
      'Type / Catégorie': 'CONV1',
      'Téléphone': '026123456',
      'Mobile': '0550123456',
      'Email': 'contact@etp-dz.com',
      'Adresse': 'Zone Industrielle, Bouira',
      'N° Registre Commerce (RC)': '10B0123456',
      'NIF': '001016012345678',
      'NIS': '0010160123456',
      'Article d\'Imposition (AI)': '10012345678',
      'Banque / N° Compte': 'BEA 002 00012 1234567890 12',
      'Dette Initiale (DA)': 0,
      'Plafond Crédit (DA)': 500000,
      'Exonéré TVA': 'NON',
      'Masquer Prix sur BL': 'NON',
      'Statut': 'Actif'
    },
    {
      'Code Client': 'CL-1002',
      'Nom / Raison Sociale': 'BENALI MOHAMED',
      'Type / Catégorie': 'DIVERS',
      'Téléphone': '0555987654',
      'Mobile': '0661987654',
      'Email': '',
      'Adresse': 'El Hachimia, Bouira',
      'N° Registre Commerce (RC)': '',
      'NIF': '',
      'NIS': '',
      'Article d\'Imposition (AI)': '',
      'Banque / N° Compte': '',
      'Dette Initiale (DA)': 50000,
      'Plafond Crédit (DA)': 0,
      'Exonéré TVA': 'NON',
      'Masquer Prix sur BL': 'NON',
      'Statut': 'Actif'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [
    { wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 20 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modele_Clients');
  XLSX.writeFile(wb, 'Modele_Import_Clients_CARISOFT.xlsx');
}

export async function parseClientsFromExcel(file: File): Promise<{
  clients: Partial<Customer>[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const clients: Partial<Customer>[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // header is line 1
          const normalizedRow: Record<string, any> = {};
          
          Object.keys(row).forEach((k) => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          // Match Name
          const name = 
            normalizedRow['nom'] ||
            normalizedRow['nomraisonsociale'] ||
            normalizedRow['raisonsociale'] ||
            normalizedRow['client'] ||
            normalizedRow['name'] ||
            normalizedRow['nomduclient'] ||
            '';

          if (!name || String(name).trim() === '') {
            errors.push(`Ligne ${rowNum}: Le nom ou la raison sociale est obligatoire.`);
            return;
          }

          // Match Code
          const code = 
            normalizedRow['code'] ||
            normalizedRow['codeclient'] ||
            normalizedRow['reference'] ||
            normalizedRow['clientcode'] ||
            `CL-${Math.floor(1000 + Math.random() * 9000)}`;

          // Match Type
          const type = 
            normalizedRow['type'] ||
            normalizedRow['typecategorie'] ||
            normalizedRow['convention'] ||
            normalizedRow['categorie'] ||
            'DIVERS';

          // Match Numbers
          const initialDebt = parseFloat(
            String(normalizedRow['detteinitiale'] || normalizedRow['dette'] || normalizedRow['dettedepart'] || 0)
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || 0;

          const creditLimit = parseFloat(
            String(normalizedRow['plafondcredit'] || normalizedRow['plafond'] || normalizedRow['limitcredit'] || 0)
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || 0;

          const balance = parseFloat(
            String(normalizedRow['soldeactuel'] || normalizedRow['solde'] || normalizedRow['balance'] || (-initialDebt))
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || (-initialDebt);

          // Match Booleans
          const tvaExemptRaw = String(normalizedRow['exonoretva'] || normalizedRow['exoneretva'] || normalizedRow['tvaexempte'] || '').toUpperCase();
          const tvaExempt = tvaExemptRaw === 'OUI' || tvaExemptRaw === 'YES' || tvaExemptRaw === 'TRUE' || tvaExemptRaw === '1';

          const hidePricesRaw = String(normalizedRow['masquerprixsurbl'] || normalizedRow['masquerprix'] || '').toUpperCase();
          const hidePricesOnDeliveryNote = hidePricesRaw === 'OUI' || hidePricesRaw === 'YES' || hidePricesRaw === 'TRUE' || hidePricesRaw === '1';

          const statusRaw = String(normalizedRow['statut'] || normalizedRow['etat'] || normalizedRow['status'] || 'actif').toLowerCase();
          const active = !statusRaw.includes('inactif') && !statusRaw.includes('false') && !statusRaw.includes('0');

          clients.push({
            code: String(code).trim(),
            name: String(name).trim(),
            type: String(type).trim().toUpperCase(),
            phone: String(normalizedRow['telephone'] || normalizedRow['tel'] || normalizedRow['phone'] || '').trim(),
            mobile: String(normalizedRow['mobile'] || normalizedRow['portable'] || normalizedRow['gsm'] || '').trim(),
            email: String(normalizedRow['email'] || normalizedRow['mail'] || '').trim(),
            address: String(normalizedRow['adresse'] || normalizedRow['address'] || '').trim(),
            rc: String(normalizedRow['nregistrecommerce'] || normalizedRow['rc'] || normalizedRow['registrecommerce'] || '').trim(),
            nif: String(normalizedRow['nif'] || normalizedRow['identifiantfiscal'] || '').trim(),
            nis: String(normalizedRow['nis'] || '').trim(),
            article: String(normalizedRow['articledimposition'] || normalizedRow['article'] || normalizedRow['ai'] || '').trim(),
            bank: String(normalizedRow['banquencompte'] || normalizedRow['banque'] || normalizedRow['compte'] || normalizedRow['rib'] || '').trim(),
            familyId: 'CONV1',
            initialDebt,
            creditLimit,
            balance,
            tvaExempt,
            hidePricesOnDeliveryNote,
            active,
          });
        });

        resolve({ clients, errors });
      } catch (err: any) {
        reject(new Error(err?.message || 'Erreur lors de la lecture du fichier Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}

// -------------------------------------------------------------
// TRUCKS & DRIVERS EXCEL
// -------------------------------------------------------------

export function exportTrucksToExcel(trucks: Truck[], drivers: Driver[], filename?: string) {
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  const data = trucks.map((t) => {
    const driver = t.driverId ? driverMap.get(t.driverId) : null;
    const driverName = t.driverName || driver?.name || '';
    const driverPhone = t.driverPhone || driver?.phone || '';

    return {
      'Matricule': t.matricule,
      'Marque': t.brand || '',
      'Tare (Tonnes)': t.tare || 0,
      'Mn Tonne': t.mnTonne || 0,
      'Volume (m³)': t.volumeM3 || 0,
      'Chauffeur': driverName,
      'Téléphone Chauffeur': driverPhone,
      'Remise Autorisée': t.allowDiscount ? 'OUI' : 'NON',
      'Favori': t.isFavorite ? 'OUI' : 'NON',
      'Statut': t.active !== false ? 'Actif' : 'Inactif',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 18 }, // Matricule
    { wch: 18 }, // Marque
    { wch: 15 }, // Tare
    { wch: 12 }, // Mn Tonne
    { wch: 14 }, // Volume
    { wch: 25 }, // Chauffeur
    { wch: 20 }, // Tel
    { wch: 18 }, // Remise
    { wch: 12 }, // Favori
    { wch: 12 }, // Statut
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Camions');
  const fname = filename || `Camions_CARISOFT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function downloadTrucksTemplate() {
  const sample = [
    {
      'Matricule': '0018421310',
      'Marque': 'SHACMAN',
      'Tare (Tonnes)': 15.94,
      'Mn Tonne': 0,
      'Volume (m³)': 18,
      'Chauffeur': 'BENDAOUD ALI',
      'Téléphone Chauffeur': '0550112233',
      'Remise Autorisée': 'NON',
      'Favori': 'OUI',
      'Statut': 'Actif'
    },
    {
      'Matricule': '0000151416',
      'Marque': 'RENAULT KERAX',
      'Tare (Tonnes)': 14.56,
      'Mn Tonne': 0,
      'Volume (m³)': 16,
      'Chauffeur': 'AMRANE BRAHIM',
      'Téléphone Chauffeur': '0661445566',
      'Remise Autorisée': 'OUI',
      'Favori': 'NON',
      'Statut': 'Actif'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 14 },
    { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modele_Camions');
  XLSX.writeFile(wb, 'Modele_Import_Camions_CARISOFT.xlsx');
}

export async function parseTrucksFromExcel(file: File): Promise<{
  trucks: Partial<Truck>[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const trucks: Partial<Truck>[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2;
          const normalizedRow: Record<string, any> = {};
          
          Object.keys(row).forEach((k) => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          // Match Matricule
          const matricule = 
            normalizedRow['matricule'] ||
            normalizedRow['matriculation'] ||
            normalizedRow['immatriculation'] ||
            normalizedRow['nmatricule'] ||
            normalizedRow['truck'] ||
            normalizedRow['camion'] ||
            '';

          if (!matricule || String(matricule).trim() === '') {
            errors.push(`Ligne ${rowNum}: Le matricule du camion est obligatoire.`);
            return;
          }

          // Match Tare
          const tare = parseFloat(
            String(normalizedRow['tare'] || normalizedRow['taretonnes'] || normalizedRow['poidsvide'] || 0)
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || 0;

          const mnTonne = parseFloat(
            String(normalizedRow['mntonne'] || normalizedRow['mnt'] || 0)
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || 0;

          const volumeM3 = parseFloat(
            String(normalizedRow['volumem3'] || normalizedRow['volume'] || normalizedRow['metrecube'] || normalizedRow['m3'] || 0)
              .replace(/\s+/g, '')
              .replace(',', '.')
          ) || 0;

          const driverName = String(normalizedRow['chauffeur'] || normalizedRow['nomchauffeur'] || normalizedRow['driver'] || '').trim();
          const driverPhone = String(normalizedRow['telephonechauffeur'] || normalizedRow['telephone'] || normalizedRow['telchauffeur'] || normalizedRow['phone'] || '').trim();
          const brand = String(normalizedRow['marque'] || normalizedRow['brand'] || normalizedRow['modele'] || '').trim();

          const discountRaw = String(normalizedRow['remiseautorisee'] || normalizedRow['remise'] || '').toUpperCase();
          const allowDiscount = discountRaw === 'OUI' || discountRaw === 'YES' || discountRaw === 'TRUE' || discountRaw === '1';

          const favoriteRaw = String(normalizedRow['favori'] || normalizedRow['favorite'] || '').toUpperCase();
          const isFavorite = favoriteRaw === 'OUI' || favoriteRaw === 'YES' || favoriteRaw === 'TRUE' || favoriteRaw === '1';

          const statusRaw = String(normalizedRow['statut'] || normalizedRow['etat'] || normalizedRow['status'] || 'actif').toLowerCase();
          const active = !statusRaw.includes('inactif') && !statusRaw.includes('false') && !statusRaw.includes('0');

          trucks.push({
            matricule: String(matricule).trim().toUpperCase(),
            brand,
            tare,
            mnTonne,
            volumeM3,
            driverName,
            driverPhone,
            allowDiscount,
            isFavorite,
            active,
          });
        });

        resolve({ trucks, errors });
      } catch (err: any) {
        reject(new Error(err?.message || 'Erreur lors de la lecture du fichier Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}

// -------------------------------------------------------------
// DRIVERS EXCEL
// -------------------------------------------------------------

export function exportDriversToExcel(drivers: Driver[], filename?: string) {
  const data = drivers.map((d) => ({
    'Nom et Prénom': d.name,
    'Téléphone': d.phone || '',
    'Statut': d.active !== false ? 'Actif' : 'Inactif',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 30 }, // Nom
    { wch: 20 }, // Tel
    { wch: 15 }, // Statut
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Chauffeurs');
  const fname = filename || `Chauffeurs_CARISOFT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function downloadDriversTemplate() {
  const sample = [
    {
      'Nom et Prénom': 'BENALI MOHAMED',
      'Téléphone': '0550123456',
      'Statut': 'Actif'
    },
    {
      'Nom et Prénom': 'HADJI KARIM',
      'Téléphone': '0661987654',
      'Statut': 'Actif'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modele_Chauffeurs');
  XLSX.writeFile(wb, 'Modele_Import_Chauffeurs_CARISOFT.xlsx');
}

export async function parseDriversFromExcel(file: File): Promise<{
  drivers: Partial<Driver>[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const drivers: Partial<Driver>[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2;
          const normalizedRow: Record<string, any> = {};
          
          Object.keys(row).forEach((k) => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          const name = 
            normalizedRow['nometprenom'] ||
            normalizedRow['nom'] ||
            normalizedRow['chauffeur'] ||
            normalizedRow['name'] ||
            '';

          if (!name || String(name).trim() === '') {
            errors.push(`Ligne ${rowNum}: Le nom du chauffeur est obligatoire.`);
            return;
          }

          const phone = String(normalizedRow['telephone'] || normalizedRow['tel'] || normalizedRow['phone'] || normalizedRow['mobile'] || '').trim();
          const statusRaw = String(normalizedRow['statut'] || normalizedRow['etat'] || normalizedRow['status'] || 'actif').toLowerCase();
          const active = !statusRaw.includes('inactif') && !statusRaw.includes('false') && !statusRaw.includes('0');

          drivers.push({
            name: String(name).trim(),
            phone,
            active,
          });
        });

        resolve({ drivers, errors });
      } catch (err: any) {
        reject(new Error(err?.message || 'Erreur lors de la lecture du fichier Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}
