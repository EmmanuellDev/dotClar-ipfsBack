const Deployment = require('../models/Deployment');
const { getNextVersion } = require('../utils/versionManager');
const ipfsService = require('../services/ipfsService');

/**
 * @desc    Compare two IPFS hashes for changes
 * @param   {string} oldHash - Previous contract code hash
 * @param   {string} newHash - New contract code hash
 * @returns {boolean} True if there are changes, false otherwise
 */
const hasContractCodeChanged = (oldHash, newHash) => {
  if (!oldHash && newHash) return true;
  if (oldHash && !newHash) return true;
  if (!oldHash && !newHash) return false;
  
  return oldHash !== newHash;
};

/**
 * @desc    Create a new deployment with automatic versioning and IPFS storage
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

    // Validate contract code is an object
    if (typeof contractCode !== 'object' || contractCode === null) {
      return res.status(400).json({
        success: false,
        message: 'Contract code must be a valid JSON object'
      });
    }

    // Upload contract code to IPFS
    console.log('Uploading contract code to IPFS...');
    const contractCodeHash = await ipfsService.uploadContractCode(contractCode);
    
    // Pin the content to ensure it stays available
    await ipfsService.pinContent(contractCodeHash);

    // Find the latest deployment for this repo
    const latestDeployment = await Deployment.findLatestByRepo(walletAddress, contractRepoName);

    let nextVersion;
    let message;

    if (latestDeployment) {
      // Check if contract code has changed by comparing IPFS hashes
      const codeChanged = hasContractCodeChanged(latestDeployment.contractCodeHash, contractCodeHash);
      
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

    // Create new deployment with IPFS hash
    const deployment = new Deployment({
      walletAddress,
      contractCodeHash,
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
          contractCodeHash: savedDeployment.contractCodeHash,
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
          latestVersion: dep.version,
          contractCodeHash: dep.contractCodeHash
        };
      }
    });

    // Build response object
    const data = { walletAddress };
    for (const repoName in latestByRepo) {
      data[repoName] = {
        version: latestByRepo[repoName].latestVersion,
        ipfsHash: latestByRepo[repoName].contractCodeHash
      };
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
    const { excludeCode } = req.query; // Optional query param to exclude contract code

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

    // Add change detection and contract code to response
    const deploymentsWithDetails = await Promise.all(
      deployments.map(async (deploy, index) => {
        const previousDeploy = index > 0 ? deployments[index - 1] : null;
        const codeChanged = previousDeploy 
          ? hasContractCodeChanged(previousDeploy.contractCodeHash, deploy.contractCodeHash)
          : true; // First deployment always has changes

        const result = {
          id: deploy._id,
          walletAddress: deploy.walletAddress,
          contractRepoName: deploy.contractRepoName,
          contractCodeHash: deploy.contractCodeHash,
          version: deploy.version,
          deployedAt: deploy.deployedAt,
          codeChanged
        };

        // Include the actual contract code from IPFS by default
        if (excludeCode !== 'true') {
          try {
            result.contractCode = await ipfsService.getContractCode(deploy.contractCodeHash);
          } catch (error) {
            console.error(`Failed to retrieve contract code from IPFS: ${error.message}`);
            result.contractCodeError = 'Failed to retrieve from IPFS';
          }
        }

        return result;
      })
    );

    res.status(200).json({
      success: true,
      message: 'Deployment history retrieved successfully',
      data: {
        deployments: deploymentsWithDetails
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

/**
 * @desc    Get contract code from IPFS hash
 * @route   GET /api/contract/:hash
 * @access  Public
 */
const getContractCode = async (req, res) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'IPFS hash is required'
      });
    }

    const contractCode = await ipfsService.getContractCode(hash);

    res.status(200).json({
      success: true,
      message: 'Contract code retrieved successfully',
      data: {
        contractCode,
        ipfsHash: hash
      }
    });

  } catch (error) {
    console.error('Get contract code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contract code from IPFS',
      error: error.message
    });
  }
};

module.exports = {
  createDeployment,
  getDeploymentsByWallet,
  getRepoDeploymentHistory,
  getContractCode,
  hasContractCodeChanged // Export for testing if needed
};