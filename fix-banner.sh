sed -i 's/const activeKey = localStorage.getItem('\''active_license_key'\'');/if (!user?.companyId) return;\n      const activeKey = localStorage.getItem(`carisoft_tenant_${user.companyId}_license_key`);/g' src/components/TrialBanner.tsx
sed -i 's/await initializeTrial();/await initializeTrial(user.companyId);/g' src/components/TrialBanner.tsx
sed -i 's/const remaining = await getRemainingTrialDays();/const remaining = await getRemainingTrialDays(user.companyId);/g' src/components/TrialBanner.tsx
sed -i 's/const handleLicenseActivated = () => {/const handleLicenseActivated = (e: any) => {\n      if (e.detail?.companyId === user?.companyId) {/g' src/components/TrialBanner.tsx
sed -i 's/setHasLicense(true);/  setHasLicense(true);\n      }/g' src/components/TrialBanner.tsx
sed -i 's/, \[\]);/, \[user?.companyId\]);/g' src/components/TrialBanner.tsx
