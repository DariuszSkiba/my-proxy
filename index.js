const express = require('express');
const axios = require('axios');
const app = express();

const corsOptions = {
    origin: 'https://www-servicesdim-com.filesusr.com',
    methods: 'GET, OPTIONS',
    allowedHeaders: 'Content-Type'
};

// Middleware do ustawiania nagłówków CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', corsOptions.origin);
    res.header('Access-Control-Allow-Methods', corsOptions.methods);
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders);
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.get('/api/*', async (req, res) => {
    try {
        const apiUrl = req.originalUrl.replace('/api/', ''); // Wyodrębnij właściwy URL
        const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${apiUrl}.json`);
        res.send(response.data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy error');
    }
});

app.listen(3000, () => {
    console.log('Proxy running on port 3000');
});
