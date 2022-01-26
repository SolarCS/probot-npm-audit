// Import necessary packages
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class configHelper {
  /**
   * Initializes the class with the necessary defaults
   * 
   * @param {string} repo The repository in which to look for the config
   * @param {string} branch The branch in which to look for the config
   */
  constructor (repo, branch, isTest = false) {
    this.applicationConfig;
    this.branch = branch;
    this.repo = repo;
    this.isTest = isTest; // bypass methods which are unable to be simulated or executed
  }

  /**
   * Sets the applicationConfig Property
   * 
   * @param {JSON} applicationConfig 
   */
  setApplicationConfig = (applicationConfig) => {
    this.applicationConfig = applicationConfig;
  }

  /**
   * Checks for a config and if it exists reads the contents
   */
  checkForConfig = async () => {
    let query;

    if (this.isTest) {
      query = `cd ${this.repo} && test -f .npmAudit.json && cat .npmAudit.json`;
    } else {
      query = `cd ${this.repo} && git checkout -q ${this.branch} && test -f .npmAudit.json && cat .npmAudit.json`;
    }

    const output = await exec(query)
      .catch(error => {
        if (error.stdout === '') {
          console.log('No config Found');
        } else {
          console.log(`Unexpected error occurred: ${error}`)
        }        
      });

    try {
      if (output) {
        this.setApplicationConfig(JSON.parse(output.stdout));
      }
    } catch (e) {
      console.log(`Error while parsing config file: ${e}`)
    }
  };

  /**
   * Determines if the config is set or not
   * 
   * @returns {boolean} If the config is set or not
   */
  configIsSet = () => {
    if (this.applicationConfig) {
      return true;
    } else {
      return false;
    }
  };
}


module.exports = configHelper;