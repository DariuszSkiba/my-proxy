// webpack.config.js

const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

dotenv.config(); // Załaduj zmienne środowiskowe z pliku .env

module.exports = {
  mode: 'development', // lub 'production'
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.GOOGLE_API_KEY': JSON.stringify(process.env.GOOGLE_API_KEY),
      'process.env.CLIENT_ID': JSON.stringify(process.env.CLIENT_ID),
      'process.env.SPREADSHEET_ID': JSON.stringify(process.env.SPREADSHEET_ID),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
};
