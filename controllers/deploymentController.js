const Deployment = require('../models/Deployment');
const { getNextVersion } = require('../utils/versionManager');

/**
 * @desc    Compare two contract code objects for changes
 * @param   {Object} oldCode - Previous contract code
 * @param   {Object} newCode - New contract code
 * @returns {boolean} True if there are changes, false otherwise
 */
const hasContractCodeChanged = (oldCode, newCode) => {
  if (!oldCode && newCode) return true;
  if (oldCode && !newCode) return true;
  if (!oldCode && !newCode) return false;

  // Convert both objects to JSON strings for comparison
  const oldCodeString = JSON.stringify(oldCode);
  const newCodeString = JSON.stringify(newCode);
  
  return oldCodeString !== newCodeString;
};

/**
 * @desc    Create a new deployment with automatic versioning
 * @route   POST /api/deploy
 * @access  Public
 */
const createDeployment = async (req, res) => {
  try {
    const { walletAddress, contractCode, contractRepoName } = req.body;

    // Validate required fields
    if (!walletAddress || !contractCode || !contractRepoName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: walletAddress, contractCode, contractRepoName'
      });
    }

    // Validate wallet address format
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ethereum wallet address format'
      });
    }

    // Find the latest deployment for this repo
    const latestDeployment = await Deployment.findLatestByRepo(walletAddress, contractRepoName);

    let nextVersion;
    let message;

    if (latestDeployment) {
      // Check if contract code has changed
      const codeChanged = hasContractCodeChanged(latestDeployment.contractCode, contractCode);
      
      if (!codeChanged) {
        // No change → return error instead of saving
        return res.status(400).json({
          success: false,
          message: 'nothing to commit, everything is up to date'
        });
      }

      // Increment version if code changed
      nextVersion = getNextVersion(latestDeployment.version);
      message = 'Deployment created successfully with new version';
    } else {
      // First deployment for this repo
      nextVersion = getNextVersion(null);
      message = 'Deployment created successfully (first version)';
    }

    // Create new deployment only if code changed or it's first deployment
    const deployment = new Deployment({
      walletAddress,
      contractCode,
      contractRepoName,
      version: nextVersion
    });

    const savedDeployment = await deployment.save();

    res.status(201).json({
      success: true,
      message,
      data: {
        deployment: {
          id: savedDeployment._id,
          walletAddress: savedDeployment.walletAddress,
          contractRepoName: savedDeployment.contractRepoName,
          version: savedDeployment.version,
          deployedAt: savedDeployment.deployedAt,
          codeChanged: true
        }
      }
    });

  } catch (error) {
    console.error('Create deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create deployment',
      error: error.message
    });
  }
};


/**
 * @desc    Get all deployments for a wallet address
 * @route   GET /api/deployments/:walletAddress
 * @access  Public
 */
const getDeploymentsByWallet = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const deployments = await Deployment.findByWallet(walletAddress);

    if (!deployments || deployments.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No deployments found',
        data: { walletAddress }
      });
    }

    // Group by contractRepoName and get the latest version
    const latestByRepo = {};
    deployments.forEach(dep => {
      const repoName = dep.contractRepoName;
      if (!latestByRepo[repoName] || dep.version > latestByRepo[repoName].version) {
        latestByRepo[repoName] = {
          latestVersion: dep.version
        };
      }
    });

    // Build response object
    const data = { walletAddress };
    for (const repoName in latestByRepo) {
      data[repoName] = latestByRepo[repoName].latestVersion;
    }

    res.status(200).json({
      success: true,
      message: 'Deployments retrieved successfully',
      data
    });

  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deployments',
      error: error.message
    });
  }
};


/**
 * @desc    Get deployment history for a specific repository
 * @route   GET /api/deployments/:walletAddress/:repo
 * @access  Public
 */
const getRepoDeploymentHistory = async (req, res) => {
  try {
    const { walletAddress, repo } = req.params;

    if (!walletAddress || !repo) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and repository name are required'
      });
    }

    const deployments = await Deployment.findRepoHistory(walletAddress, repo);

    if (deployments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No deployments found for the specified repository'
      });
    }

    // Add change detection to response
    const deploymentsWithChanges = deployments.map((deploy, index) => {
      const previousDeploy = index > 0 ? deployments[index - 1] : null;
      const codeChanged = previousDeploy 
        ? hasContractCodeChanged(previousDeploy.contractCode, deploy.contractCode)
        : true; // First deployment always has changes

      return {
        id: deploy._id,
        walletAddress: deploy.walletAddress,
        contractRepoName: deploy.contractRepoName,
        contractCode: deploy.contractCode,
        version: deploy.version,
        deployedAt: deploy.deployedAt,
        codeChanged
      };
    });

    res.status(200).json({
      success: true,
      message: 'Deployment history retrieved successfully',
      data: {
        deployments: deploymentsWithChanges
      }
    });

  } catch (error) {
    console.error('Get deployment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deployment history',
      error: error.message
    });
  }
};

module.exports = {
  createDeployment,
  getDeploymentsByWallet,
  getRepoDeploymentHistory,
  hasContractCodeChanged // Export for testing if needed
};