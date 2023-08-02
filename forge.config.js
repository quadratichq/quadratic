module.exports = {
  packagerConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
    },
    {
      name: '@electron-forge/maker-squirrel',
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-s3',
      config: {
        bucket: 'my-bucket',
        public: true,
      },
    },
  ],
};
