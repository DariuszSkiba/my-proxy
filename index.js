const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/api', createProxyMiddleware({
  target: 'http://example.com', // adres docelowy proxy
  changeOrigin: true,
}));

app.listen(3000, () => {
  console.log('Proxy running on port 3000');
});
