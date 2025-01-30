require('dotenv').config(); // Wczytaj zmienne środowiskowe z pliku .env

const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');


const corsOptions = {
    origin: ['https://servicesdim.com', 'https://www-servicesdim-com.filesusr.com'],
    methods: 'GET,PUT,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Content-Length, X-Requested-With'
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods);
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders);
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});


app.use(express.json()); // Middleware do parsowania JSON request bodies

// Proxy dla /greenroom
app.use('/greenroom', async (req, res) => {
    try {
        const url = 'https://www.servicesdim.com/greenroom' + req.url;
        console.log(`Proxying request to: ${url}`); // Logowanie URL docelowego
        const config = {
            method: req.method,
            url: url,
            headers: {}
        };

        if (req.method !== 'GET') {
            config.data = req.body;
        }

        const response = await axios(config);

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('Error proxying request:', error.message);
        if (error.response) {
            console.log("Error details:", error.response.data);
        } else {
            console.log("Error details:", error);
        }
        res.status(500).send(`Error proxying request: ${error.message}`);
    }
});

// Endpoint do przekierowania OAuth
app.get('/api/auth', (req, res) => {
    const code = req.query.code;
    if (code) {
        res.send('Authorization successful. Code: ' + code);
    } else {
        res.send('No code received.');
    }
});

// Funkcja do odświeżenia tokenu dostępu
async function refreshAccessToken() {
    try {
        const response = await axios.post(process.env.TOKEN_URI, {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            refresh_token: process.env.REFRESH_TOKEN,
            grant_type: 'refresh_token',
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to refresh access token');
    }
}

app.get('/api/read-data', async (req, res) => {
    try {
        const accessToken = await refreshAccessToken();
        console.log('Access Token:', accessToken); // Logowanie tokena
        const response = await axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SPREADSHEET_ID}/values/products!A:J`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Response data:', response.data); // Logowanie odpowiedzi
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error reading data:', error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 403) {
            res.status(403).json({ error: 'Access to the resource is forbidden.' });
        } else {
            res.status(500).json({ error: 'Error reading data.' });
        }
    }
});


// Endpoint do przesyłania danych do Google Sheets
app.post('/api/submit-data', async (req, res) => {
    const rawData = req.body;
    console.log("Received full request body:", JSON.stringify(rawData, null, 2)); // Logowanie całego żądania
    console.log("CLIENT_ID:", process.env.CLIENT_ID);
    console.log("SPREADSHEET_ID:", process.env.SPREADSHEET_ID);

    // Dodanie pustych kolumn do danych
    const dataToSend = rawData.map(row => {
        return [
            row[0], // Lp
            row[1], // Name
            row[2], // Quantity
            row[3], // Barcode
            "",     // Pusta kolumna Photo
            row[4], // ScannedData
            "",     // Pusta kolumna removed_data
            "",     // Kolumna column1
            "",     // Kolumna column2
            ""      // Kolumna column3
        ];
    });

    console.log("Received data to submit:", JSON.stringify(dataToSend, null, 2)); // Logowanie danych przed wysłaniem

    try {
        const accessToken = await refreshAccessToken();
        console.log("Access Token:", accessToken); // Logowanie tokenu dostępu
        const response = await axios.post(
            `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SPREADSHEET_ID}/values/products!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            { values: dataToSend },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("Data submitted successfully:", response.data);
        res.status(200).json({ message: 'Data submitted successfully!', response: response.data });
    } catch (error) {
        console.error('Error submitting data:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.log("Error details:", error.response.data);
        }
        res.status(500).json({ error: 'Error submitting data.' });
    }
});


app.post('/api/write-data', async (req, res) => {
    const { values } = req.body;
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetId = parseInt(process.env.SHEETID_PRODUCTS, 10); // Upewnij się, że to jest liczba całkowita
    console.log('Sheet ID:', sheetId);

    if (!values || !Array.isArray(values)) {
        console.error("Invalid data format. Expected an array.");
        return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
    }

    try {
        const accessToken = await refreshAccessToken();
        console.log('Access Token:', accessToken);

        const headers = ["Lp", "Name", "quantiti", "barcode", "Photo", "scannedData", "modified_data", "column1", "column2", "column3"];
        const existingHeadersResponse = await axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/products!A1:J1`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Existing Headers Response:', existingHeadersResponse.data);

        let dataToSend = [];
        if (!existingHeadersResponse.data.values || existingHeadersResponse.data.values[0].join() !== headers.join()) {
            dataToSend.push(headers);
        }

        dataToSend = dataToSend.concat(values.map((row, index) => [
            index + 1,
            row[1],
            row[2],
            row[3],
            row[4],
            row[5],
            row[6],
            row[7],
            row[8],
            row[9]
        ]));
        console.log('Data to Send:', dataToSend);

        // Wyczyść istniejące dane w arkuszu
        await axios.post(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
                requests: [
                    {
                        updateCells: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 1,
                                endRowIndex: 1000
                            },
                            fields: "userEnteredValue"
                        }
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Zapisz nowe dane do arkusza
        const response = await axios.put(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/products!A2:J?valueInputOption=USER_ENTERED`,
            { values: dataToSend },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ message: 'Data updated successfully!', response: response.data });
    } catch (error) {
        console.error('Error writing data:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error writing data.' });
    }
});




// Proxy dla /greenroom
app.use('/greenroom', async (req, res) => {
    try {
        const url = 'https://www.servicesdim.com/removeproducts' + req.url;
        console.log(`Proxying request to: ${url}`); // Logowanie URL docelowego
        const config = {
            method: req.method,
            url: url,
            headers: req.headers // Użyj nagłówków z żądania
        };

        if (req.method !== 'GET') {
            config.data = req.body;
        }

        const response = await axios(config);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        console.log('Response data:', response.data);

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('Error proxying request:', error.message);
        if (error.response) {
            console.log("Error details:", error.response.data);
        } else {
            console.log("Error details:", error);
        }
        res.status(500).send(`Error proxying request: ${error.message}`);
    }
});



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

// Endpoint do sprawdzania zdrowia serwera
app.get('/health', (req, res) => {
    res.send('I, Proxy Server am still staying to watch for your safety!');
});

// Uruchomienie serwera na porcie 3000 lub zmiennej środowiskowej PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});
