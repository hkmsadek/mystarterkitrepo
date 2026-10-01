import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

type Props = { courseId: string; slug: string; free: boolean };

type Status = "loading" | "anonymous" | "ready" | "enrolled" | "busy" | "error";

/**
 * Enrol in a course from its public page.
 *
 * Signed out: go to sign-up and come back here. Signed in: call the API, then
 * go to the dashboard, which lists the programme. The island checks the
 * current enrolments on mount so a returning student sees "Enrolled".
 */
export function EnrollButton({ courseId, slug, free }: Props) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/trpc/course.myEnrollments", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) return setStatus("anonymous");
        if (!response.ok) return setStatus("error");
        const body = (await response.json()) as {
          result: { data: { courseId: string }[] };
        };
        setStatus(
          body.result.data.some((e) => e.courseId === courseId)
            ? "enrolled"
            : "ready",
        );
      })
      .catch(() => setStatus("error"));
    return () => controller.abort();
  }, [courseId]);

  async function enroll() {
    setStatus("busy");
    const response = await fetch("/api/trpc/course.enroll", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    if (!response.ok) return setStatus("error");
    window.location.assign("/");
  }

  const returnTo = encodeURIComponent(`/courses/${slug}`);

  if (status === "anonymous") {
    return (
      <Button className="w-full" asChild>
        <a href={`/signup?returnTo=${returnTo}`}>
          {free ? "Start for free" : "Sign up to enrol"}
        </a>
      </Button>
    );
  }

  if (status === "enrolled") {
    return (
      <Button className="w-full" variant="outline" asChild>
        <a href="/">Enrolled · Open dashboard</a>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        onClick={enroll}
        disabled={status === "loading" || status === "busy"}
      >
        {status === "busy" ? "Enrolling…" : free ? "Enrol for free" : "Enrol"}
      </Button>
      {status === "error" && (
        <p className="text-sm text-destructive">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
