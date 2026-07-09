# Lazeez VORP — HR & Performance Module Specification

ALL WORK STAYS INSIDE THE HR/PERFORMANCE FLOW (`/hr-performance`). Nothing else is touched.

---

## 1. Executive Overview

The HR/Performance module is a **multi-layer workforce intelligence system** operating within the VORP ecosystem. It integrates:

- Organization structure (BU → Dept → Team → Employee)
- Workforce lifecycle (Hire → Transfer → Promote → Offboard)
- Multi-vector performance scoring (6 dimensions)
- Time intelligence (Attendance, Leave, Time tracking)
- 360° feedback (Peer/Manager/Self reviews)
- Contextual vendor integration (only where applicable)
- Strategic workforce analytics

---

## 2. Module Architecture

### Data Flow
```
Organization Hierarchy → Work Activities → Performance Data → Scoring Engine → Dashboards
```

### Tab Structure (inside `/hr-performance`)
| Tab | Purpose | Status |
|-----|---------|--------|
| Overview | Org KPIs + Dept Cards + Activity Feed | ✅ Exists |
| Performance | Charts + Distribution + Rankings | ✅ Exists |
| Employees | Directory + CRUD + Detail Modal | ✅ Exists |
| Attendance | Check-in/out logs + Time Intelligence | ❌ Missing |
| Leave | Leave requests + Approval workflow | ❌ Missing |
| Appraisals | 360° review cycles + Feedback | ❌ Missing |
| Lifecycle | Transfers + Promotions + History | ❌ Missing |
| Assignments | Vendor assignments | ✅ Exists |
| Team Groups | Team management within departments | ✅ Exists |
| Designations | Job title management | ✅ Exists |
| Custom Roles | RBAC permission management | ✅ Exists (Admin only) |

---

## 3. Database Layer (What Exists)

### Tables Created
| Table | Migration | Status |
|-------|-----------|--------|
| `departments` | `20260227_hr_features.sql` | ✅ Active |
| `employee_kpis` | `20260227_hr_features.sql` | ✅ Active |
| `performance_logs` | `20260227_hr_features.sql` | ✅ Active |
| `business_units` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `teams` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `attendance_logs` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `leave_requests` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `appraisal_reviews` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `department_kpi_weights` | `20260310_enterprise_hr_erp.sql` | ✅ Active |
| `employee_history` | `20260310_enterprise_hr_erp.sql` | ✅ Active |

All tables have RLS enabled and basic policies in place.

---

## 4. Performance Scoring Engine

### 6-Vector Framework
| Vector | Weight | Data Source | Status |
|--------|--------|-------------|--------|
| Output (30%) | Task + Issue completion rate | `project_tasks`, `issues` | ✅ Implemented |
| Efficiency (15%) | Estimated vs Actual hours | `project_tasks` | ✅ Implemented |
| Quality (15%) | Overdue/rework deduction | `project_tasks` | ✅ Implemented |
| Reliability (10%) | Attendance + Punctuality | `attendance_logs` | ✅ Implemented |
| Behavioral (20%) | Peer + Manager reviews | `appraisal_reviews` | ✅ Implemented |
| Contextual (10%) | Vendor satisfaction | `vendors`, `employee_vendor_assignments` | ✅ Implemented |

Weights are configurable per department via `department_kpi_weights`.

---

## 5. UI Components Inventory

### Existing (in `HRPerformance.tsx` — 1094 lines)
- ✅ KPI Summary Cards (6 cards, real computed values)
- ✅ BU Hierarchy Navigation (Corporate / BU selector)
- ✅ Department Cards with drill-down
- ✅ Department Performance Bar Chart
- ✅ Performance Distribution Pie Chart
- ✅ Recent Activity Feed
- ✅ Employee Directory Table (Output, Efficiency, VORP, Trend)
- ✅ Employee CRUD (Add/Edit/Delete)
- ✅ Performance Detail Modal (6-vector breakdown)
- ✅ Department Management Dialog
- ✅ Team Management component
- ✅ Vendor Assignment component
- ✅ Designation Management component
- ✅ Custom Role Manager (Admin only)

### Missing
- ❌ **Attendance Tab** — No UI to log/view check-in/check-out, view attendance calendar
- ❌ **Leave Tab** — No UI to submit/approve/reject leave requests
- ❌ **Appraisals Tab** — No UI to create review cycles, submit 360° feedback
- ❌ **Lifecycle Tab** — No UI for transfers, promotions, or viewing employee history

---

## 6. Feature Requirements (What Needs Building)

### 6.1 Attendance Tab
- View attendance log table (employee, check-in, check-out, status, date)
- Mark attendance manually (HR/Admin/Manager)
- Filter by department, date range
- Attendance summary cards (Present today, Late today, Absent today)
- Monthly attendance calendar heatmap per employee

### 6.2 Leave Management Tab
- Submit leave request form (type, dates, reason)
- Leave request queue for managers/HR (approve/reject with notes)
- Leave balance display per employee
- Leave type breakdown (Annual, Sick, Maternity, Unpaid)
- Status filters (Pending, Approved, Rejected)

### 6.3 Appraisals Tab
- Create review cycle (period, reviewer, reviewee)
- Submit 360° feedback form (collaboration, reliability, quality, innovation scores + comments)
- View review history per employee
- Review type filters (Manager, Peer, Self, Subordinate)
- Aggregate feedback summaries

### 6.4 Lifecycle Tab
- Log employee events (Hire, Transfer, Promotion, Disciplinary, Offboard)
- View employee history timeline (chronological event log)
- Transfer form (change department/team/designation)
- Promotion form (change designation/team + notes)
- Employee history audit trail

---

## 7. Hooks Required

| Hook | Purpose | Status |
|------|---------|--------|
| `useEmployeePerformance` | Multi-vector scoring engine | ✅ Exists |
| `useBusinessUnits` | BU CRUD | ✅ Exists |
| `useDepartments` | Department CRUD | ✅ Exists |
| `useAttendanceLogs` | Attendance CRUD | ❌ Needed |
| `useLeaveRequests` | Leave CRUD + approval | ❌ Needed |
| `useAppraisalReviews` | 360° review CRUD | ❌ Needed |
| `useEmployeeHistory` | Lifecycle event CRUD | ❌ Needed |

---

## 8. Access Control

| Feature | Admin | HR | Manager | Employee |
|---------|-------|-----|---------|----------|
| View all departments | ✅ | ✅ | Own dept | ❌ |
| Manage departments | ✅ | ✅ | ❌ | ❌ |
| View all performance | ✅ | ✅ | Own dept | Own only |
| Mark attendance | ✅ | ✅ | Own dept | ❌ |
| Submit leave | ✅ | ✅ | ✅ | ✅ |
| Approve leave | ✅ | ✅ | Own dept | ❌ |
| Create appraisals | ✅ | ✅ | Own dept | ❌ |
| Submit feedback | ✅ | ✅ | ✅ | ✅ (self/peer) |
| Log lifecycle events | ✅ | ✅ | ❌ | ❌ |
| Custom roles | ✅ | ❌ | ❌ | ❌ |