const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

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

app.use('/api', createProxyMiddleware({
  target: 'https://world.openfoodfacts.org',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  }
}));

app.listen(3000, () => {
  console.log('Proxy running on port 3000');
});
