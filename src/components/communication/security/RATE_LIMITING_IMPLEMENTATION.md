# Rate Limiting Implementation

## Overview

This document describes the rate limiting implementation for the Communication Module, which prevents abuse and ensures fair resource usage across all users.

## Requirements

- **20.3**: Implement rate limiting of 60 messages per minute per user
- **20.4**: Display error message when rate limit exceeded
- **20.5**: Implement rate limiting of 10 file uploads per minute per user

## Architecture

### Components

1. **RateLimiterService** (`src/services/RateLimiterService.ts`)
   - Core rate limiting logic
   - Database-based tracking (upgradeable to Redis)
   - Violation logging
   - Status monitoring

2. **MessageComposer Integration** (`src/components/communication/MessageComposer.tsx`)
   - Pre-send rate limit checks
   - User-friendly error messages
   - Retry countdown display

3. **FileUpload Integration** (`src/components/communication/FileUpload.tsx`)
   - Pre-upload rate limit checks
   - File-specific error handling
   - Upload blocking when limited

4. **RateLimitIndicator** (`src/components/communication/security/RateLimitIndicator.tsx`)
   - Visual rate limit status display
   - Warning when approaching limit
   - Countdown timer when limited

## Rate Limits

### Message Rate Limit
- **Limit**: 60 messages per minute per user
- **Window**: 60 seconds (rolling)
- **Error Message**: "You are sending messages too quickly. Please wait a moment before trying again."

### File Upload Rate Limit
- **Limit**: 10 file uploads per minute per user
- **Window**: 60 seconds (rolling)
- **Error Message**: "You are uploading files too quickly. Please wait a moment before trying again."

### API Request Rate Limit
- **Limit**: 100 requests per minute per user
- **Window**: 60 seconds (rolling)
- **Error Message**: "Too many requests. Please slow down."

## Implementation Details

### Storage Mechanism

Currently uses **localStorage** for client-side rate limiting:
- Key format: `rate_limit_{action}:{userId}`
- Stores: `{ count: number, resetAt: ISO timestamp }`
- Automatic cleanup of expired entries every 5 minutes

**Production Upgrade Path**: Replace localStorage with Redis for:
- Distributed rate limiting across server instances
- Better performance and scalability
- Atomic operations (INCR, EXPIRE)

### Rate Limit Check Flow

```typescript
1. User attempts action (send message, upload file)
2. RateLimiterService.check{Action}RateLimit(userId)
3. Retrieve current count from storage
4. Check if window has expired
   - If expired: Reset count to 1, set new window
   - If not expired: Increment count
5. Compare count against limit
   - If under limit: Allow action, return remaining count
   - If at/over limit: Block action, log violation, return error
6. Display result to user
```

### Error Handling

When rate limit is exceeded:
1. Action is blocked before execution
2. User sees toast notification with:
   - Clear error message
   - Countdown to retry (seconds remaining)
   - Duration: 5 seconds
3. Violation is logged to audit logs
4. Console warning is emitted

### Logging

All rate limit violations are logged to:
- **Audit Logs Table**: Permanent record for compliance
- **Console**: Development debugging
- **Monitoring** (future): Real-time alerts

Log entry format:
```json
{
  "user_id": "uuid",
  "action": "rate_limit_violation",
  "entity_type": "communication",
  "details": {
    "violation_type": "messages" | "file_uploads" | "api_requests",
    "timestamp": "ISO timestamp",
    "count": number,
    "limit": number,
    "windowMs": number
  }
}
```

## User Experience

### Normal Operation
- Users can send messages/upload files freely within limits
- No visible rate limit indicators until approaching limit

### Approaching Limit (80%+)
- RateLimitIndicator appears showing:
  - Remaining actions (e.g., "5 messages remaining")
  - Time until reset (e.g., "Resets in 45s")
  - Warning color (yellow)

### Rate Limited
- Action is blocked immediately
- Toast notification appears with:
  - Error message
  - Retry countdown
- RateLimitIndicator shows:
  - "Rate limit reached" message
  - Time until reset
  - Error color (red)

## Testing

Comprehensive test suite in `__tests__/rateLimiting.test.ts`:

- ✅ Message rate limiting (60/min)
- ✅ File upload rate limiting (10/min)
- ✅ Separate limits for different actions
- ✅ Window expiration and reset
- ✅ Violation logging
- ✅ Status monitoring
- ✅ Cleanup of expired entries
- ✅ Error handling (fail open)

Run tests:
```bash
npm run test -- rateLimiting.test.ts
```

## API Reference

### RateLimiterService

#### `checkMessageRateLimit(userId: string): Promise<RateLimitResult>`
Check if user can send a message.

**Returns:**
```typescript
{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: string;
}
```

#### `checkFileUploadRateLimit(userId: string): Promise<RateLimitResult>`
Check if user can upload a file.

#### `getRateLimitStatus(userId: string, action: string): Promise<Status>`
Get current rate limit status for a user.

**Returns:**
```typescript
{
  count: number;
  resetAt: Date;
  limit: number;
}
```

#### `logRateLimitViolation(violation: RateLimitViolation): Promise<void>`
Log a rate limit violation to audit logs.

#### `resetRateLimit(userId: string, action: string): Promise<void>`
Reset rate limit for a user (admin function).

#### `cleanupExpiredEntries(): void`
Remove expired rate limit entries from storage.

## Configuration

Rate limits are configured in `RateLimiterService.ts`:

```typescript
const RATE_LIMITS = {
  messages: {
    maxRequests: 60,
    windowMs: 60000,
    errorMessage: '...',
  },
  fileUploads: {
    maxRequests: 10,
    windowMs: 60000,
    errorMessage: '...',
  },
  // ...
};
```

To adjust limits, modify these values and redeploy.

## Production Considerations

### Redis Migration

For production deployment, migrate to Redis:

```typescript
// Example Redis implementation
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const key = `rate_limit:${action}:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(Date.now() + windowMs),
  };
}
```

### Monitoring

Set up monitoring for:
- Rate limit violation frequency
- Users hitting limits repeatedly
- Potential abuse patterns
- System performance impact

### Scaling

Rate limiting scales horizontally with Redis:
- Multiple server instances share Redis
- Atomic operations ensure accuracy
- No coordination needed between servers

## Security

### Bypass Prevention
- Rate limits enforced server-side (client-side is supplementary)
- User ID from authenticated session (not client-provided)
- Violations logged for audit trail

### DDoS Protection
- Rate limiting provides basic DDoS protection
- Consider additional layers:
  - IP-based rate limiting
  - CAPTCHA for repeated violations
  - Temporary account suspension

## Maintenance

### Monitoring Violations
Query audit logs for violations:
```sql
SELECT 
  user_id,
  details->>'violation_type' as type,
  COUNT(*) as violation_count,
  MAX(created_at) as last_violation
FROM audit_logs
WHERE action = 'rate_limit_violation'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, details->>'violation_type'
ORDER BY violation_count DESC;
```

### Adjusting Limits
If users legitimately hit limits:
1. Analyze usage patterns
2. Consider increasing limits
3. Update configuration
4. Redeploy service
5. Monitor impact

## Future Enhancements

1. **Adaptive Rate Limiting**
   - Adjust limits based on user behavior
   - Higher limits for trusted users
   - Lower limits for suspicious activity

2. **Burst Allowance**
   - Allow short bursts above limit
   - Smooth out legitimate spikes

3. **Per-Channel Limits**
   - Different limits for different channels
   - Higher limits for high-traffic channels

4. **Admin Dashboard**
   - Real-time rate limit monitoring
   - Manual limit adjustments
   - Violation analytics

## Support

For issues or questions:
- Check test suite for examples
- Review audit logs for violations
- Contact development team for limit adjustments
