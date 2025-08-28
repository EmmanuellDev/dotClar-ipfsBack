# Smart Contract Versioning API

A complete Node.js + Express backend that automatically assigns semantic version numbers to smart contract deployments with MongoDB storage.

## Features

- **Automatic Semantic Versioning**: Assigns version numbers in MAJOR.MINOR.PATCH format starting from "0.1.0"
- **Version Management**: Automatically increments PATCH version for existing repositories
- **MongoDB Storage**: Persistent storage with optimized indexes
- **RESTful API**: Clean, well-documented endpoints
- **Error Handling**: Comprehensive validation and error responses
- **Production Ready**: Modular code structure with proper logging

## Project Structure

```
├── server.js                          # Entry point
├── config/
│   └── db.js                         # MongoDB connection
├── models/
│   └── Deployment.js                 # Mongoose schema
├── controllers/
│   └── deploymentController.js       # Business logic
├── routes/
│   └── deploymentRoutes.js          # Express routes
├── utils/
│   └── versionManager.js            # Version calculation utilities
├── package.json                      # Dependencies
├── .env.example                      # Environment variables template
└── README.md                         # This file
```

## Installation

1. **Clone and install dependencies:**
```bash
npm install express mongoose cors body-parser dotenv nodemon
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```
Edit `.env` with your MongoDB connection string.

3. **Start MongoDB** (if running locally):
```bash
# Using MongoDB Community Edition
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. **Run the application:**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### 1. Deploy Contract
**POST** `/api/deploy`

Deploy a new smart contract and get an automatically assigned version.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "contractCode": {
    "solidity": "pragma solidity ^0.8.0; contract MyContract { ... }",
    "abi": [...],
    "bytecode": "0x608060405234801561001057600080fd5b50..."
  },
  "contractRepoName": "my-smart-contract"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contract deployed successfully",
  "data": {
    "id": "64f5c8b9e1234567890abcdef",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "contractRepoName": "my-smart-contract",
    "version": "0.1.0",
    "deployedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Deployments by Wallet
**GET** `/api/deployments/:walletAddress`

Retrieve all deployments for a specific wallet address.

**Query Parameters:**
- `limit` (optional): Number of records to return (max 100, default 50)
- `offset` (optional): Number of records to skip (default 0)
- `sort` (optional): Sort order - "asc" or "desc" (default "desc")

**Example:**
```
GET /api/deployments/0x1234567890123456789012345678901234567890?limit=20&offset=0&sort=desc
```

**Response:**
```json
{
  "success": true,
  "message": "Deployments retrieved successfully",
  "data": {
    "deployments": [
      {
        "_id": "64f5c8b9e1234567890abcdef",
        "walletAddress": "0x1234567890123456789012345678901234567890",
        "contractRepoName": "my-smart-contract",
        "version": "0.1.1",
        "deployedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    },
    "statistics": {
      "totalDeployments": 25,
      "uniqueRepositories": 3,
      "repositories": [...]
    }
  }
}
```

### 3. Get Repository Deployment History
**GET** `/api/deployments/:walletAddress/:repo`

Get the deployment history for a specific repository.

**Query Parameters:**
- `limit` (optional): Number of records (max 100, default 50)
- `offset` (optional): Records to skip (default 0)
- `includeCode` (optional): Include contract code in response ("true" or "false", default "false")

**Example:**
```
GET /api/deployments/0x1234567890123456789012345678901234567890/my-smart-contract?includeCode=true
```

### 4. Get Deployment by ID
**GET** `/api/deployment/:id`

Get a specific deployment by its MongoDB ObjectId.

### 5. Get Wallet Statistics
**GET** `/api/stats/:walletAddress`

Get comprehensive deployment statistics for a wallet.

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "totalDeployments": 25,
    "uniqueRepositories": 3,
    "repositories": [...],
    "versionStatistics": {
      "total": 25,
      "latest": "0.1.5",
      "oldest": "0.1.0",
      "majorReleases": 1,
      "minorReleases": 1,
      "patchReleases": 25
    }
  }
}
```

## Version Management Logic

- **First deployment** of a repository: Assigns version `"0.1.0"`
- **Subsequent deployments** of the same repository: Increments PATCH version (e.g., `"0.1.0"` → `"0.1.1"`)
- **Version format**: Follows semantic versioning `MAJOR.MINOR.PATCH`

## Database Schema

The `Deployment` model includes:

```javascript
{
  walletAddress: String,      // Ethereum wallet address (validated)
  contractRepoName: String,   // Repository name
  contractCode: Object,       // Contract code as JSON
  version: String,           // Semantic version (MAJOR.MINOR.PATCH)
  deployedAt: Date,          // Deployment timestamp
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

## Environment Variables

Create a `.env` file with:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/smart_contract_versioning
```

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: Invalid input data, malformed requests
- **404 Not Found**: Resource not found
- **409 Conflict**: Duplicate entries
- **500 Internal Server Error**: Server-side errors

All errors return a consistent format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed validation errors if applicable"]
}
```

## Production Considerations

1. **Database**: Use MongoDB Atlas or a managed MongoDB service
2. **Environment**: Set `NODE_ENV=production`
3. **Security**: Add rate limiting, authentication, and input sanitization
4. **Monitoring**: Implement logging and monitoring solutions
5. **Scaling**: Consider horizontal scaling with load balancers

## Testing

Test the API using curl, Postman, or any HTTP client:

```bash
# Deploy a contract
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "contractCode": {"solidity": "contract Test {}"},
    "contractRepoName": "test-contract"
  }'

# Get deployments
curl http://localhost:3000/api/deployments/0x1234567890123456789012345678901234567890

# Health check
curl http://localhost:3000/health
```

## License

MIT License - Feel free to use this in your projects!