const express = require('express');
const axios = require('axios');
const app = express();

const corsOptions = {
    origin: '*',
    methods: 'GET, POST, OPTIONS',
    allowedHeaders: 'Content-Type'
};

// Middleware to set CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods);
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders);
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Logowanie zapytań
app.use((req, res, next) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    next();
});

app.get('/api/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const apiUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
        console.log(`Fetching from API: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
        res.json(response.data); // Ensure the response is JSON
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Proxy error' }); // Return JSON error response
    }
});

// Endpoint do przetwarzania raportów CSP
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
    const report = req.body;
    console.log('Received CSP Report:', report);

    axios.post('https://accounts.google.com/_/IdpIFrameHttp/cspreport/fine-allowlist', report)
        .then(response => {
            console.log('CSP Report sent successfully:', response.data);
            res.status(200).end();
        })
        .catch(error => {
            console.error('Error sending CSP Report:', error);
            res.status(400).json({ error: 'Error sending CSP Report' });
        });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.send('I, Proxy Server, am still staying to watch for your safety!');
});

// Uruchomienie serwera na porcie 3000 lub zmiennej środowiskowej PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});
