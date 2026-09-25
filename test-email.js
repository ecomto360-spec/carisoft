fetch("https://formsubmit.co/ajax/ecomto360@gmail.com", {
    method: "POST",
    headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        _subject: `Test de vérification`,
        "Email": "test@test.com"
    })
}).then(res => res.json()).then(console.log).catch(console.error);
