// This is a transformer for Jest to transform python files to strings for import
// only used in jest tests.
module.exports = {
  process: (content) => {
    return { code: 'module.exports = ' + JSON.stringify(content) };
  },
};
