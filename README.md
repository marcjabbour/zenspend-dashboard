# ZenSpend Dashboard

A personal finance dashboard with voice AI integration for tracking expenses, budgets, and bank reconciliation.

## Architecture

This is a monorepo containing:
- **client/** - React 19 frontend with TanStack Query
- **server/** - Fastify backend with SQLite database
- **data/** - SQLite database storage (auto-created)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TanStack Query |
| Backend | Fastify, Drizzle ORM |
| Database | SQLite (better-sqlite3) |
| AI | Google Gemini (voice assistant) |

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example and add your Gemini API key
   cp client/.env.local.example client/.env.local
   # Edit client/.env.local and set GEMINI_API_KEY
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Seed default data (optional):**
   ```bash
   npm run db:seed
   ```

5. **Start development servers:**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Migrating from localStorage

If you have existing data in localStorage from the previous version:

1. Open the browser console on the old version
2. Run this to export your data:
   ```javascript
   const data = {
     categories: JSON.parse(localStorage.getItem('zen_categories') || '[]'),
     transactions: JSON.parse(localStorage.getItem('zen_transactions') || '[]'),
     settings: JSON.parse(localStorage.getItem('zen_settings') || '{}'),
   };
   console.log(JSON.stringify(data));
   ```
3. Copy the output
4. POST it to `http://localhost:3001/api/migrate/import`

## API Endpoints

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Transactions
- `GET /api/transactions` - List transactions (with filters)
- `POST /api/transactions` - Create transaction
- `POST /api/transactions/recurring` - Create recurring (12-month)
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

### Migration
- `POST /api/migrate/import` - Import localStorage data
- `GET /api/migrate/export` - Export all data

## Features

- Transaction tracking (expenses, income, CC payments)
- Budget categories with weekly/monthly periods
- Recurring fixed costs (12-month auto-generation)
- Financial calendar with drag-and-drop
- Bank account reconciliation (Sanity Check)
- Privacy mode (blur values)
- Voice AI assistant (Gemini Live API)

## AI Architecture: MCP + Gemini Live

The app includes a **Live Agent** that uses the Gemini Live API for real-time voice interaction. The agent can log transactions, query budgets, and manage your finances through natural conversation.

### How it works

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Browser        │◄──────────────────►│  Gemini Live    │
│  (LiveAgent)    │    Audio/Text      │  API            │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ HTTP/REST                            │ Tool Calls
         ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│  Fastify        │◄───────────────────│  MCP Server     │
│  Backend API    │    (same routes)   │  (Tool Defs)    │
└─────────────────┘                    └─────────────────┘
```

1. **MCP Server** (`mcp-server/`) defines 8 tools using the Model Context Protocol:
   - `log_transaction` - Create expenses, income, or CC payments
   - `get_transactions` - Query transactions with filters
   - `delete_transaction` - Remove a transaction
   - `get_categories` - List budget categories
   - `create_category` - Add new category
   - `get_budget_status` - Check spending vs budget
   - `get_settings` - Retrieve user preferences
   - `update_settings` - Modify settings

2. **Gemini Live API** receives these tool definitions as `FunctionDeclaration` objects and can invoke them during voice conversations.

3. **LiveAgentOverlay** component handles the bidirectional audio stream and routes tool calls to the backend API.

### Running the MCP Server

The MCP server is designed for use with Claude Desktop or other MCP-compatible clients:

```bash
cd mcp-server
npm run build
npm start
```

Configure in Claude Desktop's `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "zenspend": {
      "command": "node",
      "args": ["/path/to/zenspend-dashboard/mcp-server/dist/index.js"],
      "env": {
        "ZENSPEND_API_URL": "http://localhost:3001/api"
      }
    }
  }
}
```

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | `client/.env.local` | Gemini API key for Live Agent |
| `ZENSPEND_API_URL` | MCP Server env | Backend API URL (default: `http://localhost:3001/api`) |
