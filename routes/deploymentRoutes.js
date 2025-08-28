import express from 'express';
import { DeploymentController } from '../controllers/deploymentController.js';

const router = express.Router();

/**
 * @route   POST /api/deploy
 * @desc    Deploy a new smart contract
 * @access  Public
 * @body    { walletAddress, contractCode, contractRepoName }
 */
router.post('/deploy', DeploymentController.deployContract);

/**
 * @route   GET /api/deployments/:walletAddress
 * @desc    Get all deployments for a wallet address
 * @access  Public
 * @params  walletAddress - Ethereum wallet address
 * @query   limit, offset, sort (asc|desc)
 */
router.get('/deployments/:walletAddress', DeploymentController.getDeploymentsByWallet);

/**
 * @route   GET /api/deployments/:walletAddress/:repo
 * @desc    Get deployment history for a specific repository
 * @access  Public
 * @params  walletAddress - Ethereum wallet address
 * @params  repo - Repository name (URL encoded)
 * @query   limit, offset, includeCode (true|false)
 */
router.get('/deployments/:walletAddress/:repo', DeploymentController.getDeploymentsByRepo);

/**
 * @route   GET /api/deployment/:id
 * @desc    Get a specific deployment by ID
 * @access  Public
 * @params  id - MongoDB ObjectId of the deployment
 */
router.get('/deployment/:id', DeploymentController.getDeploymentById);

/**
 * @route   GET /api/stats/:walletAddress
 * @desc    Get deployment statistics for a wallet
 * @access  Public
 * @params  walletAddress - Ethereum wallet address
 */
router.get('/stats/:walletAddress', DeploymentController.getWalletStats);

export default router;