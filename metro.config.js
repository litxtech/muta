const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Yerel lobi / medya mp4 asset'leri
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts ?? []), 'mp4', 'mov', 'webm']),
);

module.exports = config;
