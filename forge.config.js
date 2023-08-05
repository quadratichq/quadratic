module.exports = {
  packagerConfig: {
    osxSign: {},
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
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
