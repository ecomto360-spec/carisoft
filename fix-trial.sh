sed -i 's/const readTauriFile = async (): Promise<string | null> => {/const getTenantTrialKey = (companyId: string) => `carisoft_tenant_${companyId}_trial_blob`;\n\nconst readTauriFile = async (companyId: string): Promise<string | null> => {/g' src/lib/trialManager.ts
sed -i "s/return localStorage.getItem('carisoft_trial_blob');/return localStorage.getItem(getTenantTrialKey(companyId));/g" src/lib/trialManager.ts

sed -i 's/const writeTauriFile = async (content: string): Promise<void> => {/const writeTauriFile = async (companyId: string, content: string): Promise<void> => {/g' src/lib/trialManager.ts
sed -i "s/localStorage.setItem('carisoft_trial_blob', content);/localStorage.setItem(getTenantTrialKey(companyId), content);/g" src/lib/trialManager.ts

sed -i 's/export const initializeTrial = async (): Promise<void> => {/export const initializeTrial = async (companyId: string): Promise<void> => {\n  if (!companyId) return;/g' src/lib/trialManager.ts
sed -i 's/let blob = await readTauriFile();/let blob = await readTauriFile(companyId);/g' src/lib/trialManager.ts
sed -i 's/await writeTauriFile(blob);/await writeTauriFile(companyId, blob);/g' src/lib/trialManager.ts
sed -i "s/localStorage.setItem('trial_start_date', now.toString());/localStorage.setItem(\`carisoft_tenant_\${companyId}_trial_start\`, now.toString());/g" src/lib/trialManager.ts
sed -i 's/await registerTrial({ hwid, trialStart: now });/await registerTrial({ hwid, trialStart: now, companyId });/g' src/lib/trialManager.ts

sed -i 's/export const getRemainingTrialDays = async (): Promise<number> => {/export const getRemainingTrialDays = async (companyId: string): Promise<number> => {\n  if (!companyId) return 0;/g' src/lib/trialManager.ts
sed -i 's/export const isTrialExpired = async (): Promise<boolean> => {/export const isTrialExpired = async (companyId: string): Promise<boolean> => {/g' src/lib/trialManager.ts
sed -i 's/const days = await getRemainingTrialDays();/const days = await getRemainingTrialDays(companyId);/g' src/lib/trialManager.ts
