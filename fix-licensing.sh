sed -i 's/export const activateLicense = async (rawKey: string): Promise<void> => {/export const activateLicense = async (rawKey: string, companyId: string): Promise<void> => {\n  if (!companyId) throw new Error("companyId manquant");/g' src/lib/licensing.ts
sed -i "s/localStorage.setItem('active_license_key', rawKey);/localStorage.setItem(\`carisoft_tenant_\${companyId}_license_key\`, rawKey);/g" src/lib/licensing.ts
sed -i "s/localStorage.setItem('active_license_key', newKey);/localStorage.setItem(\`carisoft_tenant_\${companyId}_license_key\`, newKey);/g" src/lib/licensing.ts
sed -i "s/localStorage.setItem('pending_license_sync', rawKey);/localStorage.setItem(\`carisoft_tenant_\${companyId}_pending_license_sync\`, rawKey);/g" src/lib/licensing.ts

sed -i 's/export const syncPendingBinding = async () => {/export const syncPendingBinding = async (companyId: string) => {\n  if (!companyId) return;/g' src/lib/licensing.ts
sed -i "s/localStorage.getItem('pending_license_sync');/localStorage.getItem(\`carisoft_tenant_\${companyId}_pending_license_sync\`);/g" src/lib/licensing.ts
sed -i "s/localStorage.removeItem('pending_license_sync');/localStorage.removeItem(\`carisoft_tenant_\${companyId}_pending_license_sync\`);/g" src/lib/licensing.ts
