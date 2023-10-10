module.exports = function override(config, env) {
  config.watchOptions = {
    ...config.watchOptions,
    ignored: ['**/quadratic-core/**/!(quadratic_core_bg.wasm)', '**/quadratic-core/types.d.ts'],
  };

  return config;
};
