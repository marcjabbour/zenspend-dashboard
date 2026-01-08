import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.ZENSPEND_API_URL || "http://localhost:3001/api";

// Helper function for API requests
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const data = (await response.json()) as { data?: T; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message || "API request failed");
  }

  return data.data as T;
}

// Create MCP server
const server = new McpServer({
  name: "zenspend",
  version: "1.0.0",
});

// ============================================
// TRANSACTION TOOLS
// ============================================

server.tool(
  "log_transaction",
  {
    amount: z.number().positive().describe("Amount in currency (e.g., 50 for $50)"),
    description: z.string().describe("What was purchased (e.g., 'Coffee at Starbucks')"),
    categoryId: z.string().describe("Category ID: 'groceries', 'outings', 'misc', or 'fixed' for recurring costs"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format (e.g., '2025-01-08')"),
    type: z.enum(["expense", "income", "cc_payment"]).describe("Transaction type"),
    isFixed: z.boolean().optional().describe("Set true for recurring monthly expenses like rent or subscriptions"),
  },
  async (params) => {
    const transaction = await apiRequest("/transactions", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return {
      content: [
        {
          type: "text",
          text: `Transaction logged successfully:\n${JSON.stringify(transaction, null, 2)}`,
        },
      ],
    };
  }
);

server.tool(
  "get_transactions",
  {
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Filter from date (YYYY-MM-DD)"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Filter to date (YYYY-MM-DD)"),
    categoryId: z.string().optional().describe("Filter by category ID"),
    type: z.enum(["expense", "income", "cc_payment"]).optional().describe("Filter by transaction type"),
  },
  async (params) => {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.set("startDate", params.startDate);
    if (params.endDate) queryParams.set("endDate", params.endDate);
    if (params.categoryId) queryParams.set("categoryId", params.categoryId);
    if (params.type) queryParams.set("type", params.type);

    const query = queryParams.toString();
    const transactions = await apiRequest<any[]>(`/transactions${query ? `?${query}` : ""}`);

    if (transactions.length === 0) {
      return {
        content: [{ type: "text", text: "No transactions found matching the criteria." }],
      };
    }

    const summary = transactions.map((t) =>
      `- ${t.date}: ${t.type === "income" ? "+" : "-"}$${t.amount} - ${t.description} (${t.categoryId || "uncategorized"})`
    ).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${transactions.length} transactions:\n\n${summary}`,
        },
      ],
    };
  }
);

server.tool(
  "delete_transaction",
  {
    id: z.string().describe("The transaction ID to delete"),
  },
  async ({ id }) => {
    await apiRequest(`/transactions/${id}`, { method: "DELETE" });
    return {
      content: [{ type: "text", text: `Transaction ${id} deleted successfully.` }],
    };
  }
);

server.tool(
  "get_spending_summary",
  {
    period: z.enum(["week", "month"]).describe("Time period for summary"),
  },
  async ({ period }) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (period === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(now);
      weekStart.setDate(diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      startDate = weekStart.toISOString().split("T")[0];
      endDate = weekEnd.toISOString().split("T")[0];
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    }

    const transactions = await apiRequest<any[]>(
      `/transactions?startDate=${startDate}&endDate=${endDate}`
    );
    const categories = await apiRequest<any[]>("/categories");

    // Calculate totals by category
    const byCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let totalIncome = 0;
    let fixedCosts = 0;

    for (const tx of transactions) {
      if (tx.type === "expense") {
        totalExpenses += tx.amount;
        if (tx.isFixed || tx.categoryId === "fixed") {
          fixedCosts += tx.amount;
        } else {
          byCategory[tx.categoryId || "uncategorized"] =
            (byCategory[tx.categoryId || "uncategorized"] || 0) + tx.amount;
        }
      } else if (tx.type === "income") {
        totalIncome += tx.amount;
      }
    }

    // Build summary text
    let summary = `## ${period === "week" ? "Weekly" : "Monthly"} Spending Summary\n`;
    summary += `**Period:** ${startDate} to ${endDate}\n\n`;
    summary += `**Total Expenses:** $${totalExpenses.toFixed(2)}\n`;
    summary += `**Total Income:** $${totalIncome.toFixed(2)}\n`;
    summary += `**Fixed Costs:** $${fixedCosts.toFixed(2)}\n`;
    summary += `**Variable Spending:** $${(totalExpenses - fixedCosts).toFixed(2)}\n\n`;

    if (Object.keys(byCategory).length > 0) {
      summary += "### By Category:\n";
      for (const [catId, amount] of Object.entries(byCategory)) {
        const cat = categories.find((c) => c.id === catId);
        summary += `- ${cat?.name || catId}: $${amount.toFixed(2)}\n`;
      }
    }

    return { content: [{ type: "text", text: summary }] };
  }
);

// ============================================
// CATEGORY TOOLS
// ============================================

server.tool(
  "list_categories",
  {},
  async () => {
    const categories = await apiRequest<any[]>("/categories");

    if (categories.length === 0) {
      return {
        content: [{ type: "text", text: "No categories configured yet." }],
      };
    }

    const list = categories.map((c) => {
      const budgetType = c.period === "weekly" ? "/week" : "/month";
      return `- **${c.name}** (id: ${c.id}): $${c.weeklyBudget}${budgetType}`;
    }).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `## Budget Categories\n\n${list}\n\nUse 'fixed' as categoryId for recurring monthly costs.`,
        },
      ],
    };
  }
);

server.tool(
  "get_budget_status",
  {
    period: z.enum(["week", "month"]).optional().default("month").describe("Budget period to check"),
  },
  async ({ period }) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (period === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(now);
      weekStart.setDate(diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      startDate = weekStart.toISOString().split("T")[0];
      endDate = weekEnd.toISOString().split("T")[0];
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    }

    const [transactions, categories, settings] = await Promise.all([
      apiRequest<any[]>(`/transactions?startDate=${startDate}&endDate=${endDate}`),
      apiRequest<any[]>("/categories"),
      apiRequest<any>("/settings"),
    ]);

    // Calculate spending per category
    const spent: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type === "expense" && !tx.isFixed && tx.categoryId !== "fixed") {
        spent[tx.categoryId || "uncategorized"] =
          (spent[tx.categoryId || "uncategorized"] || 0) + tx.amount;
      }
    }

    // Build status
    let status = `## Budget Status (${period})\n\n`;
    status += `**Monthly Income:** ${settings.currency}${settings.monthlyIncome}\n\n`;
    status += "### Category Breakdown:\n\n";

    for (const cat of categories) {
      const categorySpent = spent[cat.id] || 0;
      const budget = cat.period === "weekly" && period === "month"
        ? cat.weeklyBudget * 4.33
        : cat.weeklyBudget;
      const remaining = budget - categorySpent;
      const percentUsed = budget > 0 ? (categorySpent / budget) * 100 : 0;
      const emoji = percentUsed > 100 ? "🔴" : percentUsed > 80 ? "🟡" : "🟢";

      status += `${emoji} **${cat.name}**: ${settings.currency}${categorySpent.toFixed(0)} / ${settings.currency}${budget.toFixed(0)}`;
      status += ` (${percentUsed.toFixed(0)}% used, ${settings.currency}${remaining.toFixed(0)} remaining)\n`;
    }

    return { content: [{ type: "text", text: status }] };
  }
);

// ============================================
// SETTINGS TOOLS
// ============================================

server.tool(
  "get_settings",
  {},
  async () => {
    const settings = await apiRequest<any>("/settings");

    const info = `## Account Settings

**Monthly Income:** ${settings.currency}${settings.monthlyIncome}
**Currency:** ${settings.currency}
**Checking Balance:** ${settings.currency}${settings.checkingBalance}
**Credit Card Balance:** ${settings.currency}${settings.creditCardBalance}
**Balance As Of:** ${settings.balanceAsOf}
**Show Fixed Costs:** ${settings.showFixedCosts ? "Yes" : "No"}`;

    return { content: [{ type: "text", text: info }] };
  }
);

server.tool(
  "update_balance",
  {
    checkingBalance: z.number().optional().describe("New checking account balance"),
    creditCardBalance: z.number().optional().describe("New credit card balance"),
  },
  async (params) => {
    if (params.checkingBalance === undefined && params.creditCardBalance === undefined) {
      return {
        content: [{ type: "text", text: "Please provide at least one balance to update." }],
      };
    }

    const updates: Record<string, any> = {
      balanceAsOf: new Date().toISOString(),
    };
    if (params.checkingBalance !== undefined) updates.checkingBalance = params.checkingBalance;
    if (params.creditCardBalance !== undefined) updates.creditCardBalance = params.creditCardBalance;

    const settings = await apiRequest("/settings", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    return {
      content: [
        {
          type: "text",
          text: `Balances updated successfully:\n${JSON.stringify(settings, null, 2)}`,
        },
      ],
    };
  }
);

// ============================================
// START SERVER
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ZenSpend MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
