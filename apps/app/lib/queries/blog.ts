/**
 * @file The signed-in user's blog posts.
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

export const myPostsQueryKey = ["blog", "mine"] as const;

export function myPostsQueryOptions() {
  return queryOptions({
    queryKey: myPostsQueryKey,
    queryFn: () => trpcClient.blog.mine.query(),
  });
}

export function useMyPostsQuery() {
  return useQuery(myPostsQueryOptions());
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
      queryClient.invalidateQueries({ queryKey: myPostsQueryKey }),
  });
}

export function useRemovePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trpcClient.blog.remove.mutate({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: myPostsQueryKey }),
  });
}
