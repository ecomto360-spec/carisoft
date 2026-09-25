const apiKey = "AIzaSyCJ76-N8DELTU9s97yEfVPeQiqAsopjCt4";
fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'fake@example.com', password: 'fake', returnSecureToken: true })
}).then(res => res.json()).then(console.log);
