const fs = require('fs');

const path = 'src/components/layout/Header.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `  const isTrial = settings?.licensePlan?.includes('Essai') || settings?.licensePlan?.includes('3 Jours');
  const expiryDays = settings?.licenseExpiry 
    ? Math.max(0, Math.ceil((new Date(settings.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 365;`;

const newLogic = `  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const hasLicense = Boolean(localStorage.getItem('active_license_key'));

  useEffect(() => {
    if (!hasLicense && !isSuperAdmin) {
      import('../../lib/trialManager').then(({ getRemainingTrialDays }) => {
        getRemainingTrialDays().then(setTrialDaysLeft);
      });
    }
  }, [hasLicense, isSuperAdmin]);

  const isTrial = !hasLicense;
  const expiryDays = hasLicense && settings?.licenseExpiry 
    ? Math.max(0, Math.ceil((new Date(settings.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : (trialDaysLeft !== null ? trialDaysLeft : 5);`;

content = content.replace(oldLogic, newLogic);

fs.writeFileSync(path, content);
console.log("Updated Header.tsx for trial");
