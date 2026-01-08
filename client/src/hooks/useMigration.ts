import { useMutation, useQueryClient } from '@tanstack/react-query';
import { migrateApi, ImportData } from '../services/api';

export function useImportData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ImportData) => migrateApi.import(data),
    onSuccess: () => {
      // Invalidate all queries to reload fresh data from the database
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: () => migrateApi.export(),
  });
}
