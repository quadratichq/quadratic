module.exports = function override(config, env) {
  config.watchOptions = {
    ...config.watchOptions,
    ignored: '**/quadratic-core',
  };
  console.error('config', config.plugins);

  return config;
};
