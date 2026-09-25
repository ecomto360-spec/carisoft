fetch("https://formsubmit.co/ecomto360@gmail.com", {
    method: "POST",
    headers: {
        'Accept': 'application/json'
    },
    body: new URLSearchParams({
        _subject: "Activation",
        email: "test@test.com"
    })
}).then(res => res.text()).then(console.log).catch(console.error);
