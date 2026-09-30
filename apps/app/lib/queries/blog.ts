/**
 * @file Blog authoring (public while under test).
 *
 * Public readers never come through here: the marketing site fetches posts
 * server-side from the same tRPC procedures. This module only covers authoring.
 */

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { trpcClient } from "../trpc";

export const allPostsQueryKey = ["blog", "all"] as const;

export function allPostsQueryOptions() {
  return queryOptions({
    queryKey: allPostsQueryKey,
    queryFn: () => trpcClient.blog.all.query(),
  });
}

export function useAllPostsQuery() {
  return useQuery(allPostsQueryOptions());
}

export type NewPostInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  published: boolean;
};

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPostInput) => trpcClient.blog.create.mutate(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: allPostsQueryKey }),
  });
}

export function useRemovePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trpcClient.blog.remove.mutate({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: allPostsQueryKey }),
  });
}
