'use strict';

const logger = require('@ui5/logger').getGroupLogger('deployer:deployer');
const {resourceFactory} = require('@ui5/fs');
const typeRepository = require('../types/typeRepository');

/**
 * Calculates the elapsed deploy time and returns a prettified output
 *
 * @private
 * @param {array} startTime Array provided by <code>process.hrtime()</code>
 * @return {string} Difference between now and the provided time array as formatted string
 */
function getElapsedTime(startTime) {
  const prettyHrtime = require('pretty-hrtime');
  const timeDiff = process.hrtime(startTime);
  return prettyHrtime(timeDiff);
}

/**
 * Deployer
 *
 * @public
 * @namespace
 * @alias module:ui5-deployer.deployer
 */
module.exports = {
  /**
     * Configures the project deploy and starts it.
     *
     * @public
     * @param {object} parameters Parameters
     * @param {object} parameters.tree Dependency tree
     * @param {string} parameters.transportRequest ABAP Transport Request
     * @param {string} parameters.username Username to log into the target system
     * @param {string} parameters.password Password to log into the target system
     * @return {Promise} Promise resolving to <code>undefined</code> once deploy has finished
     */
  async deploy({tree, transportRequest, username, password}) {
    logger.info(`Deploying project ${tree.metadata.name}`);
    const startTime = process.hrtime();
    const project = tree;
    if (parseFloat(tree.specVersion) > 2 || (tree.customConfiguration && tree.customConfiguration.deployer)) {
      project.deployer = tree.customConfiguration.deployer;
    }
    if (transportRequest && project.deployer.abapRepository) {
      project.deployer.abapRepository.transportRequest = transportRequest;
    }
    if (username || password) {
      project.deployer.credentials = {username, password};
    }
    const projectType = typeRepository.getType(project.deployer.type);
    let excludes = [];
    if (project.deployer.resources && project.deployer.resources.excludes) {
      excludes = project.deployer.resources.excludes
          .map((excludedPath) => excludedPath.replace(project.deployer.sourcePath, '/'));
    }
    const workspace = resourceFactory.createAdapter({
      fsBasePath: './' + project.deployer.sourcePath,
      virBasePath: '/',
      excludes: excludes,
    });

    try {
      await projectType.deploy({
        resourceCollections: {
          workspace,
        },
        project,
        parentLogger: logger,
      });
      logger.verbose('Finished deploying project %s. Writing out files...', project.metadata.name);
      logger.info(`Deploy succeeded in ${getElapsedTime(startTime)}`);
    } catch (err) {
      logger.error(err);
      logger.error(`Deploy failed in ${getElapsedTime(startTime)}`);
      throw err;
    }
  },
};
