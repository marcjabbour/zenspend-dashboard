import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, TransactionFilters } from '../services/api';
import { Transaction, RecurrenceAction } from '../types';

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.getAll(filters),
  });
}

interface CreateTransactionParams {
  data: Omit<Transaction, 'id'>;
  isRecurring?: boolean;
  months?: number;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, isRecurring, months = 12 }: CreateTransactionParams) => {
      if (isRecurring) {
        return transactionsApi.createRecurring(data, months);
      }
      return transactionsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

interface UpdateTransactionParams {
  id: string;
  data: Partial<Transaction>;
  recurrence?: RecurrenceAction;
  groupId?: string;
  fromDate?: string;
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data, recurrence, groupId, fromDate }: UpdateTransactionParams) => {
      if (recurrence && groupId && recurrence !== 'one') {
        const scope = recurrence === 'all' ? 'all' : 'future';
        return transactionsApi.updateGroup(groupId, data, scope, fromDate);
      }
      return transactionsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

interface DeleteTransactionParams {
  id: string;
  recurrence?: RecurrenceAction;
  groupId?: string;
  fromDate?: string;
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, recurrence, groupId, fromDate }: DeleteTransactionParams) => {
      if (recurrence && groupId && recurrence !== 'one') {
        const scope = recurrence === 'all' ? 'all' : 'future';
        return transactionsApi.deleteGroup(groupId, scope, fromDate);
      }
      return transactionsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
