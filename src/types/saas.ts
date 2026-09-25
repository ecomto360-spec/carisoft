export interface SaasLicense {
  licenseKey: string;
  email: string;
  plan: string;
  durationMonths: number;
  machineId: string | null;
  boundAt: string | null;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}

export interface SaasCustomer {
  uid: string; // Document ID
  nom: string;
  email: string;
  telephone: string;
  licenseKeys: string[];
  status: 'essai' | 'actif' | 'expire';
  lastPaymentDate?: string;
}
