const { default: fbConfig } = await import('./firebase-applet-config.json', { with: { type: "json" } });
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbConfig.apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'gudblida@aapi.dz', password: '123456', returnSecureToken: true })
});
const data = await response.json();
console.log(data);
