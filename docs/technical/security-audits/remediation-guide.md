# SECURITY VULNERABILITY REMEDIATION GUIDE
## main-api Branch - Step-by-Step Fixes

---

## 🔴 CRITICAL #1: RBAC PRIVILEGE ESCALATION - Fix Role-Based Access Control

### THE PROBLEM
String literals bypass TypeScript's type system:
```typescript
// WRONG - Current code
@Roles('ADMIN' as any)              // String with type casting
@Roles('ADMIN', 'OWNER')            // Multiple strings
@Roles('AGENT' as any)              // Bypasses type checking
```

### THE SOLUTION
Replace ALL `@Roles()` usage with enum values:

**Step 1**: Find all affected files
```bash
grep -r "@Roles" apps/api/src --include="*.ts" | grep -v "decorators.ts\|guard.ts"
```

**Step 2**: Update decorator import
```typescript
// At top of each controller file
import { WorkspaceUserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
```

**Step 3**: Replace all @Roles decorators

**BEFORE**:
```typescript
// audit.controller.ts
@Roles('ADMIN' as any)
findAll(@CurrentUser('workspace_id') workspaceId: string) {
  return this.auditService.findAll(workspaceId);
}

// channels.controller.ts
@Roles('ADMIN' as any)
create(@CurrentUser() user: AuthUser, @Body() body: any) {
  return this.channelsService.create(user.workspace_id, body);
}

// automations.controller.ts
@Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
getAutomations(...) { }

@Roles('ADMIN', 'OWNER')
create(...) { }
```

**AFTER**:
```typescript
// audit.controller.ts
@Roles(WorkspaceUserRole.ADMIN)
findAll(@CurrentUser('workspace_id') workspaceId: string) {
  return this.auditService.findAll(workspaceId);
}

// channels.controller.ts
@Roles(WorkspaceUserRole.ADMIN)
create(@CurrentUser() user: AuthUser, @Body() body: any) {
  return this.channelsService.create(user.workspace_id, body);
}

// automations.controller.ts
@Roles(
  WorkspaceUserRole.VIEWER, 
  WorkspaceUserRole.AGENT, 
  WorkspaceUserRole.ADMIN, 
  WorkspaceUserRole.OWNER
)
getAutomations(...) { }

@Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
create(...) { }
```

**Step 4**: Search and replace command
```bash
# Find all files with @Roles string literals
find apps/api/src -name "*.controller.ts" -exec grep -l "@Roles.*'[A-Z]" {} \;

# Then manually update each one
```

**Files to update** (30+ locations):
- audit.controller.ts (1)
- automations.controller.ts (6)
- channels.controller.ts (7)
- contacts.controller.ts (3)
- conversations.controller.ts (7)
- departments.controller.ts (3)
- documents.controller.ts (2+)
- invoices.controller.ts (5+)
- tasks.controller.ts (3+)
- workspaces.controller.ts (5+)
- And others...

---

## 🔴 CRITICAL #2: ADD HELMET SECURITY HEADERS

### THE PROBLEM
Missing HTTP security headers enable:
- Clickjacking attacks (no X-Frame-Options)
- MIME sniffing attacks (no X-Content-Type-Options)
- Unencrypted transit (no HSTS)

### THE SOLUTION

**Step 1**: Install Helmet
```bash
cd apps/api
npm install @nestjs/helmet helmet
```

**Step 2**: Update apps/api/src/main.ts

**BEFORE**:
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  const corsOrigins = /* ... */;
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorReportsService)));
  const port = process.env.PORT ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 API corriendo en http://127.0.0.1:${port}/api`);
}
```

**AFTER**:
```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ✅ ADD HELMET - must come before other middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  
  const corsOrigins = /* ... */;
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-slug'],
    maxAge: 3600,
  });
  
  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorReportsService)));
  const port = process.env.PORT ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 API corriendo en http://127.0.0.1:${port}/api`);
}
bootstrap();
```

---

## 🟠 HIGH #1: FIX CORS CREDENTIAL RISK

### THE PROBLEM
`credentials: true` + CORS can leak auth tokens cross-origin

### THE SOLUTION

**Option A**: Strict origin validation (RECOMMENDED for production)
```typescript
// main.ts
const TRUSTED_ORIGINS = [
  'https://PymesHub.lat',
  'https://www.PymesHub.lat',
  'https://app.PymesHub.lat',
  // dev only:
  process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : null,
  process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5000' : null,
].filter(Boolean);

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || TRUSTED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-slug'],
  maxAge: 3600,
});
```

**Option B**: Environment-based (for Tauri/enterprise)
```typescript
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? 
  (process.env.NODE_ENV === 'production' 
    ? ['https://PymesHub.lat', 'https://www.PymesHub.lat']
    : ['http://localhost:5000', 'http://127.0.0.1:5000', 'tauri://localhost']
  );
```

---

## 🟠 HIGH #2: VALIDATE JWT SECRET

### THE PROBLEM
```typescript
secretOrKey: process.env.JWT_SECRET!  // ❌ No validation, crashes if missing
```

### THE SOLUTION

**Step 1**: Create src/common/validation/env.validation.ts
```typescript
export function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  if (!/[A-Z]/.test(secret) || !/[0-9]/.test(secret) || !/[!@#$%^&*]/.test(secret)) {
    console.warn('⚠️  JWT_SECRET should contain uppercase, numbers, and special characters for better security');
  }
  
  return secret;
}
```

**Step 2**: Update jwt.strategy.ts
```typescript
import { validateJwtSecret } from '../../common/validation/env.validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: validateJwtSecret(),  // ✅ Validates on startup
    });
  }
  // ... rest of code
}
```

**Step 3**: Update .env.example
```
# .env.example
JWT_SECRET=your-super-secret-key-minimum-32-characters-with-uppercase-and-numbers-ABC123!@#
JWT_EXPIRES_IN=7d
```

---

## 🟠 HIGH #3: IMPLEMENT INPUT VALIDATION DTOs

### THE PROBLEM
Weak typing on request bodies:
```typescript
@Body() body: { type: string; name: string; provider?: string }  // ❌ Too loose
```

### THE SOLUTION

**Step 1**: Create DTOs for channels (example)

**src/channels/dto/create-channel.dto.ts**:
```typescript
import { IsString, IsEnum, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['email', 'whatsapp', 'form', 'api', 'manual'])
  provider?: string;
}
```

**Step 2**: Update controller to use DTO
```typescript
import { CreateChannelDto } from './dto/create-channel.dto';

@Post()
@Roles(WorkspaceUserRole.ADMIN)
create(
  @CurrentUser() user: AuthUser,
  @Body() body: CreateChannelDto,  // ✅ Use DTO instead of inline typing
) {
  return this.channelsService.create(user.workspace_id, body);
}
```

**Step 3**: Repeat for all controllers:
- automations/dto
- contacts/dto
- conversations/dto
- departments/dto
- documents/dto
- invoices/dto
- tasks/dto
- workspaces/dto

---

## 🟡 MEDIUM #1: REMOVE TYPE CASTING (as any)

### LOCATIONS TO FIX:

**1. jwt.strategy.ts line 59**:
```typescript
// BEFORE
is_platform_admin: (workspaceUser.user as any).is_platform_admin ?? false

// AFTER
is_platform_admin: workspaceUser.user.is_platform_admin ?? false
```

**2. channels.controller.ts & similar**:
```typescript
// BEFORE
@Roles('ADMIN' as any)

// AFTER
@Roles(WorkspaceUserRole.ADMIN)
```

**3. Find all remaining `as any` casts**:
```bash
grep -r " as any" apps/api/src --include="*.ts"
```

---

## 🟡 MEDIUM #2: SANITIZE ERROR MESSAGES

### THE PROBLEM
```typescript
throw new Error(`${config.provider} API error ${res.status}: ${await res.text()}`);
```

### THE SOLUTION

**Create src/common/filters/exception.filter.ts**:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    // Log full error internally for debugging
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[ERROR]', exception);
      message = 'Internal server error'; // Generic response to client
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Update api-exception.filter.ts** to not expose sensitive details:
```typescript
// Instead of including full error text
throw new Error(`${config.provider} API error ${res.status}: ${await res.text()}`);

// Use generic message and log details
console.error(`[API Error] ${config.provider} returned ${res.status}`);
throw new Error(`External service error. Please try again later.`);
```

---

## 🟡 LOW: SERVER BINDING CONFIG

### THE PROBLEM
```typescript
await app.listen(port, "0.0.0.0");  // ❌ Exposes on all network interfaces
```

### THE SOLUTION
```typescript
// Use environment variable for flexibility
const HOST = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
const port = process.env.PORT ?? 4000;
await app.listen(port, HOST);
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Fix RBAC: Replace 30+ @Roles string literals with enum values
- [ ] Add Helmet.js security headers
- [ ] Fix CORS: Validate origins strictly + update main.ts
- [ ] Validate JWT secret on startup
- [ ] Create DTOs for all controllers (10+ files)
- [ ] Remove all `as any` type casts (5+)
- [ ] Sanitize error messages in exception filters
- [ ] Update server binding to use HOST variable
- [ ] Run: `npm run build` to verify types
- [ ] Run: `npm run lint` to check for issues
- [ ] Test: Manual auth flow + role-based access
- [ ] Test: CORS from different origins
- [ ] Commit changes with proper messages

---

## TESTING AFTER FIXES

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Run tests if available
npm run test

# Manual testing
curl -H "Authorization: Bearer INVALID_TOKEN" http://localhost:4000/api/auth/me
# Should return 401, not 500 with error details

curl -H "Origin: https://evil.com" http://localhost:4000/api/health
# Should be rejected (CORS)
```

---

## DEPLOYMENT NOTES

Update .env for production:
```bash
JWT_SECRET=<generate-32+-char-random-string>
CORS_ORIGIN=https://PymesHub.lat,https://www.PymesHub.lat,tauri://localhost
NODE_ENV=production
```

Verify Helmet headers:
```bash
curl -i https://api.PymesHub.lat/api/health
# Should see:
# x-content-type-options: nosniff
# x-frame-options: DENY
# strict-transport-security: max-age=31536000...
```
