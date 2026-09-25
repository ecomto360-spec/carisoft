fetch("https://formsubmit.co/ajax/1d8f000d7766125dec09eac45dedaecc", {
    method: "POST",
    headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': 'https://localhost:3000'
    },
    body: JSON.stringify({
        _subject: `Test AJAX CORS`,
        "Email": "test@test.com"
    })
}).then(res => res.json()).then(console.log).catch(console.error);
