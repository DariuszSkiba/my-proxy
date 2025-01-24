const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const primaryTarget = 'https://world.openfoodfacts.org';
const secondaryTarget = 'https://ssl-api.openfoodfacts.org';

const apiProxy = createProxyMiddleware({
  target: primaryTarget,
  changeOrigin: true,
  onError: (err, req, res, target) => {
    console.error(`Proxy error with ${target}:`, err);
    if (target === primaryTarget) {
      // Fallback to secondary target
      apiProxy.target = secondaryTarget;
      console.log(`Switching to secondary target: ${secondaryTarget}`);
    }
    res.status(500).send('Proxy error');
  }
});

app.use('/api', apiProxy);

app.listen(3000, () => {
  console.log('Proxy running on port 3000');
});
