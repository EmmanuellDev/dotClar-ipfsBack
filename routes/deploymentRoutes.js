const express = require('express');
const {
  createDeployment,
  getDeploymentsByWallet,
  getRepoDeploymentHistory
} = require('../controllers/deploymentController');

const router = express.Router();

/**
 * @route   POST /deploy
 * @desc    Create a new deployment with automatic versioning
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
 * @access  Public
 */
router.get('/deployments/:walletAddress/:repo', getRepoDeploymentHistory);

module.exports = router;