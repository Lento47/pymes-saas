# PymeHub Scalability & Infrastructure Plan

## Executive Summary
This plan outlines how to scale PymeHub from supporting hundreds to thousands of concurrent users while optimizing costs and resource utilization. The architecture uses Cloudflare Workers for edge distribution, horizontal scaling on the backend, and intelligent caching strategies.

---

## Current Architecture Overview
- **Frontend**: React SPA on Cloudflare Workers (edge-deployed)
- **Backend**: NestJS API on Railway/Docker
- **Database**: PostgreSQL (managed)
- **Real-time**: Socket.io WebSocket connections
- **Queue**: BullMQ (job processing)
- **Cache**: Redis (session, data)

---

## Phase 1: Frontend Scalability (CDN & Edge Computing)

### 1.1 Cloudflare Workers Optimization
**Already in use** - Leverage fully for maximum reach:

```javascript
// Implement response caching strategy
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const cacheKey = new Request(url.toString(), { method: 'GET' })
  const cache = caches.default
  
  // Cache strategy by path
  if (url.pathname.startsWith('/api/')) {
    // API routes: cache if GET with no auth
    if (request.method === 'GET' && !request.headers.get('Authorization')) {
      const cached = await cache.match(cacheKey)
      if (cached) return cached
    }
    return fetch(request)
  } else {
    // Static assets: aggressive caching
    const cached = await cache.match(cacheKey)
    if (cached) return cached
    
    const response = await fetch(request)
    if (response.status === 200) {
      const ttl = url.pathname.match(/\.(js|css|png|jpg|svg)$/) ? 31536000 : 3600
      response.headers.set('Cache-Control', `public, max-age=${ttl}`)
      cache.put(cacheKey, response.clone())
    }
    return response
  }
}
```

### 1.2 Assets Optimization
- **Code Splitting**: Bundle-split by route (pricing, dashboard, settings)
- **Image Optimization**: Use WebP with fallbacks, lazy-load below fold
- **Service Worker**: Offline fallback + precaching critical assets
- **Compression**: Enable Brotli compression (Cloudflare default)

### 1.3 Static Assets Distribution
```
/images          → Cache 1 year (versioned filenames)
/fonts          → Cache 1 year (versioned)
/static/*       → Cache 24 hours
/api/*          → No cache (or short: 5 min for public endpoints)
/              → Cache 5 minutes (index.html)
```

**Result**: 80% of requests served from edge cache, <100ms latency globally

---

## Phase 2: Backend Scalability (Horizontal Scaling)

### 2.1 Containerization & Orchestration
**Current**: Single Railway deployment  
**Scalable**: Docker + Kubernetes (or Docker Swarm)

```dockerfile
# apps/api/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Deployment**: 
- Dev: 1 API instance
- Staging: 2 API instances
- Production: 3-5 API instances (scale up to 10 under load)

### 2.2 Load Balancing
Use **Railway load balancer** or deploy **Nginx/HAProxy**:

```nginx
upstream api_backend {
  least_conn;
  server api-1:3000 weight=2;
  server api-2:3000 weight=2;
  server api-3:3000 weight=1;  # Canary for new deploys
}

server {
  listen 80;
  server_name api.pymeshub.lat;
  
  location / {
    proxy_pass http://api_backend;
    proxy_set_header Connection "";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Retry on failure
    proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    proxy_next_upstream_tries 2;
  }
}
```

### 2.3 Graceful Shutdown & Health Checks
```typescript
// src/main.ts
const app = await NestFactory.create(AppModule);
const server = await app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully...');
  app.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Health check endpoint
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', timestamp: Date.now() };
  }
}
```

### 2.4 Connection Pooling
```typescript
// Database connection pool (already in Prisma)
const prismaClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // Railway Postgres: max_connections=120 (shared)
      // Plan: 60 connections per API instance max
    }
  }
});

// Redis connection pool
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Pool size: auto-managed by ioredis
});
```

**Result**: 100+ concurrent users per instance → 500+ users total with 5 instances

---

## Phase 3: Database Scalability

### 3.1 Read Replicas
```sql
-- PostgreSQL on Railway supports replication
-- Setup: Create read replica for reporting/analytics

-- Primary (write):
-- api.pymeshub.lat → production database

-- Read Replicas (read-only):
-- analytics-db → for heavy queries, reporting
-- backup-db → for backups
```

**Implementation**:
```typescript
// Separate data source for read-heavy queries
const readDB = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL }
  }
});

@Injectable()
export class ContactsService {
  async findAll(workspaceId: string) {
    // Use read replica for listing
    return readDB.contact.findMany({
      where: { workspace_id: workspaceId },
      skip: 0,
      take: 20
    });
  }
  
  async create(workspaceId: string, dto: CreateContactDto) {
    // Use primary for writes
    return this.prisma.contact.create({
      data: { workspace_id: workspaceId, ...dto }
    });
  }
}
```

### 3.2 Caching Strategy (Redis)
```typescript
// Implement caching decorator
import { Cache } from '@nestjs/cache-manager';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  
  async findAll(workspaceId: string, filters: FilterContactsDto) {
    const cacheKey = `contacts:${workspaceId}:${JSON.stringify(filters)}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    
    // Fetch from DB
    const data = await this.prisma.contact.findMany({
      where: { workspace_id: workspaceId, ...filters }
    });
    
    // Cache for 5 minutes
    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }
  
  async create(workspaceId: string, dto: CreateContactDto) {
    const result = await this.prisma.contact.create({ data });
    
    // Invalidate related caches
    await this.cache.del(`contacts:${workspaceId}:*`);
    return result;
  }
}
```

### 3.3 Database Query Optimization
```typescript
// Use select() to fetch only needed columns
async getWorkspaceSummary(workspaceId: string) {
  return this.prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      plan: true,
      // NOT: settings_json, created_at, etc.
      _count: {
        select: {
          contacts: true,
          invoices: true,
          users: { where: { workspace_id: workspaceId } }
        }
      }
    }
  });
}

// Index frequently queried columns
// In schema.prisma:
model Contact {
  id String @id @default(cuid())
  workspace_id String @index
  email String @index
  created_at DateTime @default(now()) @index
  // Compound index for common queries
  @@index([workspace_id, created_at])
}
```

### 3.4 Pagination Best Practices
```typescript
// Use cursor-based pagination for large datasets
async findAll(workspaceId: string, cursor?: string, take: number = 20) {
  return this.prisma.contact.findMany({
    where: { workspace_id: workspaceId },
    take: take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { created_at: 'desc' }
  });
}

// Response includes cursor for next page
return {
  data: items,
  nextCursor: items.length === take ? items[items.length - 1].id : null
};
```

**Result**: 
- Cache hit rate: 70-80% → 10x faster response times
- DB load reduced by 60%
- Support 2000+ concurrent users with 5 API instances

---

## Phase 4: Real-time Scalability (WebSockets)

### 4.1 Socket.io Horizontal Scaling
**Current**: Single Socket.io instance  
**Scalable**: Redis adapter for multi-instance support

```typescript
// src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';

const app = await NestFactory.create(AppModule);
const io = new SocketIOAdapter(app);

// Enable Redis adapter for horizontal scaling
const pubClient = createRedisClient();
const subClient = pubClient.duplicate();

io.adapter(
  createAdapter(pubClient, subClient, {
    key: 'socket.io'
  })
);

await app.listen(3000);
```

This allows Socket.io messages to flow between API instances:
- Instance 1: User A connects
- Instance 2: User B connects
- User A sends message → Instance 1 → Redis → Instance 2 → User B

### 4.2 Connection Limits & Backpressure
```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  maxHttpBufferSize: 1e5, // 100KB max message
  transports: ['websocket', 'polling'],
})
export class EventsGateway {
  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // Rate limit per client
    const limiter = new RateLimiter({
      points: 10, // 10 messages
      duration: 1 // per second
    });
    
    limiter.consume(client.id)
      .then(() => {
        // Process message
        client.emit('message-ack', { id: data.id });
      })
      .catch(() => {
        client.emit('error', { message: 'Rate limit exceeded' });
      });
  }
  
  afterInit(server: Server) {
    // Max 1000 clients per instance
    server.setMaxListeners(1000);
  }
}
```

**Result**: Support 5000+ WebSocket connections (1000 per instance × 5 instances)

---

## Phase 5: Background Jobs Scaling

### 5.1 BullMQ Job Queue
```typescript
// Job distribution across workers
const invoiceQueue = new Queue('invoices', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
  }
});

// Multiple workers processing jobs
const emailWorker = new Worker('emails', async (job) => {
  await sendEmail(job.data);
}, { connection: redis, concurrency: 50 });

const invoiceWorker = new Worker('invoices', async (job) => {
  await generateInvoice(job.data);
}, { connection: redis, concurrency: 10 });

// Scale workers based on load
// Dev: 1 worker per queue
// Prod: 5 workers per queue (separate container)
```

### 5.2 Job Lifecycle
```typescript
// Emit events for monitoring
invoiceQueue.on('completed', (job) => {
  console.log(`Invoice ${job.data.id} generated`);
  // Emit to WebSocket if user watching
  this.events.server.to(`user:${job.data.userId}`).emit('invoice-ready', {
    invoiceId: job.data.id
  });
});

invoiceQueue.on('failed', (job, err) => {
  console.error(`Invoice ${job.data.id} failed:`, err.message);
  // Alert user after max retries
  if (job.attemptsMade >= 3) {
    this.events.server.to(`user:${job.data.userId}`).emit('invoice-failed', {
      error: 'Invoice generation failed. Please try again.'
    });
  }
});
```

**Result**: 1000s of background jobs/day without blocking API

---

## Phase 6: Monitoring & Auto-Scaling

### 6.1 Metrics Collection
```typescript
// Use Prometheus metrics
import { register, Counter, Histogram, Gauge } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table']
});

const activeConnections = new Gauge({
  name: 'active_connections_total',
  help: 'Number of active database connections'
});

// Middleware to collect metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.url, res.statusCode)
      .observe(duration);
  });
  next();
});

// Export metrics
@Controller('metrics')
export class MetricsController {
  @Get()
  metrics() {
    return register.metrics();
  }
}
```

### 6.2 Alerting Rules
```yaml
# prometheus-rules.yml
groups:
  - name: pymeshub_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_connections / pg_settings_max_connections > 0.9
        for: 2m
        annotations:
          summary: "Database connection pool running low"
          
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "API latency exceeds 1 second"
```

### 6.3 Auto-Scaling Configuration
**Railway/Kubernetes auto-scaling**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-scaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100  # Double the replicas
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50   # Reduce by 50%
          periodSeconds: 60
```

---

## Phase 7: Cost Optimization

### 7.1 Reserved Capacity vs Auto-Scaling
| Users | Approach | Cost |
|-------|----------|------|
| 10-100 | Single instance | $50/mo |
| 100-500 | 2-3 instances | $150/mo |
| 500-2000 | 3-5 instances auto-scale | $300/mo |
| 2000+ | 5-10 instances + read replicas | $600+/mo |

### 7.2 Database Right-Sizing
```
Development: db.t3.micro ($15/mo) - 20 connections
Staging: db.t3.small ($30/mo) - 50 connections
Production: db.t3.medium ($60/mo) - 200 connections → db.t3.large ($120/mo) - 500 connections (at scale)
```

### 7.3 Caching ROI
- **5-minute cache on /api/workspace/summary** → 60% fewer DB queries → $20/mo saved
- **Redis layer** → $30/mo → Saves $100/mo in database load
- **CDN edge caching** → Already included in Cloudflare → $0 incremental cost

---

## Implementation Timeline

### Month 1: Foundation
- [ ] Cloudflare Workers caching strategy
- [ ] Basic monitoring (Prometheus)
- [ ] Database indexing optimization
- [ ] Redis caching layer

### Month 2: Backend Scaling
- [ ] Containerize API (Docker)
- [ ] Setup load balancer
- [ ] Horizontal scaling to 3 instances
- [ ] Connection pooling setup

### Month 3: Advanced Features
- [ ] Socket.io Redis adapter
- [ ] Read replicas for analytics
- [ ] Auto-scaling rules
- [ ] Advanced monitoring/alerting

### Month 4+: Optimization
- [ ] GraphQL with DataLoader (N+1 prevention)
- [ ] Event sourcing for audit logs
- [ ] Sharding strategy (if >10k users)
- [ ] Multi-region deployment

---

## Testing Under Load

### Load Testing Script
```bash
# Using Artillery
npm install -g artillery

# Load test config
cat > load-test.yml << EOF
config:
  target: 'https://api.pymeshub.lat'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users per second
    - duration: 300
      arrivalRate: 50  # Ramp to 50 users/sec
    - duration: 60
      arrivalRate: 10  # Cool down
scenarios:
  - name: "Main Flow"
    flow:
      - get:
          url: "/api/workspaces/current"
      - post:
          url: "/api/contacts"
          json:
            full_name: "Test User"
            email: "test@example.com"
      - get:
          url: "/api/contacts"
EOF

# Run test
artillery run load-test.yml --output results.json
artillery report results.json
```

---

## Success Metrics

| Metric | Current | Target (1000 users) |
|--------|---------|-------------------|
| API Response Time (p95) | 200ms | <500ms |
| Database Query Time | 50ms | <100ms |
| Cache Hit Rate | 40% | >70% |
| API Uptime | 99.5% | 99.9% |
| Max Concurrent Users | 100 | 1000+ |
| Cost per User/Month | $10 | <$1 |

---

## Disaster Recovery

### RTO & RPO
- **RTO** (Recovery Time Objective): <5 minutes
- **RPO** (Recovery Point Objective): <15 minutes

### Backup Strategy
```sql
-- Automated backups
- Daily snapshots (kept 7 days)
- Weekly snapshots (kept 30 days)
- Monthly snapshots (kept 1 year)
- WAL archiving for point-in-time recovery

-- Test restores monthly
```

### Failover Plan
1. **Database**: Automatic failover to read replica (1-2 min)
2. **API**: Load balancer removes unhealthy instances (30 sec)
3. **WebSocket**: Clients auto-reconnect via Socket.io (5 sec)
4. **Frontend**: Served from multiple edge locations (no downtime)

---

## Questions to Discuss
1. **Preferred hosting**: Continue with Railway + upgrades, or move to Kubernetes (DigitalOcean, AWS)?
2. **Multi-region**: Serve users from their geographic region?
3. **Budget**: What's the maximum infrastructure budget?
4. **Scale target**: When do you anticipate needing 1000+ concurrent users?
