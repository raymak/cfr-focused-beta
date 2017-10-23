/* eslint-env node */
var path = require("path");
var webpack = require("webpack");
var ConcatSource = require("webpack-sources").ConcatSource;
var LicenseWebpackPlugin = require("license-webpack-plugin").LicenseWebpackPlugin;

const bundleConfig = {
  context: __dirname,
  entry: "./addon/content/cats/app.jsx",
  output: {
    path: path.resolve(__dirname, "addon/content/cats"),
    filename: "UI.js",
  },
  module: {
    loaders: [
      { test: /\.js$/, loader: "babel-loader", include: __dirname + "/addon/content/cats" },
      { test: /\.jsx$/, loader: "babel-loader",  include: __dirname + "/addon/content/cats" },
    ],
  },
};

const libConfig = {
  context: __dirname,
  entry: {
    React: "./node_modules/react/",
    ReactDOM: "./node_modules/react-dom/",
  },
  output: {
    path: path.resolve(__dirname, "addon/content/vendor"),
    filename: "[name].js",
    library: "[name]",
    libraryTarget: "this",
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify("production"),
      },
    }),
    /**
     * Plugin that appends "this.EXPORTED_SYMBOLS = ["libname"]" to assets
     * output by webpack. This allows built assets to be imported using
     * Cu.import.
     */
    function ExportedSymbols() {
      this.plugin("emit", function(compilation, callback) {
        for (const libraryName in compilation.entrypoints) {
          const assetName = `${libraryName}.js`; // Matches output.filename
          compilation.assets[assetName] = new ConcatSource(
            "/* eslint-disable */", // Disable linting
            compilation.assets[assetName],
            `this.EXPORTED_SYMBOLS = ["${libraryName}"];` // Matches output.library
          );
        }
        callback();
      });
    },
    new LicenseWebpackPlugin({
      pattern: /^(MIT|ISC|MPL.*|Apache.*|BSD.*)$/,
      filename: `LICENSE_THIRDPARTY`,
    }),
  ],
};

module.exports = [
  bundleConfig,
  libConfig,
];
