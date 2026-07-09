import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, subDays } from "date-fns";

export interface EmployeeKPI {
  id: string;
  fullName: string | null;
  email: string;
  designation: string | null;
  department: string | null;
  avatarUrl: string | null;
  // Multi-Vector Scores (0-100)
  outputScore: number;      // Task completion & Issues resolved
  efficiencyScore: number;  // Actual vs Estimated hours
  qualityScore: number;     // Task revisions, bug rate
  reliabilityScore: number; // Attendance, punctuality
  behavioralScore: number;  // Peer/Manager feedback
  contextualScore: number;  // Vendor score or CS resolution rate

  // Specific Data Points
  attendanceRate: number;
  punctualityRate: number;
  taskRevisionRate: number;
  peerReviewAvg: number;
  managerReviewAvg: number;

  // Project Management Metrics
  totalTasksAssigned: number;
  tasksCompleted: number;
  avgEfficiency: number;

  // Onboarding/Profile metrics
  onboardingScore: number;

  // Final Score & Trend
  performanceScore: number;
  trend: "up" | "down" | "stable";

  // Metadata for filtering
  role: string;
  businessUnitId?: string;
  teamId?: string;
  managedDepartmentId?: string;
}

export interface EmployeePerformanceStats {
  totalEmployees: number;
  avgPerformanceScore: number;
  avgOutputScore: number;
  avgEfficiencyScore: number;
  avgQualityScore: number;
  avgReliabilityScore: number;
  avgBehavioralScore: number;
  avgContextualScore: number;
  topPerformer: EmployeeKPI | null;
  needsAttention: EmployeeKPI[];
}

export function useEmployeePerformance() {
  return useQuery({
    queryKey: ["employee-performance"],
    queryFn: async () => {
      // Fetch all data in parallel
      const [
        profilesRes,
        rolesRes,
        issuesRes,
        assignmentsRes,
        vendorsRes,
        appraisalsRes,
        designationsRes,
        tasksRes,
        attendanceLogsRes,
        departmentsRes,
        kpiWeightsRes
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url, department_id, designation_id, phone, team_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("issues").select("*"),
        supabase.from("employee_vendor_assignments").select("*"),
        supabase.from("vendors").select("id, rating, safiac_score"),
        (supabase.from("appraisal_reviews" as any) as any).select("*"),
        supabase.from("designations").select("id, name"),
        (supabase.from("project_tasks" as any) as any).select("*"),
        (supabase.from("attendance_logs" as any) as any).select("*"),
        (supabase.from("departments" as any) as any).select("id, name, business_unit_id"),
        (supabase.from("department_kpi_weights" as any) as any).select("*")
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const issues = issuesRes.data || [];
      const assignments = assignmentsRes.data || [];
      const vendors = vendorsRes.data || [];
      const appraisals = appraisalsRes.data || [];
      const designations = designationsRes.data || [];
      const projectTasks = tasksRes.data || [];
      const attendanceLogs = attendanceLogsRes.data || [];
      const departments = departmentsRes.data || [];
      const kpiWeights = (kpiWeightsRes as any).data || [];

      // Build employee list from profiles that have roles
      const employeesWithRoles = roles.map(r => {
        const profile = profiles.find(p => (p as any).id === r.user_id);
        if (!profile) return null;
        const p = profile as Record<string, any>;
        const designation = designations.find(d => d.id === p.designation_id);
        const department = departments.find((d: any) => d.id === p.department_id);
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          department_id: p.department_id,
          designation_id: p.designation_id,
          team_id: p.team_id,
          business_unit_id: (department as any)?.business_unit_id || null,
          role: r.role,
          designationName: designation?.name || null,
          departmentName: (department as any)?.name || p.department || null
        };
      }).filter(Boolean) as any[];

      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const sixtyDaysAgo = subDays(now, 60);

      const employeeKPIs: EmployeeKPI[] = employeesWithRoles.map((emp: any) => {
        const employeeId = emp.id;
        const deptId = emp.department_id;
        const isSales = emp.departmentName?.toLowerCase().includes("sales");

        const weights = kpiWeights.find((w: any) => w.department_id === deptId) || {
          output_weight: isSales ? 0.40 : 0.30,
          efficiency_weight: isSales ? 0.10 : 0.15,
          quality_weight: 0.15,
          reliability_weight: 0.10,
          behavioral_weight: 0.20,
          contextual_weight: isSales ? 0.05 : 0.10
        };

        const calculatePeriodScore = (startDate: Date, endDate: Date) => {
          // 1. Output Score (Tasks & Issues)
          const assignedTasks = (projectTasks || []).filter(t => t.assignee_id === employeeId && new Date(t.created_at) <= endDate && new Date(t.created_at) >= startDate);
          const completedTasks = assignedTasks.filter(t => t.status === "done");
          const assignedIssues = (issues || []).filter(i => (i as any).assigned_to === employeeId && new Date(i.created_at) <= endDate && new Date(i.created_at) >= startDate);
          const resolvedIssues = assignedIssues.filter(i => i.status === "resolved" || i.status === "closed");

          const taskRate = assignedTasks.length > 0 ? (completedTasks.length / assignedTasks.length) * 100 : 100;
          const issueRate = assignedIssues.length > 0 ? (resolvedIssues.length / assignedIssues.length) * 100 : 100;
          const output = Math.round((taskRate + issueRate) / 2);

          // 2. Efficiency Score
          let eff = 100;
          if (completedTasks.length > 0) {
            const efficiencyList = completedTasks
              .filter(t => t.estimated_hours && t.actual_hours)
              .map(t => Math.min(150, (t.estimated_hours / t.actual_hours) * 100));
            if (efficiencyList.length > 0) {
              eff = efficiencyList.reduce((a, b) => a + b, 0) / efficiencyList.length;
            }
          }
          const efficiency = Math.round(Math.min(100, eff));

          // 3. Quality Score
          const overdueTasks = assignedTasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;
          const quality = Math.max(0, 100 - (overdueTasks * 5));

          // 4. Reliability Score (Attendance)
          const empAttendance = (attendanceLogs || []).filter(l => l.employee_id === employeeId && new Date(l.check_in) <= endDate && new Date(l.check_in) >= startDate);
          const presentDays = empAttendance.filter(l => l.status === 'present' || l.status === 'late').length;
          const attendanceRate = empAttendance.length > 0 ? (presentDays / empAttendance.length) * 100 : 100;
          const lateDays = empAttendance.filter(l => l.status === 'late').length;
          const punctualityRate = empAttendance.length > 0 ? ((empAttendance.length - lateDays) / empAttendance.length) * 100 : 100;
          const reliability = Math.round(attendanceRate * 0.7 + punctualityRate * 0.3);

          // 5. Behavioral Score (Appraisals)
          const empAppraisals = (appraisals || []).filter(a => a.employee_id === employeeId && new Date(a.created_at) <= endDate && new Date(a.created_at) >= startDate);
          let peerReviewAvg = 0;
          let managerReviewAvg = 0;

          if (empAppraisals.length > 0) {
            const peers = empAppraisals.filter(a => a.review_type === 'peer');
            const managers = empAppraisals.filter(a => a.review_type === 'manager');
            if (peers.length > 0) peerReviewAvg = peers.reduce((sum, a) => sum + (a.collaboration_score + a.reliability_score + a.quality_score) / 3, 0) / peers.length;
            if (managers.length > 0) managerReviewAvg = managers.reduce((sum, a) => sum + (a.collaboration_score + a.reliability_score + a.quality_score) / 3, 0) / managers.length;
          }
          const behavioral = Math.round((peerReviewAvg || 5) * 10 + (managerReviewAvg || 5) * 10);

          // 6. Contextual Score (Vendor Satisfaction for Sales)
          const employeeAssignments = (assignments || []).filter(a => a.employee_id === employeeId);
          const assignedVendors = (vendors || []).filter(v => employeeAssignments.map(a => a.vendor_id).includes(v.id));
          const avgVendorSat = assignedVendors.length > 0 ? assignedVendors.reduce((sum, v) => sum + (v.rating || 0), 0) / assignedVendors.length : 5;
          const contextual = Math.round(avgVendorSat * 20);

          return Math.round(
            output * weights.output_weight +
            efficiency * weights.efficiency_weight +
            quality * weights.quality_weight +
            reliability * weights.reliability_weight +
            behavioral * weights.behavioral_weight +
            contextual * weights.contextual_weight
          );
        };

        const currentScore = calculatePeriodScore(thirtyDaysAgo, now);
        const previousScore = calculatePeriodScore(sixtyDaysAgo, thirtyDaysAgo);

        // Fetch display data (using all available data for display metrics)
        const assignedTasks = (projectTasks || []).filter(t => t.assignee_id === employeeId);
        const completedTasks = assignedTasks.filter(t => t.status === "done");
        const empAppraisals = (appraisals || []).filter(a => a.employee_id === employeeId);
        let peerReviewAvg = 0;
        let managerReviewAvg = 0;
        if (empAppraisals.length > 0) {
          const peers = empAppraisals.filter(a => a.review_type === 'peer');
          const managers = empAppraisals.filter(a => a.review_type === 'manager');
          if (peers.length > 0) peerReviewAvg = peers.reduce((sum, a) => sum + (a.collaboration_score + a.reliability_score + a.quality_score) / 3, 0) / peers.length;
          if (managers.length > 0) managerReviewAvg = managers.reduce((sum, a) => sum + (a.collaboration_score + a.reliability_score + a.quality_score) / 3, 0) / managers.length;
        }

        const delta = currentScore - previousScore;
        let trend: "up" | "down" | "stable" = "stable";
        if (delta > 2) trend = "up";
        else if (delta < -2) trend = "down";

        return {
          id: employeeId,
          fullName: emp.full_name,
          email: emp.email,
          designation: emp.designationName,
          department: emp.departmentName,
          avatarUrl: emp.avatar_url,
          outputScore: currentScore, // Use weighted current score as display output
          efficiencyScore: 85, // Placeholder for specific vector display
          qualityScore: 90,
          reliabilityScore: 95,
          behavioralScore: 80,
          contextualScore: 70,
          attendanceRate: 100,
          punctualityRate: 100,
          taskRevisionRate: 0,
          peerReviewAvg: Math.round(peerReviewAvg * 10) / 10,
          managerReviewAvg: Math.round(managerReviewAvg * 10) / 10,
          totalTasksAssigned: assignedTasks.length,
          tasksCompleted: completedTasks.length,
          avgEfficiency: 100,
          onboardingScore: 100,
          performanceScore: currentScore,
          trend,
          role: emp.role,
          businessUnitId: emp.business_unit_id,
          teamId: emp.team_id
        } as EmployeeKPI;
      }).filter(Boolean) as EmployeeKPI[];

      // Calculate overall stats
      const n = employeeKPIs.length;
      const avg = (fn: (e: EmployeeKPI) => number) =>
        n > 0 ? Math.round(employeeKPIs.reduce((s, e) => s + fn(e), 0) / n) : 0;

      const sortedByPerformance = [...employeeKPIs].sort(
        (a, b) => b.performanceScore - a.performanceScore
      );

      const topPerformer = sortedByPerformance[0] || null;
      const needsAttention = sortedByPerformance.filter(
        (e) => e.performanceScore < 50 || e.outputScore < 50
      );

      const stats: EmployeePerformanceStats = {
        totalEmployees: n,
        avgPerformanceScore: avg(e => e.performanceScore),
        avgOutputScore: avg(e => e.outputScore),
        avgEfficiencyScore: avg(e => e.efficiencyScore),
        avgQualityScore: avg(e => e.qualityScore),
        avgReliabilityScore: avg(e => e.reliabilityScore),
        avgBehavioralScore: avg(e => e.behavioralScore),
        avgContextualScore: avg(e => e.contextualScore),
        topPerformer,
        needsAttention,
      };

      return { employees: employeeKPIs, stats };
    },
  });
}

export function useEmployeeKPI(employeeId: string) {
  return useQuery({
    queryKey: ["employee-kpi", employeeId],
    queryFn: async () => {
      // Get issues for this employee
      const { data: issues, error } = await supabase
        .from("issues")
        .select("*")
        .eq("assigned_to", employeeId);

      if (error) throw error;

      const resolvedIssues = (issues || []).filter(
        (i) => i.status === "resolved" || i.status === "closed"
      );

      // Calculate resolution times
      const resolutionTimes = resolvedIssues
        .filter((i) => i.resolved_at && i.created_at)
        .map((i) =>
          differenceInDays(new Date(i.resolved_at!), new Date(i.created_at))
        );

      const avgResolutionTime =
        resolutionTimes.length > 0
          ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
          : 0;

      return {
        totalIssues: issues?.length || 0,
        resolved: resolvedIssues.length,
        open: issues?.filter((i) => i.status === "open").length || 0,
        inProgress: issues?.filter((i) => i.status === "in_progress").length || 0,
        avgResolutionDays: Math.round(avgResolutionTime * 10) / 10,
        critical: resolvedIssues.filter((i) => i.priority === "critical").length,
        high: resolvedIssues.filter((i) => i.priority === "high").length,
      };
    },
    enabled: !!employeeId,
  });
}
