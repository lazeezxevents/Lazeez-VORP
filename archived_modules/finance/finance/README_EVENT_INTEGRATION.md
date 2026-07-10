# Finance Module - Delivery Module Integration

## Overview

This document describes the integration between the Finance Module and the Delivery Module for automated revenue processing.

**Task**: 10.2 Integrate with Delivery Module  
**Requirements**: 2.1, 2.6

## Architecture

### Event-Based Integration

The integration uses an event-driven architecture with a queue-based processing system:

```
Delivery Module → finance_revenue_events (Queue) → OrderRevenueEventHandler → OrderRevenueProcessor
                                                                                      ↓
                                                                            Revenue Recording
                                                                            Commission Calculation
                                                                            Subscription Billing
```

## Components

### 1. Database Event Queue (`finance_revenue_events`)

**Location**: `supabase/migrations/20260330_order_completion_handler.sql`

The queue table stores revenue events triggered by order completion:

```sql
CREATE TABLE finance_revenue_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50), -- 'order_completed', 'subscription_threshold_reached', 'manual_adjustment'
  order_id UUID,
  vendor_id UUID,
  order_amount DECIMAL(15, 2),
  currency VARCHAR(3),
  event_data JSONB,
  status VARCHAR(20), -- 'pending', 'processing', 'completed', 'failed'
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 2. Database Trigger (`handle_order_completion`)

**Location**: `supabase/migrations/20260330_order_completion_handler.sql`

Automatically creates revenue events when orders are completed:

```sql
CREATE TRIGGER order_completion_trigger
  BEFORE UPDATE ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_completion();
```

**Behavior**:
- Triggers when order status changes to 'completed'
- Creates event in `finance_revenue_events` table
- Increments vendor threshold counter
- Generates subscription billing event if threshold reached
- Logs errors without blocking order completion (Requirement 2.8)

### 3. Event Handler Service (`OrderRevenueEventHandler`)

**Location**: `src/components/finance/OrderRevenueEventHandler.ts`

Processes events from the queue:

```typescript
import { orderRevenueEventHandler } from '@/components/finance/OrderRevenueEventHandler';

// Process a single event
const result = await orderRevenueEventHandler.processEvent(eventId);

// Poll for pending events (every 5 seconds)
orderRevenueEventHandler.startPolling();

// Or use real-time subscription
await orderRevenueEventHandler.subscribeToEvents();

// Get statistics
const stats = await orderRevenueEventHandler.getEventStatistics();
```

**Features**:
- Sequential event processing
- Performance monitoring (100ms target)
- Automatic retry with exponential backoff
- Error logging and recovery
- Real-time subscription support

### 4. Revenue Processor (`OrderRevenueProcessor`)

**Location**: `src/components/finance/OrderRevenueProcessor.ts`

Orchestrates the complete revenue workflow:

```typescript
import { orderRevenueProcessor } from '@/components/finance/OrderRevenueProcessor';

const result = await orderRevenueProcessor.processOrderRevenue({
  orderId: 'order-123',
  orderNumber: 'ORD-001',
  vendorId: 'vendor-456',
  riderId: 'rider-789',
  orderAmount: 1000,
  deliveryCharge: 150,
  category: 'food',
  pickupLocation: { lat: 24.8607, lng: 67.0011 },
  deliveryLocation: { lat: 24.8700, lng: 67.0300 },
  distance: 5.5,
  optimizedRoute: { distance: 5.5, optimized: true },
  completedAt: new Date(),
});
```

**Workflow**:
1. Record revenue in General Ledger
2. Calculate vendor commission
3. Calculate rider commission
4. Update vendor subscription threshold
5. Generate subscription invoice if threshold reached
6. Record order financial data
7. Log audit trail

## Performance Requirements

**Requirement 2.6**: Process revenue transactions within 100ms

### Performance Monitoring

The system tracks execution time at multiple levels:

1. **Event Processing**: Total time from event fetch to status update
2. **Revenue Recording**: Journal entry creation time
3. **Commission Calculation**: Vendor and rider commission time

Performance metrics are logged to `finance_performance_metrics` table:

```sql
SELECT 
  operation_type,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) FILTER (WHERE execution_time_ms > 100) as over_threshold
FROM finance_performance_metrics
WHERE operation_type IN ('revenue_journal_entry', 'commission_calculation', 'order_revenue_processing')
GROUP BY operation_type;
```

### Performance Optimization

- Indexed queries on `finance_accounts`, `finance_vendor_profiles`
- Cached account lookups
- Atomic database transactions
- Minimal network round-trips

## Error Handling

### Retry Strategy

Failed events are automatically retried with exponential backoff:

- **Retry 1**: 1 minute after failure
- **Retry 2**: 2 minutes after failure
- **Retry 3**: 4 minutes after failure
- **Max retries**: 3 attempts

### Error Logging

Errors are logged to `finance_error_log` table:

```sql
SELECT 
  error_type,
  entity_id,
  error_message,
  retry_count,
  next_retry_at
FROM finance_error_log
WHERE resolved_at IS NULL
ORDER BY created_at DESC;
```

### Stuck Event Recovery

Events stuck in 'processing' status for more than 5 minutes are automatically reset:

```sql
SELECT reset_stuck_processing_events();
```

## Usage Examples

### Starting Event Processing

```typescript
// In your application initialization (e.g., App.tsx or main.tsx)
import { orderRevenueEventHandler } from '@/components/finance/OrderRevenueEventHandler';

// Option 1: Polling (recommended for reliability)
orderRevenueEventHandler.startPolling();

// Option 2: Real-time subscription (for immediate processing)
await orderRevenueEventHandler.subscribeToEvents();
```

### Manual Event Processing

```typescript
// Process a specific event
const result = await orderRevenueEventHandler.processEvent('event-id-123');

if (result.success) {
  console.log(`Event processed in ${result.processingTime}ms`);
} else {
  console.error(`Event failed: ${result.error}`);
}
```

### Monitoring Event Queue

```typescript
// Get event statistics
const stats = await orderRevenueEventHandler.getEventStatistics();
console.log(`Pending: ${stats.pending}, Completed: ${stats.completed}, Failed: ${stats.failed}`);

// Retry failed events
await orderRevenueEventHandler.retryFailedEvents();
```

### Database Monitoring

```sql
-- View event processing dashboard
SELECT * FROM finance_event_processing_dashboard
WHERE status IN ('pending', 'processing', 'failed')
ORDER BY created_at DESC;

-- Get processing metrics for last 24 hours
SELECT * FROM get_event_processing_metrics(
  NOW() - INTERVAL '24 hours',
  NOW()
);

-- Get pending events by vendor
SELECT * FROM get_pending_events_by_vendor();

-- Get failed events eligible for retry
SELECT * FROM get_failed_events_for_retry(3);
```

## Testing

### Unit Tests

**Location**: `src/components/finance/__tests__/OrderRevenueEventHandler.test.ts`

Run tests:
```bash
npm run test OrderRevenueEventHandler
```

### Integration Testing

To test the complete integration:

1. **Create a test order**:
```sql
INSERT INTO delivery_orders (
  order_number, vendor_id, order_amount, status, rider_id, 
  delivery_distance, delivery_charge
) VALUES (
  'TEST-001', 'vendor-id', 1000, 'pending', 'rider-id', 
  5.5, 150
);
```

2. **Complete the order** (triggers event):
```sql
UPDATE delivery_orders
SET status = 'completed', completed_at = NOW()
WHERE order_number = 'TEST-001';
```

3. **Verify event created**:
```sql
SELECT * FROM finance_revenue_events
WHERE event_data->>'order_number' = 'TEST-001';
```

4. **Process event** (automatic via polling or manual):
```typescript
const events = await supabase
  .from('finance_revenue_events')
  .select('*')
  .eq('status', 'pending')
  .limit(1);

if (events.data && events.data.length > 0) {
  await orderRevenueEventHandler.processEvent(events.data[0].id);
}
```

5. **Verify processing**:
```sql
-- Check event status
SELECT status, processed_at, error_message
FROM finance_revenue_events
WHERE event_data->>'order_number' = 'TEST-001';

-- Check journal entry created
SELECT * FROM finance_journal_entries
WHERE reference LIKE '%TEST-001%';

-- Check order financial data
SELECT * FROM finance_order_data
WHERE order_id = (SELECT id FROM delivery_orders WHERE order_number = 'TEST-001');
```

## Maintenance

### Archiving Old Events

Archive completed events older than 90 days:

```sql
SELECT archive_old_completed_events(90);
```

### Monitoring Performance

Check if events are processing within 100ms target:

```sql
SELECT 
  COUNT(*) as total_events,
  AVG(processing_time_ms) as avg_time,
  MAX(processing_time_ms) as max_time,
  COUNT(*) FILTER (WHERE processing_time_ms > 100) as over_threshold,
  (COUNT(*) FILTER (WHERE processing_time_ms > 100)::NUMERIC / COUNT(*)::NUMERIC * 100) as over_threshold_pct
FROM finance_event_processing_dashboard
WHERE processed_at > NOW() - INTERVAL '24 hours';
```

### Alert Thresholds

Set up monitoring alerts for:
- **Pending events > 10**: Queue backlog
- **Failed events > 5**: System issues
- **Processing time > 100ms**: Performance degradation
- **Stuck events > 0**: Processing failures

## Future Enhancements

1. **Batch Processing**: Process multiple events in parallel
2. **Priority Queue**: Prioritize high-value orders
3. **Dead Letter Queue**: Separate queue for permanently failed events
4. **Webhook Integration**: Send status updates to external systems
5. **Event Replay**: Replay events for testing or recovery

## Support

For issues or questions:
- Check `finance_error_log` table for error details
- Review `finance_performance_metrics` for performance issues
- Use `finance_event_processing_dashboard` view for monitoring
- Contact Finance Module team for integration support
