/**
 * @file The signed-in user's todo list.
 *
 * One list key: every mutation invalidates it rather than patching the cache,
 * because the server orders and scopes the rows and a local patch would have
 * to re-implement both.
 */

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { trpcClient } from "../trpc";

export const todoQueryKey = ["todo", "list"] as const;

export function todoQueryOptions() {
  return queryOptions({
    queryKey: todoQueryKey,
    queryFn: () => trpcClient.todo.list.query(),
  });
}

export function useTodosQuery() {
  return useQuery(todoQueryOptions());
}

function useInvalidateTodos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: todoQueryKey });
}

export function useCreateTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (title: string) => trpcClient.todo.create.mutate({ title }),
    onSuccess: invalidate,
  });
}

export function useSetTodoCompleted() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      trpcClient.todo.setCompleted.mutate(input),
    onSuccess: invalidate,
  });
}

export function useRemoveTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (id: string) => trpcClient.todo.remove.mutate({ id }),
    onSuccess: invalidate,
  });
}
