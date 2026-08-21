import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe for the load balancer.
 *
 * Deliberately **shallow**: it answers for the process and touches nothing else.
 * The temptation is to check the database here so that "healthy" means "can
 * actually serve", but a health check is not a monitor — it is a control input
 * to something that replaces instances. A probe that fails when the database
 * blips would have App Runner kill every healthy container in the service and
 * replace them, each replacement also failing its first probe, turning a
 * recoverable database incident into a total and self-sustaining outage.
 *
 * Depth belongs in alarms, which page a human, rather than in a probe wired to
 * an actuator. `docs/aws-rds-production-plan.md` already lists the RDS alarms
 * that own that job.
 *
 * It is unauthenticated because a load balancer cannot hold a credential, and it
 * is safe to be: it reveals nothing but the fact that a server answered, which
 * anyone can already learn by opening the site.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      // Never cached: a cached health check reports the last deploy's liveness.
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
