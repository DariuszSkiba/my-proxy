require('dotenv').config(); // Wczytaj zmienne środowiskowe z pliku .env

const express = require('express');
const axios = require('axios');
const app = express();

// Wczytywanie zmiennych środowiskowych
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const TOKEN_URI = process.env.TOKEN_URI;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

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

    axios.post(TOKEN_URI, report, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('CSP Report sent successfully:', response.data);
        res.status(200).end();
    })
    .catch(error => {
        console.error('Error sending CSP Report:', error);
        res.status(400).json({ error: 'Error sending CSP Report' });
    });
});

// Endpoint do przesyłania danych do Google Sheets
app.post('/api/submit-data', express.json(), async (req, res) => {
    const dataToSend = req.body.values; // Złożona struktura danych
    try {
        const response = await axios.post(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/scaned_products!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            { values: dataToSend },
            {
                headers: {
                    'Authorization': `Bearer ${REFRESH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.status(200).json({ message: 'Data submitted successfully!', response: response.data });
    } catch (error) {
        console.error('Error submitting data:', error);
        res.status(500).json({ error: 'Error submitting data.' });
    }
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
