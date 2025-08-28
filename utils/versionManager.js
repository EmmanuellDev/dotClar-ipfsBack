/**
 * Version Manager Utility
 * Handles semantic versioning logic for smart contract deployments
 */

export class VersionManager {
  static DEFAULT_VERSION = '0.1.0';
  static VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

  /**
   * Parse a version string into its components
   * @param {string} version - Version string in format "MAJOR.MINOR.PATCH"
   * @returns {Object} Object with major, minor, and patch numbers
   */
  static parseVersion(version) {
    if (!version || typeof version !== 'string') {
      throw new Error('Version must be a non-empty string');
    }

    const match = version.match(this.VERSION_REGEX);
    if (!match) {
      throw new Error(`Invalid version format: ${version}. Expected format: MAJOR.MINOR.PATCH`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  /**
   * Create a version string from components
   * @param {number} major - Major version number
   * @param {number} minor - Minor version number  
   * @param {number} patch - Patch version number
   * @returns {string} Version string
   */
  static createVersion(major, minor, patch) {
    if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
      throw new Error('Version components must be integers');
    }

    if (major < 0 || minor < 0 || patch < 0) {
      throw new Error('Version components cannot be negative');
    }

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Compare two version strings
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  static compareVersions(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    // Compare major version
    if (v1.major !== v2.major) {
      return v1.major > v2.major ? 1 : -1;
    }

    // Compare minor version
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor ? 1 : -1;
    }

    // Compare patch version
    if (v1.patch !== v2.patch) {
      return v1.patch > v2.patch ? 1 : -1;
    }

    return 0; // Versions are equal
  }

  /**
   * Increment patch version
   * @param {string} currentVersion - Current version string
   * @returns {string} New version with incremented patch
   */
  static incrementPatch(currentVersion) {
    const { major, minor, patch } = this.parseVersion(currentVersion);
    return this.createVersion(major, minor, patch + 1);
  }

  /**
   * Increment minor version (resets patch to 0)
   * @param {string} currentVersion - Current version string
   * @returns {string} New version with incremented minor
   */
  static incrementMinor(currentVersion) {
    const { major, minor } = this.parseVersion(currentVersion);
    return this.createVersion(major, minor + 1, 0);
  }

  /**
   * Increment major version (resets minor and patch to 0)
   * @param {string} currentVersion - Current version string
   * @returns {string} New version with incremented major
   */
  static incrementMajor(currentVersion) {
    const { major } = this.parseVersion(currentVersion);
    return this.createVersion(major + 1, 0, 0);
  }

  /**
   * Calculate the next version for a deployment
   * @param {string|null} currentVersion - Current version or null for first deployment
   * @param {Object} options - Options for version calculation
   * @param {string} options.incrementType - Type of increment ('patch', 'minor', 'major')
   * @returns {string} Next version string
   */
  static calculateNextVersion(currentVersion, options = {}) {
    const { incrementType = 'patch' } = options;

    // If no current version exists, return default version
    if (!currentVersion) {
      return this.DEFAULT_VERSION;
    }

    try {
      switch (incrementType) {
        case 'major':
          return this.incrementMajor(currentVersion);
        case 'minor':
          return this.incrementMinor(currentVersion);
        case 'patch':
        default:
          return this.incrementPatch(currentVersion);
      }
    } catch (error) {
      throw new Error(`Failed to calculate next version: ${error.message}`);
    }
  }

  /**
   * Validate if a version string is valid
   * @param {string} version - Version string to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidVersion(version) {
    if (!version || typeof version !== 'string') {
      return false;
    }

    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get version statistics from an array of versions
   * @param {string[]} versions - Array of version strings
   * @returns {Object} Version statistics
   */
  static getVersionStats(versions) {
    if (!Array.isArray(versions) || versions.length === 0) {
      return {
        total: 0,
        latest: null,
        oldest: null,
        majorReleases: 0,
        minorReleases: 0,
        patchReleases: 0
      };
    }

    const validVersions = versions.filter(v => this.isValidVersion(v));
    if (validVersions.length === 0) {
      return this.getVersionStats([]);
    }

    // Sort versions
    const sortedVersions = validVersions.sort((a, b) => this.compareVersions(a, b));
    
    // Count release types (simplified - counts unique major.minor combinations)
    const majorVersions = new Set();
    const minorVersions = new Set();
    
    sortedVersions.forEach(version => {
      const { major, minor } = this.parseVersion(version);
      majorVersions.add(major);
      minorVersions.add(`${major}.${minor}`);
    });

    return {
      total: validVersions.length,
      latest: sortedVersions[sortedVersions.length - 1],
      oldest: sortedVersions[0],
      majorReleases: majorVersions.size,
      minorReleases: minorVersions.size,
      patchReleases: validVersions.length
    };
  }
}

export default VersionManager;