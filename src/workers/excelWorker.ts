import * as XLSX from 'xlsx';

// Normalization helper
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

self.onmessage = async (e: MessageEvent) => {
  const { type, buffer } = e.data;

  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (type === 'parseClients') {
      const clients: any[] = [];
      const errors: string[] = [];

      rawRows.forEach((row, index) => {
        const rowNum = index + 2;
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          normalizedRow[normalizeKey(k)] = row[k];
        });

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

        const code =
          normalizedRow['code'] ||
          normalizedRow['codeclient'] ||
          normalizedRow['reference'] ||
          normalizedRow['clientcode'] ||
          `CL-${Math.floor(1000 + Math.random() * 9000)}`;

        const typeVal =
          normalizedRow['type'] ||
          normalizedRow['typecategorie'] ||
          normalizedRow['convention'] ||
          normalizedRow['categorie'] ||
          'DIVERS';

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

        const tvaExemptRaw = String(normalizedRow['exonoretva'] || normalizedRow['exoneretva'] || normalizedRow['tvaexempte'] || '').toUpperCase();
        const tvaExempt = tvaExemptRaw === 'OUI' || tvaExemptRaw === 'YES' || tvaExemptRaw === 'TRUE' || tvaExemptRaw === '1';

        const hidePricesRaw = String(normalizedRow['masquerprixsurbl'] || normalizedRow['masquerprix'] || '').toUpperCase();
        const hidePricesOnDeliveryNote = hidePricesRaw === 'OUI' || hidePricesRaw === 'YES' || hidePricesRaw === 'TRUE' || hidePricesRaw === '1';

        const statusRaw = String(normalizedRow['statut'] || normalizedRow['etat'] || normalizedRow['status'] || 'actif').toLowerCase();
        const active = !statusRaw.includes('inactif') && !statusRaw.includes('false') && !statusRaw.includes('0');

        clients.push({
          code: String(code).trim(),
          name: String(name).trim(),
          type: String(typeVal).trim().toUpperCase(),
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

      self.postMessage({ success: true, data: clients, errors });
    } else if (type === 'parseTrucks') {
      const trucks: any[] = [];
      const errors: string[] = [];

      rawRows.forEach((row, index) => {
        const rowNum = index + 2;
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          normalizedRow[normalizeKey(k)] = row[k];
        });

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

      self.postMessage({ success: true, data: trucks, errors });
    } else if (type === 'parseDrivers') {
      const drivers: any[] = [];
      const errors: string[] = [];

      rawRows.forEach((row, index) => {
        const rowNum = index + 2;
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          normalizedRow[normalizeKey(k)] = row[k];
        });

        const name = String(normalizedRow['nometprenom'] || normalizedRow['nom'] || normalizedRow['chauffeur'] || normalizedRow['name'] || '').trim();
        if (!name) {
          errors.push(`Ligne ${rowNum}: Le nom du chauffeur est obligatoire.`);
          return;
        }

        const phone = String(normalizedRow['telephone'] || normalizedRow['portable'] || normalizedRow['tel'] || normalizedRow['phone'] || '').trim();
        const statusRaw = String(normalizedRow['statut'] || normalizedRow['etat'] || normalizedRow['status'] || 'actif').toLowerCase();
        const active = !statusRaw.includes('inactif') && !statusRaw.includes('false') && !statusRaw.includes('0');

        drivers.push({
          name,
          phone,
          active,
        });
      });

      self.postMessage({ success: true, data: drivers, errors });
    } else {
      self.postMessage({ success: false, error: 'Type d\'opération inconnu' });
    }
  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message || 'Erreur lors de la lecture du fichier Excel' });
  }
};
