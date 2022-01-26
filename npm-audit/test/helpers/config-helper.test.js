const ConfigHelper = require('../../helpers/config-helper')
const util = require('util');
const exec = util.promisify(require('child_process').exec);

describe('Config Helper Functions', () => {
  const dummyConfig = {
    "function": "function"
  };
  const testConfigHelper = new ConfigHelper('fixtures/fake-repo','', true);

  describe('setApplicationConfig', () => {
    test("application config is set to its default", () => {
      expect(testConfigHelper.applicationConfig).toEqual(undefined);
    });

    test("application config has been updated", () => {
      testConfigHelper.setApplicationConfig(dummyConfig);
      expect(testConfigHelper.applicationConfig).toEqual(dummyConfig);
    });
  });

  describe('checkForConfig', () => {
    test('config does not exist', async () => {
      const testConfigHelperNoConfig = new ConfigHelper('fixtures', '', true)
      await testConfigHelperNoConfig.checkForConfig()
      expect(testConfigHelperNoConfig.applicationConfig).toEqual(undefined)
    });

    test('config exists', async () => {
      await testConfigHelper.checkForConfig()
      expect(testConfigHelper.applicationConfig).toEqual(dummyConfig)
    });
  });

  describe('configIsSet', () => {
    test('Config exists', () => {
      testConfigHelper.setApplicationConfig(dummyConfig);
      expect(testConfigHelper.configIsSet()).toEqual(true);
    });

    test('Config does not exists', () => {
      testConfigHelper.setApplicationConfig(undefined)
      expect(testConfigHelper.configIsSet()).toEqual(false);
    });
  });
});