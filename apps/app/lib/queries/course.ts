/**
 * @file The signed-in user's programme enrolments.
 *
 * Enrolling happens on the public course page, an island on the marketing
 * site, so this module only reads. The dashboard lists what it returns.
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { trpcClient } from "../trpc";

export const myEnrollmentsQueryKey = ["course", "myEnrollments"] as const;

export function myEnrollmentsQueryOptions() {
  return queryOptions({
    queryKey: myEnrollmentsQueryKey,
    queryFn: () => trpcClient.course.myEnrollments.query(),
  });
}

export function useMyEnrollmentsQuery() {
  return useQuery(myEnrollmentsQueryOptions());
}
