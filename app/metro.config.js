// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @react-native-google-signin ships its SignInButton native-component spec only
// as an uncompiled `.ts`, which Metro can't resolve under package exports. The
// app never renders the Google button (it only uses the GoogleSignin module),
// so stub that one spec file to an empty module to keep bundling working.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith("spec/SignInButtonNativeComponent")) {
    return { type: "empty" };
  }
  const resolve = upstreamResolveRequest || context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = config;
