# MongoDB MCP Server for Vercel

A read-only MongoDB MCP (Model Context Protocol) server designed for serverless deployment on Vercel. Provides secure, limited access to MongoDB databases for AI assistants and MCP-compatible clients.

## Features

- 🔒 **Secure by default** - API key authentication, read-only operations, query limits
- ⚡ **Serverless optimized** - Designed for Vercel's edge/serverless environment
- 🛡️ **Safety guardrails** - Dangerous operators blocked, query timeouts, result limits
- 📊 **6 MongoDB tools** - find, aggregate, count, list-collections, explain, collection-schema

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```bash
# MongoDB Connection (use a read-only user!)
MONGODB_URI=mongodb+srv://readonly_user:password@cluster.mongodb.net
MONGODB_DB=your_database_name

# API Key for authentication (generate with: openssl rand -base64 32)
API_KEY=your_generated_api_key
```

### 3. Run locally

```bash
npm run dev
```

The MCP server will be available at `http://localhost:3000/mcp`

## Tools

| Tool | Description |
|------|-------------|
| `find` | Query documents with filtering, projection, sorting, and limiting |
| `aggregate` | Run aggregation pipelines for data transformation and analysis |
| `count` | Count documents matching a filter |
| `list-collections` | List all user collections in the database |
| `explain` | Get query execution plans for performance analysis |
| `collection-schema` | Infer schema by sampling documents |

## Security

### Built-in protections

- **Fixed database** - Only the database specified in `MONGODB_DB` is accessible
- **API key required** - All requests must include `X-API-Key` header
- **Query limits** - Max 100 documents per query, 30s timeout
- **Blocked operators** - `$where`, `$function`, `$accumulator` are rejected
- **Blocked stages** - `$out`, `$merge`, `$lookup` are rejected in aggregations
- **EJSON serialization** - Proper handling of BSON types (ObjectId, Date, etc.)

### Recommendations

1. **Use a read-only MongoDB user** - Create a user with only `read` role
2. **Rotate API keys** - Generate new keys periodically
3. **Monitor usage** - Enable Vercel Analytics to track requests

## Usage

### With cURL

```bash
# Initialize connection
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'

# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'

# Call a tool (list collections)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list-collections","arguments":{}},"id":3}'

# Find documents
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"find","arguments":{"collection":"users","filter":{"status":"active"},"limit":10}},"id":4}'
```

### With MCP Inspector

1. Open [MCP Inspector](https://inspector.modelcontextprotocol.io)
2. Set **Transport Type**: `Streamable HTTP`
3. Set **URL**: `http://localhost:3000/mcp`
4. In **Authentication > Custom Headers**, add:
   - `X-API-Key`: your API key
   - `Accept`: `application/json, text/event-stream`
5. Enable both header toggles and click **Connect**

### With Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mongodb": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

For production deployment:

```json
{
  "mcpServers": {
    "mongodb": {
      "url": "https://your-app.vercel.app/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `API_KEY`
4. Deploy

### 3. Configure MongoDB Network Access

Make sure your MongoDB Atlas cluster allows connections from Vercel:
- Add `0.0.0.0/0` to IP Access List (for serverless), or
- Use [Vercel's static IP addresses](https://vercel.com/docs/security/secure-compute#allowlisting-ip-addresses)

## API Reference

### Tool: `find`

Query documents from a collection.

```json
{
  "collection": "users",
  "filter": { "status": "active" },
  "projection": { "name": 1, "email": 1, "_id": 0 },
  "sort": { "createdAt": -1 },
  "limit": 10
}
```

### Tool: `aggregate`

Run an aggregation pipeline.

```json
{
  "collection": "orders",
  "pipeline": [
    { "$match": { "status": "completed" } },
    { "$group": { "_id": "$customerId", "total": { "$sum": "$amount" } } },
    { "$sort": { "total": -1 } }
  ]
}
```

### Tool: `count`

Count documents matching a filter.

```json
{
  "collection": "products",
  "filter": { "inStock": true }
}
```

### Tool: `list-collections`

List all collections in the database. No arguments required.

```json
{}
```

### Tool: `explain`

Get the execution plan for a query.

```json
{
  "collection": "users",
  "operation": "find",
  "operationArgs": {
    "filter": { "email": "test@example.com" }
  }
}
```

### Tool: `collection-schema`

Infer schema by sampling documents.

```json
{
  "collection": "users",
  "sampleSize": 100
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB` | Yes | Database name to use |
| `API_KEY` | Yes | API key for authentication |

## Based On

This project combines ideas and code from:

- **[vercel-labs/mcp-for-next.js](https://github.com/vercel-labs/mcp-for-next.js)** - Vercel's official template for deploying MCP servers on Next.js. Provides the serverless-compatible architecture and `mcp-handler` integration.

- **[mongodb-js/mongodb-mcp-server](https://github.com/mongodb-js/mongodb-mcp-server)** - MongoDB's official MCP server. The tool implementations (find, aggregate, count, explain, collection-schema) are adapted from this project with security hardening for public deployment.