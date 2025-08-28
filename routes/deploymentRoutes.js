const express = require('express');
const {
  createDeployment,
  getDeploymentsByWallet,
  getRepoDeploymentHistory,
  getContractCode
} = require('../controllers/deploymentController');

const router = express.Router();

/**
 * @route   POST /deploy
 * @desc    Create a new deployment with automatic versioning and IPFS storage
 * @access  Public
 */
router.post('/deploy', createDeployment);

/**
 * @route   GET /deployments/:walletAddress
 * @desc    Get all deployments for a specific wallet address
 * @access  Public
 */
router.get('/deployments/:walletAddress', getDeploymentsByWallet);

/**
 * @route   GET /deployments/:walletAddress/:repo
 * @desc    Get deployment history for a specific repository
 * @query   includeCode=true to retrieve actual contract code from IPFS
 * @access  Public
 */
router.get('/deployments/:walletAddress/:repo', getRepoDeploymentHistory);

/**
 * @route   GET /contract/:hash
 * @desc    Get contract code from IPFS hash
 * @access  Public
 */
router.get('/contract/:hash', getContractCode);

module.exports = router;