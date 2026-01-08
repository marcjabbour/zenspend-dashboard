import { Category, Transaction, UserSettings, RecurrenceAction } from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = { ...options?.headers };
  // Only set Content-Type for requests with a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN_ERROR',
      json.error?.message || 'An unknown error occurred',
      json.error?.details
    );
  }

  return json.data;
}

// Categories API
export const categoriesApi = {
  getAll: () => request<Category[]>('/categories'),

  getById: (id: string) => request<Category>(`/categories/${id}`),

  create: (data: Omit<Category, 'id'>) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Category>) =>
    request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ deleted: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    }),
};

// Transactions API
export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: 'expense' | 'income' | 'cc_payment';
  isFixed?: boolean;
}

export const transactionsApi = {
  getAll: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.isFixed !== undefined) params.set('isFixed', String(filters.isFixed));
    const query = params.toString();
    return request<Transaction[]>(`/transactions${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => request<Transaction>(`/transactions/${id}`),

  create: (data: Omit<Transaction, 'id'>) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createRecurring: (base: Omit<Transaction, 'id'>, months: number = 12) =>
    request<Transaction[]>('/transactions/recurring', {
      method: 'POST',
      body: JSON.stringify({ base, months }),
    }),

  update: (id: string, data: Partial<Transaction>) =>
    request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateGroup: (groupId: string, updates: Partial<Transaction>, scope: 'all' | 'future', fromDate?: string) =>
    request<Transaction[]>(`/transactions/group/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ updates, scope, fromDate }),
    }),

  delete: (id: string) =>
    request<{ deleted: boolean }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  deleteGroup: (groupId: string, scope: 'all' | 'future', fromDate?: string) => {
    const params = new URLSearchParams({ scope });
    if (fromDate) params.set('fromDate', fromDate);
    return request<{ deleted: number }>(`/transactions/group/${groupId}?${params}`, {
      method: 'DELETE',
    });
  },
};

// Settings API
export const settingsApi = {
  get: () => request<UserSettings>('/settings'),

  update: (data: Partial<UserSettings>) =>
    request<UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Migration API
export interface ImportData {
  categories: Category[];
  transactions: Transaction[];
  settings: UserSettings;
}

export const migrateApi = {
  import: (data: ImportData) =>
    request<{ categoriesImported: number; transactionsImported: number; settingsUpdated: boolean }>(
      '/migrate/import',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  export: () =>
    request<{
      categories: Category[];
      transactions: Transaction[];
      settings: UserSettings;
      exportedAt: string;
    }>('/migrate/export'),
};
