const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

class IPFSService {
constructor() {
  this.pinataApiKey = process.env.PINATA_API_KEY;
  this.pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
  this.pinataGateway = process.env.PINATA_GATEWAY;
  this.pinataApiUrl = process.env.PINATA_API_URL;
}


  /**
   * Upload contract code to Pinata IPFS
   * @param {Object} contractCode - Contract code object to upload
   * @returns {Promise<string>} IPFS hash (CID)
   */
  async uploadContractCode(contractCode) {
    try {
      console.log('Uploading contract code to Pinata IPFS...');
      
      // Convert contract code to JSON string
      const jsonString = JSON.stringify(contractCode, null, 2);
      
      // Create FormData
      const form = new FormData();
      form.append('file', Buffer.from(jsonString), {
        filename: 'contract.json',
        contentType: 'application/json'
      });

      // Pinata metadata
      const metadata = JSON.stringify({
        name: 'contract-code.json',
        keyvalues: {
          type: 'smart-contract',
          timestamp: new Date().toISOString()
        }
      });
      form.append('pinataMetadata', metadata);

      // Pinata options
      const options = JSON.stringify({
        cidVersion: 0
      });
      form.append('pinataOptions', options);

      const response = await axios.post(`${this.pinataApiUrl}/pinning/pinFileToIPFS`, form, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretApiKey,
          ...form.getHeaders()
        },
        timeout: 30000
      });

      if (response.data && response.data.IpfsHash) {
        console.log(`✓ Contract code uploaded to Pinata IPFS: ${response.data.IpfsHash}`);
        console.log(`✓ Gateway URL: ${this.pinataGateway}/ipfs/${response.data.IpfsHash}`);
        return response.data.IpfsHash;
      } else {
        throw new Error('Invalid response from Pinata');
      }
    } catch (error) {
      console.error('Pinata IPFS upload error:', error.message);
      if (error.response) {
        console.error('Pinata response:', error.response.status, error.response.data);
      }
      throw new Error(`Failed to upload to Pinata IPFS: ${error.message}`);
    }
  }

  /**
   * Retrieve contract code from Pinata IPFS
   * @param {string} hash - IPFS hash (CID)
   * @returns {Promise<Object>} Contract code object
   */
  async getContractCode(hash) {
    try {
      console.log(`Retrieving contract code from IPFS: ${hash}`);
      
      const response = await axios.get(`${this.pinataGateway}/ipfs/${hash}`, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('IPFS retrieval error:', error.message);
      throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
    }
  }

  /**
   * Pin content using Pinata API
   * @param {string} hash - IPFS hash to pin
   * @returns {Promise<boolean>} Success status
   */
  async pinContent(hash) {
    try {
      const response = await axios.post(`${this.pinataApiUrl}/pinning/pinByHash`, {
        hashToPin: hash,
        pinataMetadata: {
          name: 'pinned-contract',
          keyvalues: {
            type: 'smart-contract',
            pinnedAt: new Date().toISOString()
          }
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretApiKey
        },
        timeout: 30000
      });

      console.log(`✓ Content pinned: ${hash}`);
      return true;
    } catch (error) {
      console.error('Pinata pinning error:', error.message);
      return false;
    }
  }

  /**
   * Check if content exists on IPFS via Pinata gateway
   * @param {string} hash - IPFS hash to check
   * @returns {Promise<boolean>} Whether content exists
   */
  async contentExists(hash) {
    try {
      await axios.head(`${this.pinataGateway}/ipfs/${hash}`, {
        timeout: 10000
      });
      return true;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      console.error('IPFS existence check error:', error.message);
      return false;
    }
  }

  /**
   * Test Pinata authentication
   */
  async testAuth() {
    try {
      const response = await axios.get(`${this.pinataApiUrl}/data/testAuthentication`, {
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretApiKey
        },
        timeout: 10000
      });
      console.log('✓ Pinata authentication successful:', response.data);
      return true;
    } catch (error) {
      console.error('✗ Pinata authentication failed:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new IPFSService();