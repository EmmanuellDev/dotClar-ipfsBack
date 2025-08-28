import mongoose from 'mongoose';

const deploymentSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        // Basic validation for Ethereum-like wallet address (starts with 0x and 42 chars total)
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid wallet address format'
    }
  },
  contractRepoName: {
    type: String,
    required: [true, 'Contract repository name is required'],
    trim: true,
    minlength: [1, 'Repository name cannot be empty'],
    maxlength: [100, 'Repository name too long']
  },
  contractCode: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Contract code is required'],
    validate: {
      validator: function(v) {
        // Ensure it's a valid object/JSON
        return v && typeof v === 'object';
      },
      message: 'Contract code must be a valid JSON object'
    }
  },
  version: {
    type: String,
    required: [true, 'Version is required'],
    match: [/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning format (MAJOR.MINOR.PATCH)']
  },
  deployedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  versionKey: false // Removes __v field
});

// Indexes for better query performance
deploymentSchema.index({ walletAddress: 1 });
deploymentSchema.index({ contractRepoName: 1 });
deploymentSchema.index({ walletAddress: 1, contractRepoName: 1 });
deploymentSchema.index({ deployedAt: -1 });

// Instance method to get version parts
deploymentSchema.methods.getVersionParts = function() {
  const parts = this.version.split('.');
  return {
    major: parseInt(parts[0]),
    minor: parseInt(parts[1]),
    patch: parseInt(parts[2])
  };
};

// Static method to find latest version for a repo
deploymentSchema.statics.findLatestVersion = async function(walletAddress, contractRepoName) {
  const latestDeployment = await this.findOne({
    walletAddress: walletAddress.toLowerCase(),
    contractRepoName
  })
  .sort({ deployedAt: -1 })
  .select('version');
  
  return latestDeployment ? latestDeployment.version : null;
};

// Static method to get deployment statistics
deploymentSchema.statics.getDeploymentStats = async function(walletAddress) {
  const stats = await this.aggregate([
    { $match: { walletAddress: walletAddress.toLowerCase() } },
    {
      $group: {
        _id: '$contractRepoName',
        totalDeployments: { $sum: 1 },
        latestVersion: { $last: '$version' },
        firstDeployed: { $min: '$deployedAt' },
        lastDeployed: { $max: '$deployedAt' }
      }
    },
    { $sort: { lastDeployed: -1 } }
  ]);
  
  return stats;
};

// Pre-save middleware to ensure walletAddress is lowercase
deploymentSchema.pre('save', function(next) {
  if (this.walletAddress) {
    this.walletAddress = this.walletAddress.toLowerCase();
  }
  next();
});

const Deployment = mongoose.model('Deployment', deploymentSchema);

export default Deployment;