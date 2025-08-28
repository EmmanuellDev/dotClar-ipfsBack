import Deployment from '../models/Deployment.js';
import { VersionManager } from '../utils/versionManager.js';

/**
 * Deployment Controller
 * Handles all deployment-related business logic
 */
export class DeploymentController {
  
  /**
   * Deploy a new smart contract
   * POST /api/deploy
   */
  static async deployContract(req, res) {
    try {
      const { walletAddress, contractCode, contractRepoName } = req.body;

      // Validate required fields
      if (!walletAddress || !contractCode || !contractRepoName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          required: ['walletAddress', 'contractCode', 'contractRepoName']
        });
      }

      // Validate wallet address format
      const walletRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletRegex.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format'
        });
      }

      // Validate contract code is an object
      if (typeof contractCode !== 'object' || contractCode === null || Array.isArray(contractCode)) {
        return res.status(400).json({
          success: false,
          message: 'Contract code must be a valid JSON object'
        });
      }

      // Validate repository name
      if (typeof contractRepoName !== 'string' || contractRepoName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contract repository name must be a non-empty string'
        });
      }

      const normalizedWallet = walletAddress.toLowerCase();
      const trimmedRepoName = contractRepoName.trim();

      // Find the latest version for this wallet and repo combination
      const latestVersion = await Deployment.findLatestVersion(normalizedWallet, trimmedRepoName);
      
      // Calculate next version
      const nextVersion = VersionManager.calculateNextVersion(latestVersion);

      // Create new deployment record
      const deployment = new Deployment({
        walletAddress: normalizedWallet,
        contractRepoName: trimmedRepoName,
        contractCode,
        version: nextVersion,
        deployedAt: new Date()
      });

      // Save to database
      const savedDeployment = await deployment.save();

      // Return success response
      res.status(201).json({
        success: true,
        message: 'Contract deployed successfully',
        data: {
          id: savedDeployment._id,
          walletAddress: savedDeployment.walletAddress,
          contractRepoName: savedDeployment.contractRepoName,
          version: savedDeployment.version,
          deployedAt: savedDeployment.deployedAt
        }
      });

    } catch (error) {
      console.error('Deploy contract error:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Deployment already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to deploy contract',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all deployments for a wallet address
   * GET /api/deployments/:walletAddress
   */
  static async getDeploymentsByWallet(req, res) {
    try {
      const { walletAddress } = req.params;
      const { limit = 50, offset = 0, sort = 'desc' } = req.query;

      // Validate wallet address
      const walletRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletRegex.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format'
        });
      }

      // Validate query parameters
      const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 records
      const offsetNum = Math.max(parseInt(offset) || 0, 0);
      const sortOrder = sort === 'asc' ? 1 : -1;

      const normalizedWallet = walletAddress.toLowerCase();

      // Get total count for pagination
      const totalCount = await Deployment.countDocuments({ walletAddress: normalizedWallet });

      // Fetch deployments
      const deployments = await Deployment.find({ walletAddress: normalizedWallet })
        .select('-contractCode') // Exclude large contractCode field for list view
        .sort({ deployedAt: sortOrder })
        .skip(offsetNum)
        .limit(limitNum)
        .lean();

      // Get deployment statistics
      const stats = await Deployment.getDeploymentStats(normalizedWallet);

      res.status(200).json({
        success: true,
        message: 'Deployments retrieved successfully',
        data: {
          deployments,
          pagination: {
            total: totalCount,
            limit: limitNum,
            offset: offsetNum,
            hasMore: totalCount > offsetNum + limitNum
          },
          statistics: {
            totalDeployments: totalCount,
            uniqueRepositories: stats.length,
            repositories: stats
          }
        }
      });

    } catch (error) {
      console.error('Get deployments by wallet error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deployments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get deployment history for a specific repository
   * GET /api/deployments/:walletAddress/:repo
   */
  static async getDeploymentsByRepo(req, res) {
    try {
      const { walletAddress, repo } = req.params;
      const { limit = 50, offset = 0, includeCode = 'false' } = req.query;

      // Validate wallet address
      const walletRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletRegex.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format'
        });
      }

      // Validate repository name
      if (!repo || repo.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Repository name cannot be empty'
        });
      }

      // Validate query parameters
      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);
      const shouldIncludeCode = includeCode === 'true';

      const normalizedWallet = walletAddress.toLowerCase();
      const trimmedRepo = decodeURIComponent(repo).trim();

      // Build query
      const query = {
        walletAddress: normalizedWallet,
        contractRepoName: trimmedRepo
      };

      // Get total count
      const totalCount = await Deployment.countDocuments(query);

      if (totalCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No deployments found for this repository'
        });
      }

      // Build select fields
      let selectFields = shouldIncludeCode ? '' : '-contractCode';

      // Fetch deployments
      const deployments = await Deployment.find(query)
        .select(selectFields)
        .sort({ deployedAt: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean();

      // Get version statistics
      const versions = deployments.map(d => d.version);
      const versionStats = VersionManager.getVersionStats(versions);

      res.status(200).json({
        success: true,
        message: 'Repository deployments retrieved successfully',
        data: {
          repository: trimmedRepo,
          deployments,
          pagination: {
            total: totalCount,
            limit: limitNum,
            offset: offsetNum,
            hasMore: totalCount > offsetNum + limitNum
          },
          versionStats
        }
      });

    } catch (error) {
      console.error('Get deployments by repo error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve repository deployments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get a specific deployment by ID
   * GET /api/deployment/:id
   */
  static async getDeploymentById(req, res) {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid deployment ID format'
        });
      }

      const deployment = await Deployment.findById(id).lean();

      if (!deployment) {
        return res.status(404).json({
          success: false,
          message: 'Deployment not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Deployment retrieved successfully',
        data: deployment
      });

    } catch (error) {
      console.error('Get deployment by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deployment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get deployment statistics for a wallet
   * GET /api/stats/:walletAddress
   */
  static async getWalletStats(req, res) {
    try {
      const { walletAddress } = req.params;

      // Validate wallet address
      const walletRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletRegex.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format'
        });
      }

      const normalizedWallet = walletAddress.toLowerCase();

      // Get comprehensive statistics
      const stats = await Deployment.getDeploymentStats(normalizedWallet);
      const totalDeployments = await Deployment.countDocuments({ walletAddress: normalizedWallet });

      // Get all versions for this wallet to calculate version stats
      const allDeployments = await Deployment.find({ walletAddress: normalizedWallet })
        .select('version')
        .lean();

      const allVersions = allDeployments.map(d => d.version);
      const versionStats = VersionManager.getVersionStats(allVersions);

      res.status(200).json({
        success: true,
        message: 'Wallet statistics retrieved successfully',
        data: {
          walletAddress: normalizedWallet,
          totalDeployments,
          uniqueRepositories: stats.length,
          repositories: stats,
          versionStatistics: versionStats
        }
      });

    } catch (error) {
      console.error('Get wallet stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallet statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default DeploymentController;