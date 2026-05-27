/**
 * RailwayService
 *
 * Queries Railway's GraphQL API v2 to fetch deployment logs for the current service.
 * Uses env vars injected automatically by Railway:
 *   RAILWAY_API_TOKEN   — personal/project token (set manually)
 *   RAILWAY_PROJECT_ID  — injected automatically by Railway
 *   RAILWAY_SERVICE_ID  — injected automatically by Railway
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const RAILWAY_GQL = "https://backboard.railway.app/graphql/v2";

@Injectable()
export class RailwayService {
  private readonly logger = new Logger(RailwayService.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string | undefined {
    return this.config.get<string>("RAILWAY_API_TOKEN");
  }

  private get projectId(): string | undefined {
    return this.config.get<string>("RAILWAY_PROJECT_ID");
  }

  private get serviceId(): string | undefined {
    return this.config.get<string>("RAILWAY_SERVICE_ID");
  }

  isConfigured(): boolean {
    return !!(this.token && this.projectId && this.serviceId);
  }

  /** Fetch the most recent deployment logs for the API service */
  async getRecentLogs(limit = 100): Promise<{ logs: string[]; deploymentId: string | null }> {
    if (!this.isConfigured()) {
      return { logs: ["Railway API not configured (RAILWAY_API_TOKEN missing)"], deploymentId: null };
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    // Step 1: get the latest deployment for our service
    let deploymentId: string | null = null;
    try {
      const deploymentsQuery = {
        query: `
          query GetDeployments($projectId: String!, $serviceId: String!) {
            deployments(
              input: { projectId: $projectId, serviceId: $serviceId }
              first: 1
            ) {
              edges {
                node {
                  id
                  status
                  createdAt
                }
              }
            }
          }
        `,
        variables: {
          projectId: this.projectId,
          serviceId: this.serviceId,
        },
      };

      const res = await fetch(RAILWAY_GQL, {
        method: "POST",
        headers,
        body: JSON.stringify(deploymentsQuery),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`[railway] deployments query failed (${res.status}): ${err}`);
        return { logs: [`Railway API error: ${res.status}`], deploymentId: null };
      }

      const data = (await res.json()) as any;
      deploymentId = data?.data?.deployments?.edges?.[0]?.node?.id ?? null;

      if (!deploymentId) {
        return { logs: ["No deployments found for this service"], deploymentId: null };
      }
    } catch (err: any) {
      this.logger.error(`[railway] Failed to fetch deployments: ${err?.message}`);
      return { logs: [`Error fetching deployments: ${err?.message}`], deploymentId: null };
    }

    // Step 2: get logs for that deployment
    try {
      const logsQuery = {
        query: `
          query GetDeploymentLogs($deploymentId: String!, $limit: Int!) {
            deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
              message
              timestamp
              severity
            }
          }
        `,
        variables: { deploymentId, limit },
      };

      const res = await fetch(RAILWAY_GQL, {
        method: "POST",
        headers,
        body: JSON.stringify(logsQuery),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`[railway] logs query failed (${res.status}): ${err}`);
        return { logs: [`Railway logs API error: ${res.status}`], deploymentId };
      }

      const data = (await res.json()) as any;
      const rawLogs: Array<{ message: string; timestamp: string; severity: string }> =
        data?.data?.deploymentLogs ?? [];

      const logs = rawLogs.map(
        (l) => `[${l.timestamp ?? ""}] [${l.severity ?? "INFO"}] ${l.message}`,
      );

      this.logger.log(`[railway] Fetched ${logs.length} log lines for deployment ${deploymentId}`);
      return { logs, deploymentId };
    } catch (err: any) {
      this.logger.error(`[railway] Failed to fetch logs: ${err?.message}`);
      return { logs: [`Error fetching logs: ${err?.message}`], deploymentId };
    }
  }
}
