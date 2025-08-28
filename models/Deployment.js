const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    trim: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum wallet address']
  },
  contractRepoName: {
    type: String,
    required: [true, 'Contract repository name is required'],
    trim: true,
    minlength: [1, 'Repository name must be at least 1 character long'],
    maxlength: [100, 'Repository name cannot exceed 100 characters']
  },
  contractCodeHash: {
    type: String,
    required: [true, 'Contract code IPFS hash is required'],
    trim: true,
    validate: {
      validator: function(value) {
        // Basic IPFS hash validation (QmXXX format or modern CID)
        return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|ba[a-zA-Z2-7]{57})$/.test(value);
      },
      message: 'Invalid IPFS hash format'
    }
  },
  version: {
    type: String,
    required: [true, 'Version is required'],
    match: [/^\d+\.\d+\.\d+$/, 'Version must be in format MAJOR.MINOR.PATCH']
  },
  deployedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
deploymentSchema.index({ walletAddress: 1, contractRepoName: 1 });
deploymentSchema.index({ deployedAt: -1 });
deploymentSchema.index({ contractCodeHash: 1 }); // Index for IPFS hash lookups

// Static method to find latest deployment for a repo
deploymentSchema.statics.findLatestByRepo = function(walletAddress, contractRepoName) {
  return this.findOne({ walletAddress, contractRepoName })
    .sort({ deployedAt: -1 })
    .exec();
};

// Static method to find all deployments by wallet
deploymentSchema.statics.findByWallet = function(walletAddress) {
  return this.find({ walletAddress }).sort({ deployedAt: -1 }).exec();
};

// Static method to find deployment history for a specific repo
deploymentSchema.statics.findRepoHistory = function(walletAddress, contractRepoName) {
  return this.find({ walletAddress, contractRepoName }).sort({ deployedAt: -1 }).exec();
};

const Deployment = mongoose.model('Deployment', deploymentSchema);

module.exports = Deployment;