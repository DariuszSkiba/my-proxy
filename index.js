require('dotenv').config(); // Wczytaj zmienne środowiskowe z pliku .env

const express = require('express');
const axios = require('axios');
const app = express();

const corsOptions = {
    origin: 'https://www-servicesdim-com.filesusr.com', // Zastąp swoją domeną Wix
    methods: 'GET, POST, OPTIONS',
    allowedHeaders: 'Content-Type'
};

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods);
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders);
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json()); // Middleware do parsowania JSON request bodies

// Endpoint do uzyskiwania informacji o produkcie
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

    axios.post(process.env.TOKEN_URI, report, {
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
app.post('/api/submit-data', async (req, res) => {
    const dataToSend = req.body.values;
    console.log("Received data to submit:", dataToSend); // Logowanie danych
    console.log("CLIENT_ID:", process.env.CLIENT_ID); // Logowanie CLIENT_ID
    console.log("SPREADSHEET_ID:", process.env.SPREADSHEET_ID); // Logowanie SPREADSHEET_ID

    try {
        const response = await axios.post(
            `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SPREADSHEET_ID}/values/scaned_products!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            { values: dataToSend },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.REFRESH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("Data submitted successfully:", response.data); // Logowanie odpowiedzi
        res.status(200).json({ message: 'Data submitted successfully!', response: response.data });
    } catch (error) {
        console.error('Error submitting data:', error.response ? error.response.data : error.message); // Logowanie błędu
        res.status(500).json({ error: 'Error submitting data.' });
    }
});

// Endpoint do sprawdzania zdrowia serwera
app.get('/health', (req, res) => {
    res.send('I, Proxy Server, am still staying to watch for your safety!');
});

// Uruchomienie serwera na porcie 3000 lub zmiennej środowiskowej PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});
