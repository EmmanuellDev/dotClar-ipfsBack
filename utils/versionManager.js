/**
 * Utility functions for semantic version management
 */

/**
 * Parses a semantic version string into its components
 * @param {string} version - Semantic version string (e.g., "1.2.3")
 * @returns {Object} Object with major, minor, patch components
 */
const parseVersion = (version) => {
  if (!version || typeof version !== 'string') {
    throw new Error('Version must be a non-empty string');
  }

  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error('Version must be in format MAJOR.MINOR.PATCH');
  }

  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error('Version components must be numbers');
  }

  return { major, minor, patch };
};

/**
 * Increments the patch version of a semantic version
 * @param {string} version - Current semantic version
 * @returns {string} Next patch version
 */
const incrementPatch = (version) => {
  const { major, minor, patch } = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
};

/**
 * Gets the next version for a deployment
 * If no previous deployment exists for the repo, returns "0.1.0"
 * If previous deployment exists, increments the patch version
 * @param {string} latestVersion - Latest version string or null if no previous deployment
 * @returns {string} Next semantic version
 */
const getNextVersion = (latestVersion) => {
  if (!latestVersion) {
    return '0.1.0';
  }

  try {
    return incrementPatch(latestVersion);
  } catch (error) {
    throw new Error(`Failed to calculate next version: ${error.message}`);
  }
};

/**
 * Validates if a version string follows semantic versioning format
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidVersion = (version) => {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  parseVersion,
  incrementPatch,
  getNextVersion,
  isValidVersion
};