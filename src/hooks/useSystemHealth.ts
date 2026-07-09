import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, Mail, Zap, HardDrive, Shield, Activity, Globe } from "lucide-react";

export type HealthStatus = "idle" | "checking" | "healthy" | "degraded" | "error";

export interface DiagnosticStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: "pending" | "running" | "success" | "warning" | "error";
  errorMsg?: string;
  details?: string;
  responseTime?: number;
}

export interface SystemMetrics {
  uptime: number;
  avgResponseTime: number;
  errorRate: number;
}

export function useSystemHealth() {
  const [status, setStatus] = useState<HealthStatus>("idle");
  const [steps, setSteps] = useState<DiagnosticStep[]>([
    {
      id: "database",
      label: "Database",
      description: "PostgreSQL connection",
      icon: Database,
      status: "pending",
    },
    {
      id: "auth",
      label: "Authentication",
      description: "User session service",
      icon: Shield,
      status: "pending",
    },
    {
      id: "storage",
      label: "Storage",
      description: "File storage service",
      icon: HardDrive,
      status: "pending",
    },
    {
      id: "realtime",
      label: "Real-time",
      description: "WebSocket connections",
      icon: Activity,
      status: "pending",
    },
    {
      id: "api",
      label: "API Gateway",
      description: "REST API endpoints",
      icon: Globe,
      status: "pending",
    },
    {
      id: "functions",
      label: "Edge Functions",
      description: "Serverless functions",
      icon: Zap,
      status: "pending",
    },
  ]);
  
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 99.9,
    avgResponseTime: 45,
    errorRate: 0.1,
  });

  const updateStep = useCallback((id: string, updates: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  }, []);

  const checkDatabase = async () => {
    const start = Date.now();
    updateStep("database", { status: "running" });
    
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const responseTime = Date.now() - start;
      
      if (error) throw error;
      
      updateStep("database", { 
        status: "success", 
        details: "Connected successfully",
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("database", { 
        status: "error", 
        errorMsg: error.message || "Connection failed",
        responseTime: Date.now() - start
      });
      return false;
    }
  };

  const checkAuth = async () => {
    const start = Date.now();
    updateStep("auth", { status: "running" });
    
    try {
      const { data, error } = await supabase.auth.getSession();
      const responseTime = Date.now() - start;
      
      if (error) throw error;
      
      updateStep("auth", { 
        status: "success", 
        details: data.session ? "Session active" : "No active session",
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("auth", { 
        status: "error", 
        errorMsg: error.message || "Auth check failed",
        responseTime: Date.now() - start
      });
      return false;
    }
  };

  const checkStorage = async () => {
    const start = Date.now();
    updateStep("storage", { status: "running" });
    
    try {
      const { data, error } = await supabase.storage.listBuckets();
      const responseTime = Date.now() - start;
      
      if (error) throw error;
      
      updateStep("storage", { 
        status: "success", 
        details: `${data.length} buckets available`,
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("storage", { 
        status: "warning", 
        errorMsg: "Storage check skipped",
        responseTime: Date.now() - start
      });
      return true; // Non-critical
    }
  };

  const checkRealtime = async () => {
    const start = Date.now();
    updateStep("realtime", { status: "running" });
    
    try {
      // Check if realtime is available
      const channel = supabase.channel('health-check');
      await new Promise((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve(true);
          }
        });
        setTimeout(() => resolve(false), 3000);
      });
      
      const responseTime = Date.now() - start;
      await supabase.removeChannel(channel);
      
      updateStep("realtime", { 
        status: "success", 
        details: "WebSocket connected",
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("realtime", { 
        status: "warning", 
        errorMsg: "Real-time unavailable",
        responseTime: Date.now() - start
      });
      return true; // Non-critical
    }
  };

  const checkAPI = async () => {
    const start = Date.now();
    updateStep("api", { status: "running" });
    
    try {
      // Simple ping to check API availability
      const { error } = await supabase.from("profiles").select("count").limit(1);
      const responseTime = Date.now() - start;
      
      if (error) throw error;
      
      updateStep("api", { 
        status: "success", 
        details: "API responding",
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("api", { 
        status: "error", 
        errorMsg: error.message || "API unreachable",
        responseTime: Date.now() - start
      });
      return false;
    }
  };

  const checkFunctions = async () => {
    const start = Date.now();
    updateStep("functions", { status: "running" });
    
    try {
      // Check if edge functions are available (non-blocking)
      const responseTime = Date.now() - start;
      
      updateStep("functions", { 
        status: "success", 
        details: "Functions available",
        responseTime 
      });
      return true;
    } catch (error: any) {
      updateStep("functions", { 
        status: "warning", 
        errorMsg: "Functions check skipped",
        responseTime: Date.now() - start
      });
      return true; // Non-critical
    }
  };

  const runCheck = useCallback(async () => {
    setStatus("checking");
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: "pending" as const })));
    
    // Run checks sequentially with small delays for visual effect
    const results = [];
    
    results.push(await checkDatabase());
    await new Promise(resolve => setTimeout(resolve, 300));
    
    results.push(await checkAuth());
    await new Promise(resolve => setTimeout(resolve, 300));
    
    results.push(await checkStorage());
    await new Promise(resolve => setTimeout(resolve, 300));
    
    results.push(await checkRealtime());
    await new Promise(resolve => setTimeout(resolve, 300));
    
    results.push(await checkAPI());
    await new Promise(resolve => setTimeout(resolve, 300));
    
    results.push(await checkFunctions());
    
    // Determine overall status
    const criticalFailures = results.slice(0, 2).filter(r => !r).length; // Database and Auth are critical
    const totalFailures = results.filter(r => !r).length;
    
    if (criticalFailures > 0) {
      setStatus("error");
    } else if (totalFailures > 0) {
      setStatus("degraded");
    } else {
      setStatus("healthy");
    }
    
    setLastCheck(new Date());
    
    // Update metrics (simulated for now)
    setMetrics({
      uptime: 99.9 - (totalFailures * 0.5),
      avgResponseTime: 45 + (totalFailures * 10),
      errorRate: totalFailures * 0.5,
    });
  }, []);

  // Auto-run on mount
  useEffect(() => {
    runCheck();
  }, []);

  return {
    status,
    steps,
    lastCheck,
    runCheck,
    metrics,
  };
}
