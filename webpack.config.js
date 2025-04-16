/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');
const fs = require('fs');
const VirtualModulesPlugin = require('webpack-virtual-modules');

const wasmFiles = {
  "3.4": path.resolve(__dirname, 'node_modules/@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm'),
  "3.3": path.resolve(__dirname, 'node_modules/@ruby/3.3-wasm-wasi/dist/ruby+stdlib.wasm'),
  "3.2": path.resolve(__dirname, 'node_modules/@ruby/3.2-wasm-wasi/dist/ruby+stdlib.wasm'),
};

const virtualModules = new VirtualModulesPlugin(
  Object.fromEntries(Object.entries(wasmFiles).map(([version, filePath]) => {
    const wasm = fs.readFileSync(filePath).toString('base64');
    const content = `
      const binaryString = atob("${wasm}");
      const wasm = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wasm[i] = binaryString.charCodeAt(i);
      }
      module.exports = { wasm };
    `;
    return [`node_modules/wasm-${version}.js`, content];
  }))
);

module.exports = {
  mode: 'none',
  target: 'webworker',
  entry: {
    extension: './src/web/extension.ts',
    'test/suite/index': './src/web/test/suite/index.ts',
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './dist/web'),
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]',
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js'],
    alias: {},
    fallback: {
      assert: require.resolve('assert'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    virtualModules,
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  externals: {
    vscode: 'commonjs vscode',
  },
  performance: {
    hints: false,
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};
