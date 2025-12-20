const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ogg');
config.resolver.assetExts.push('wav');

module.exports = config;
