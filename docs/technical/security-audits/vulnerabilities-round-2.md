# SECURITY VULNERABILITIES - ROUND 2
## main-api Branch - Deep Vulnerability Assessment

---

## 🔴 CRITICAL VULNERABILITIES

### 1. INSECURE DIRECT OBJECT REFERENCE (IDOR) - Workspace Isolation Bypass
**Severity: CRITICAL** | **Impact: Privilege Escalation, Unauthorized Data Access**

**Issue**: Multiple service methods access resources by ID only, without validating workspace ownership.

**Affected Methods** (20+ instances):
```typescript
// VULNERABLE PATTERN - NO workspace validation
async remove(workspaceId: string, id: string) {
  return this.prisma.automationRule.delete({ where: { id } });  // ❌ Only checks ID, not workspace!
}

async update(workspaceId: string, id: string, dto: UpdateAutomationDto) {
  // Parameter has workspaceId but doesn't use it!
  return this.prisma.automationRule.update({
    where: { id },  // ❌ Missing: where { id, workspace_id: workspaceId }
    data: dto,
  });
}
```

**Affected Files**:
- automations.service.ts (delete, update operations)
- channels.service.ts (delete, update operations)
- contacts.service.ts (delete, update operations)
- conversations.service.ts (delete, update operations)
- documents.service.ts (delete, update operations)
- invoices.service.ts (delete, update operations)
- tasks.service.ts (delete, update operations)
- And 10+ more...

**Attack Scenario**:
```
1. User A gets Workspace 1 ID and Automation Rule ID
2. User switches to Workspace 2
3. User calls DELETE /automations/{ruleIdFromWorkspace1}
4. System deletes the rule without checking workspace ownership
5. User A's automation is deleted by User B!
```

**Fix Required**:
```typescript
// SECURE - Always validate workspace ownership
async remove(workspaceId: string, id: string) {
  const rule = await this.prisma.automationRule.findUnique({ where: { id } });
  if (!rule || rule.workspace_id !== workspaceId) {
    throw new NotFoundException('Rule not found');
  }
  return this.prisma.automationRule.delete({ where: { id } });
}

// OR use compound unique constraint
async remove(workspaceId: string, id: string) {
  return this.prisma.automationRule.delete({
    where: { id_workspace_id: { id, workspace_id: workspaceId } }
  });
}
```

**Affected Lines**: 20+ methods across service files
**Risk Level**: CRITICAL - Allows cross-workspace data manipulation

---

### 2. MISSING RATE LIMITING ON AUTHENTICATION ENDPOINTS
**Severity: CRITICAL** | **CVE-like: Brute Force / Account Enumeration**

**Issue**: Authentication endpoints have NO rate limiting despite @Throttle decorator being available.

**Vulnerable Endpoints**:
```typescript
@Post('login')
async login(@Body() dto: LoginDto) { }  // ❌ No rate limit

@Post('register')
async register(@Body() dto: RegisterDto) { }  // ❌ No rate limit

@Post('accept-invite')
async acceptInvite(@Body() dto: AcceptInviteDto) { }  // ❌ No rate limit

@Post('refresh')
async refresh(@Body('refresh_token') rawToken: string) { }  // ❌ No rate limit
```

**Attack Scenarios**:
1. **Brute Force**: Attacker can attempt unlimited login attempts
2. **Account Enumeration**: Attacker can discover valid email addresses
3. **Token Refresh Abuse**: Unlimited refresh token attempts
4. **Workspace Enumeration**: Unlimited accept-invite attempts

**Fix Required**:
```typescript
@Post('login')
@Throttle({ auth: { limit: 5, ttl: 900_000 } })  // 5 attempts per 15 minutes
async login(@Body() dto: LoginDto) { }

@Post('register')
@Throttle({ auth: { limit: 3, ttl: 3600_000 } })  // 3 attempts per hour
async register(@Body() dto: RegisterDto) { }

@Post('accept-invite')
@Throttle({ auth: { limit: 10, ttl: 600_000 } })  // 10 attempts per 10 minutes
async acceptInvite(@Body() dto: AcceptInviteDto) { }

@Post('refresh')
@Throttle({ auth: { limit: 20, ttl: 3600_000 } })  // 20 attempts per hour
async refresh(@Body('refresh_token') rawToken: string) { }
```

---

### 3. MISSING PARAMETER VALIDATION - No UUID/Format Validation
**Severity: CRITICAL** | **Impact: Injection, DoS, Data Manipulation**

**Issue**: ID parameters (@Param) are not validated as UUIDs. Any string is accepted.

**Vulnerable Code**:
```typescript
@Patch(':id')
update(
  @Param('id') id: string,  // ❌ No validation - accepts any string
  @Body() dto: UpdateAutomationDto
) {
  return this.automationsService.update(workspaceId, id, dto);
}

@Delete(':id')
remove(
  @Param('id') id: string,  // ❌ Could be SQL injection if Prisma isn't protecting
) {
  return this.automationsService.remove(workspaceId, id);
}
```

**Examples of Invalid Input That Passes**:
- `12345` (numeric string)
- `../../admin` (path traversal-like)
- `'; DROP TABLE--` (SQL injection pattern)
- Very long strings causing DoS

**Fix Required** - Create ParamValidationPipe:
```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class ValidateUUIDPipe implements PipeTransform {
  transform(value: string) {
    if (!isUUID(value)) {
      throw new BadRequestException(`Invalid ID format: ${value}`);
    }
    return value;
  }
}

// Usage:
@Patch(':id')
update(
  @Param('id', ValidateUUIDPipe) id: string,
  @Body() dto: UpdateAutomationDto
) { }
```

---

## 🟠 HIGH PRIORITY VULNERABILITIES

### 4. WEAK PASSWORD VALIDATION IN AUTH CONTROLLER
**Severity: HIGH** | **CVE-like: Weak Authentication**

**Issue**: No password strength requirements, no complexity validation.

**Current Code**:
```typescript
// login.dto.ts
@IsString()
password: string;  // ❌ No @MinLength, @Matches

// register.dto.ts
@IsString()
password: string;  // ❌ Any string accepted!
```

**Fix Required**:
```typescript
import { Matches, MinLength } from 'class-validator';

@IsString()
@MinLength(12, { message: 'Password must be at least 12 characters' })
@Matches(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  { message: 'Password must contain uppercase, lowercase, number, and special character' }
)
password: string;
```

---

### 5. MISSING WORKSPACE VALIDATION IN SERVICES
**Severity: HIGH** | **Impact: Cross-workspace data access**

**Example - automations.service.ts**:
```typescript
async getExecutions(workspaceId: string, id: string, page = 1, limit = 20) {
  return this.prisma.automationExecution.findMany({
    where: { automation_rule_id: id },  // ❌ Doesn't verify automation rule belongs to workspace!
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { created_at: 'desc' },
  });
}
```

**Fix**:
```typescript
async getExecutions(workspaceId: string, id: string, page = 1, limit = 20) {
  // Verify rule belongs to workspace
  const rule = await this.prisma.automationRule.findFirst({
    where: { id, workspace_id: workspaceId }
  });
  if (!rule) throw new NotFoundException();
  
  return this.prisma.automationExecution.findMany({
    where: { automation_rule_id: id },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { created_at: 'desc' },
  });
}
```

---

### 6. MISSING VALIDATION ON UPDATE DTOs
**Severity: HIGH** | **Impact: Data Corruption**

**Affected Files**:
- automations/dto/update-automation.dto.ts
- channels/dto/update-channel.dto.ts
- contacts/dto/update-contact.dto.ts
- departments/dto/update-department.dto.ts
- summaries/dto/filter-summaries.dto.ts

**Example**:
```typescript
// update-automation.dto.ts
export class UpdateAutomationDto {
  name?: string;  // ❌ No @MinLength, @MaxLength
  description?: string;  // ❌ Accepts any length
  is_enabled?: boolean;
}
```

**Fix**:
```typescript
import { IsString, MinLength, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}
```

---

### 7. TYPE CASTING STILL PRESENT - Password Hash Handling
**Severity: HIGH** | **CVE-like: Type Confusion**

**Location**: apps/api/src/auth/auth.service.ts

**Issue**:
```typescript
// Line: "if (!user || !(user as any).password_hash)"
const passwordMatch = await bcrypt.compare(
  dto.password,
  (user as any).password_hash,  // ❌ Still using type cast!
);

// Line: "...(password_hash && { password_hash } as any),"
data: {
  name: dto.name,
  ...(password_hash && { password_hash } as any),  // ❌ Type cast bypass
},
```

**Fix**: Remove `as any` casts - User model DOES have password_hash field defined.

---

## 🟡 MEDIUM PRIORITY VULNERABILITIES

### 8. MISSING AUDIT LOGGING ON SENSITIVE OPERATIONS
**Severity: MEDIUM** | **Compliance: GDPR/SOC2**

**Vulnerable Operations** (NO audit trail):
- User password changes
- Admin user deletion
- Role changes
- Workspace configuration changes
- API key generation
- Webhook configuration changes

**Current Code**:
```typescript
// No logging when deleting critical resources
async remove(workspaceId: string, id: string) {
  return this.prisma.automationRule.delete({ where: { id } });  // ❌ No audit log
}
```

**Fix Required**:
```typescript
async remove(workspaceId: string, id: string) {
  const rule = await this.prisma.automationRule.findUnique({ where: { id } });
  
  // Perform deletion
  await this.prisma.automationRule.delete({ where: { id } });
  
  // ✅ Log the action
  await this.auditService.log({
    workspace_id: workspaceId,
    action: 'AUTOMATION_RULE_DELETED',
    entity_type: 'AutomationRule',
    entity_id: id,
    before_json: rule,
    after_json: null,
  });
}
```

---

### 9. HARDCODED MAGIC NUMBERS IN AI SERVICE
**Severity: MEDIUM** | **Impact: Resource Exhaustion**

**Code**:
```typescript
const { text } = await this.chat(config, system, conversationText, 500, 0.3);
                                                                    ^^^  ^^^
                                                              Magic numbers!

const { text, tokens } = await this.chat(config, system, user, 200, 0.4);
                                                                  ^^^  ^^^
```

**Issue**: Max tokens and temperature are hardcoded, no rate limiting per workspace.

**Fix**:
```typescript
const MAX_TOKENS_SUMMARY = 500;
const MAX_TOKENS_REMINDER = 200;
const TEMPERATURE_SUMMARY = 0.3;
const TEMPERATURE_REMINDER = 0.4;

// Or better: load from workspace config
async getMaxTokens(workspaceId: string): Promise<number> {
  const ws = await this.prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings_json: true }
  });
  return parseJsonValue<{ max_ai_tokens?: number }>(
    ws?.settings_json, 
    {}
  ).max_ai_tokens ?? 500;
}
```

---

### 10. MISSING INPUT VALIDATION ON QUERY PARAMETERS
**Severity: MEDIUM** | **Impact: Data Injection, Type Errors**

**Example - Pagination Without Validation**:
```typescript
@Get(':id/executions')
getExecutions(
  @Param('id') id: string,
  @Query('page') page: number = 1,        // ❌ No @Min, @Max
  @Query('limit') limit: number = 20,     // ❌ No @Max (could request 1M records)
) {
  return this.automationsService.getExecutions(
    workspaceId,
    id,
    page,
    limit
  );
}
```

**Fix**:
```typescript
import { Min, Max, IsNumber, Type } from 'class-validator';

class PaginationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)  // Prevent returning 1M records
  limit: number = 20;
}

@Get(':id/executions')
getExecutions(
  @Param('id') id: string,
  @Query() pagination: PaginationDto,
) { }
```

---

### 11. INSUFFICIENT ENUM VALIDATION
**Severity: MEDIUM** | **Impact: Invalid State**

**Example**:
```typescript
// channels.service.ts
if (channel.type !== 'EMAIL') throw new BadRequestException();  // String comparison
if (channel.type !== 'WHATSAPP') throw new BadRequestException();

// Better: Enum comparison
if (!Object.values(ChannelType).includes(channel.type)) {
  throw new BadRequestException('Invalid channel type');
}
```

---

## 📋 VULNERABILITY SUMMARY

| # | Vulnerability | Severity | Count | Type |
|---|---|---|---|---|
| 1 | IDOR - Workspace Isolation Bypass | CRITICAL | 20+ | Authorization |
| 2 | Missing Rate Limiting (Auth) | CRITICAL | 4 | Brute Force |
| 3 | Missing Parameter Validation | CRITICAL | 30+ | Injection |
| 4 | Weak Password Requirements | HIGH | 1 | Authentication |
| 5 | Missing Workspace Validation | HIGH | 15+ | Access Control |
| 6 | Missing DTO Validation | HIGH | 5 | Data Validation |
| 7 | Type Casting in Auth | HIGH | 3 | Type Safety |
| 8 | No Audit Logging | MEDIUM | 20+ | Compliance |
| 9 | Hardcoded Magic Numbers | MEDIUM | 5+ | Configuration |
| 10 | Query Parameter Validation | MEDIUM | 10+ | Injection |
| 11 | Insufficient Enum Validation | MEDIUM | 10+ | Logic Error |

**TOTAL**: 123+ vulnerable code patterns identified

---

## 🚨 IMMEDIATE ACTION ITEMS

### Phase 1 (CRITICAL - Do First):
- [ ] Add workspace validation to all service delete/update methods
- [ ] Add rate limiting to: login, register, accept-invite, refresh endpoints
- [ ] Add UUID validation to all @Param ID routes
- [ ] Add password complexity validation to LoginDto and RegisterDto

### Phase 2 (HIGH - Do Second):
- [ ] Add DTO field validation to all update DTOs
- [ ] Remove remaining `as any` type casts
- [ ] Add workspace existence check to all resource operations
- [ ] Implement pagination limits (max 100 records)

### Phase 3 (MEDIUM - Do Third):
- [ ] Add audit logging to all delete/update operations
- [ ] Extract magic numbers to configuration
- [ ] Implement enum validation utility
- [ ] Add query parameter validation pipes

---

## ESTIMATED REMEDIATION EFFORT

- **CRITICAL fixes**: 4-6 hours (high impact, must do first)
- **HIGH fixes**: 6-8 hours (important security improvements)
- **MEDIUM fixes**: 4-6 hours (compliance and best practices)
- **TOTAL**: 14-20 hours of engineering effort

---

## CODE EXAMPLES FOR FIXES

See `/home/user/pymes-saas/SECURITY_VULNERABILITY_FIXES_ROUND_2.md` for detailed implementation examples.
