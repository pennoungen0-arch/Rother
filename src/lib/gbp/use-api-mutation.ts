"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UseApiMutationOptions<TData = unknown, TVariables = Record<string, unknown>> {
  invalidateKeys?: string[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error) => void;
}

export interface ApiMutationResult<T = unknown> {
  mutate: (variables: Record<string, unknown> | undefined) => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
  data: T | null;
}

export function useApiMutation<T = unknown>(
  url: string,
  options: UseApiMutationOptions<T> = {},
): ApiMutationResult<T> {
  const queryClient = useQueryClient();

  const mutation = useMutation<T, Error, Record<string, unknown> | undefined>({
    mutationFn: async (variables) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: variables ? JSON.stringify(variables) : undefined,
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`HTTP ${r.status}: ${text}`);
      }
      return (await r.json()) as T;
    },
    onSuccess: (data, variables) => {
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
      options.onSuccess?.(data, variables ?? {});
    },
    onError: (err) => {
      options.onError?.(err);
    },
  });

  return {
    mutate: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error ?? null,
    data: mutation.data ?? null,
  };
}
