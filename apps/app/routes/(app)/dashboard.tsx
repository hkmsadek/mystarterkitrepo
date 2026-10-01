import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CreditCard, type LucideIcon, Users } from "lucide-react";

import { useBillingQuery } from "#lib/queries/billing";
import { useMyEnrollmentsQuery } from "#lib/queries/course";
import { useMembersQuery } from "#lib/queries/organization";
import { useSessionQuery } from "#lib/queries/session";
import type { FileRoutesByTo } from "#lib/routeTree.gen";

export const Route = createFileRoute("/(app)/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: session } = useSessionQuery();
  const activeOrgId = session?.session?.activeOrganizationId;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Welcome back{session?.user.name ? `, ${session.user.name}` : ""}
        </h2>
        <p className="text-muted-foreground">
          Signed in as {session?.user.email}.
        </p>
      </div>

      {/* Each card owns its query so one failing request degrades a single
          card instead of the page. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MembersCard activeOrgId={activeOrgId} />
        <PlanCard activeOrgId={activeOrgId} />
      </div>

      <ProgrammesSection />
    </div>
  );
}

function ProgrammesSection() {
  const { data, isPending, error } = useMyEnrollmentsQuery();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your programmes</h3>
        {/* Document navigation: the catalogue is a marketing page. */}
        <a
          href="/courses"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse all
        </a>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading programmes...</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Could not load programmes: {error.message}
        </p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-muted-foreground">
              You are not enrolled in anything yet. Sleep Reset is free and a
              good first step.
            </p>
            <a
              href="/courses/sleep-reset"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open Sleep Reset
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((e) => (
            <a
              key={e.courseId}
              href={`/courses/${e.slug}`}
              aria-label={`Open ${e.title}`}
              className="rounded-xl outline-offset-2"
            >
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {e.title}
                  </CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{e.summary}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.level} · {e.lessonCount} lessons
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function MembersCard({ activeOrgId }: { activeOrgId?: string | null }) {
  const { data: members, error } = useMembersQuery(activeOrgId);

  // "—", not "0": no active organization means no scope to count within, which
  // is not the same as an organization with no members.
  if (!activeOrgId) {
    return (
      <SummaryCard
        to="/members"
        icon={Users}
        title="Members"
        value="—"
        description="No active organization"
      />
    );
  }

  return (
    <SummaryCard
      to="/members"
      icon={Users}
      title="Members"
      // A failed request must not read as a resolved count, so it says so
      // rather than reusing the pending placeholder.
      value={error ? "Unavailable" : (members?.total ?? "—")}
      description={
        error ? "Could not load members" : "People in your active organization"
      }
    />
  );
}

function PlanCard({ activeOrgId }: { activeOrgId?: string | null }) {
  const { data: billing, error } = useBillingQuery(activeOrgId);

  if (error) {
    return (
      <SummaryCard
        to="/settings"
        icon={CreditCard}
        title="Plan"
        value="Unavailable"
        description="Could not load billing"
      />
    );
  }

  // Withheld until the query resolves: deployments without `STRIPE_*` report
  // `enabled: false`, and a placeholder would claim billing this app does not
  // have. Only a successful response can establish that absence.
  if (!billing?.enabled) return null;

  return (
    <SummaryCard
      to="/settings"
      icon={CreditCard}
      title="Plan"
      value={billing.plan}
      description={
        billing.status ? `Subscription ${billing.status}` : "No subscription"
      }
    />
  );
}

function SummaryCard({
  to,
  icon: Icon,
  title,
  value,
  description,
}: {
  to: keyof FileRoutesByTo;
  icon: LucideIcon;
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <Link to={to} className="rounded-xl outline-offset-2">
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">{value}</div>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
