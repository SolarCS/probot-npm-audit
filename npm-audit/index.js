// Import Packages needed
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Import Classes
const ConfigHelper = require('./helpers/config-helper');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  const pullRequestActions = [
    "pull_request.opened",
    "pull_request.reopened",
    "pull_request.synchronize"
  ]

  // Create function to clone repo, remove repo and check for existing repo
  // If repo is existing utilize pulling instead of recloning to save on data

  /**
   * This clones a repository into our local environment
   * 
   * @param {string} repoURL The URL of the repo to clone
   */
  const cloneRepo = async (repoURL) => {
    await exec(`git clone ${repoURL}`);
  }

  /**
   * This removes a repo from our local environment
   * 
   * @param {string} repo The name of the repo
   */
  const removeRepo = async (repo) => {
    await exec(`rm -rf ${repo}`);
  }

  /**
   * Updates a repo on the local environment
   * 
   * @param {string} repo The name of the repo
   */
  const updateRepo = async (repo) => {
    await exec(`cd ${repo} && git pull`);
  }

  /**
   * Checks to see if a repo exists in the local environment
   * 
   * @param {string} repo The name of the repo
   * 
   * @returns {boolean} If the repo exists or not
   */
  const doesRepoExist = (repo) => {
    return fs.existsSync(repo);
  }

  /**
   * Checks a given branch on a repo for vulnerabilities found in NPM audit
   * 
   * @param {string} repo The name of the repo
   * @param {string} branch The name of the branch
   * @param {ConfigHelper} applicationConfigHelper An instance of the ConfigHelper class that has read the local config
   * 
   * @returns {object} The list of vulnerabilities for a given branch on a repo
   */
  const checkNPMAudit = async (repo, branch, applicationConfigHelper) => {
    let query;
    let vulnerabilities;

    if (applicationConfigHelper.configIsSet() && applicationConfigHelper.applicationConfig.packageLocation) {
      query = `cd ${repo} && git checkout -q ${branch} && cd ${applicationConfigHelper.applicationConfig.packageLocation} && npm audit --json`;
    } else {
      query = `cd ${repo} && git checkout -q ${branch} && npm audit --json`;
    }

    const output = await exec(query)
      .catch(error => {
        if (error.stderr === '') {
          vulnerabilities = JSON.parse(error.stdout);
          vulnerabilities.error = '';
        } else {
          console.log(error);
          vulnerabilities = {};
          vulnerabilities.error = 'The configured location for the package.json is either incorrect or missing.';
        }
      });

    return output ? JSON.parse(output.stdout) : vulnerabilities;
  }

  /**
   * This method performs all the necessary function to generate an audit against
   * a given repo for a specific branch
   * 
   * @param {string} repoURL The URL of the repo to clone
   * @param {string} repo The name of the repo we are cloning
   * @param {string} branch The name of the branch we want to test against
   * 
   * @returns {string} The vulnerabilities if any are found
   */
  const auditNPMPackages = async (repoURL, repo, branch) => {
    const applicationConfigHelper = new ConfigHelper(repo, branch);

    if (doesRepoExist(repo)) {
      await updateRepo(repo);
    } else {
      await cloneRepo(repoURL);
    }
    await applicationConfigHelper.checkForConfig();
    const vulnerabilities = await checkNPMAudit(repo, branch, applicationConfigHelper);
    await removeRepo(repo);

    return parseVulnerabilityMessage(vulnerabilities);
  };

  /**
   * Parses the vulnerabilitiy message to output in a formatted way for Github
   * If errors our found that we cannot handle it returns the error message instead
   * 
   * @param {*} vulnerabilities An object full of all vulnerabilities found if any exist
   * 
   * @returns {string} The parsed error message in a readable format for Github
   */
  const parseVulnerabilityMessage = (vulnerabilities) => {
    if (vulnerabilities.error !== '') {
      return `Error occurred while parsing for vulnerabilities: ${vulnerabilities.error}`;
    }

    const totalVulnerabilities = vulnerabilities.metadata.vulnerabilities.info +
      vulnerabilities.metadata.vulnerabilities.low +
      vulnerabilities.metadata.vulnerabilities.moderate +
      vulnerabilities.metadata.vulnerabilities.high +
      vulnerabilities.metadata.vulnerabilities.critical
    let message = `## Found ${totalVulnerabilities} vulnerabilities in ${vulnerabilities.metadata.totalDependencies} dependencies`;

    message += Object.keys(vulnerabilities.advisories).length > 0 ? '\n\n## Vulnerable Packages:': '';
    Object.entries(vulnerabilities.advisories).forEach( ([ key, value ]) => {
      message += `\n${value.module_name} -> `;
      
      let count = 0;
      value.cves.forEach( ( cve ) => {
        count === 0 ? message += `${cve}` : message += `,${cve}`;
        count++;
      });
    });

    return message;
  }

  /**
   * This retrieves all comments from Github and returns them as an array
   * 
   * @param {object} context An object from probot that contains an authenticated 
   * git session as well as everything related to the PR/commit
   * 
   * @returns {array} An array of comments in Github
   */
  const retrieveComments = async (context) => {
    let comments = await context.octokit.issues.listComments({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.number
    });

    return comments;
  }

  /**
   * Removes the specific comment generated from our bot
   * 
   * @param {object} context An object from probot that contains an authenticated 
   * git session as well as everything related to the PR/commit
   * @param {array} comments An array of comments from Github
   */
  const removeComment = async (context, comments) => {
    comments.data.forEach( comment => {
      if (comment.user.type === 'Bot' && comment.user.login === 'npm-audit-security-tool[bot]') {
        context.octokit.issues.deleteComment({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          comment_id: comment.id
        })
      }
    });
  }

  app.on(pullRequestActions, async (context) => {
    if (context.payload.dryRun) {
      message = context.issue({body: 'Dry Run Complete'})
    } else {
      const auditMessage = await auditNPMPackages(
        context.payload.repository.ssh_url,
        context.payload.repository.name,
        context.payload.pull_request.head.ref
      );
      message = context.issue({body: auditMessage})
  
      await removeComment(context, await retrieveComments(context))
    }

    return context.octokit.issues.createComment(message);
  });
};
