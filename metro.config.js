const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's browser worker imports its bundled SQLite WebAssembly binary.
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
