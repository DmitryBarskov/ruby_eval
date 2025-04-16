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
