import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Loader2, User, Building2, CheckCircle2, ShieldCheck, Zap, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import lazeezLogo from "@/assets/lazeez-logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

const MotionButton = motion(Button);

const shakeVariants = {
  shake: {
    x: [0, -25, 25, -25, 25, -25, 25, 0],
    transition: {
      duration: 0.4,
      ease: "linear",
      times: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 1]
    }
  }
};



const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const [strength, setStrength] = useState(0);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("bg-slate-200");

  useEffect(() => {
    if (!password) {
      setStrength(0);
      setLabel("");
      return;
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    setStrength(score);

    switch (score) {
      case 0:
      case 1:
        setLabel("Weak");
        setColor("bg-red-500");
        break;
      case 2:
        setLabel("Fair");
        setColor("bg-amber-500");
        break;
      case 3:
        setLabel("Good");
        setColor("bg-blue-500");
        break;
      case 4:
        setLabel("Strong");
        setColor("bg-emerald-500");
        break;
      default:
        setLabel("");
        setColor("bg-slate-200");
    }
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-end items-center px-1">
        <span className={`text-[10px] font-bold uppercase ${label === "Weak" ? "text-red-500" : label === "Fair" ? "text-amber-500" : label === "Good" ? "text-blue-500" : "text-emerald-500"}`}>
          {label}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1 p-0.5">
        {[1, 2, 3, 4].map((step) => (
          <motion.div
            key={step}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: strength >= step ? 1 : 0 }}
            className={`h-full flex-1 rounded-full transition-colors duration-500 ${strength >= step ? color : "bg-slate-200"}`}
            style={{ transformOrigin: "left" }}
          />
        ))}
      </div>
    </div>
  );
};

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<{ id: string; name: string; count?: number }[]>([]);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [shakingField, setShakingField] = useState<string | null>(null);


  const triggerShake = (fieldId: string) => {
    setShakingField(fieldId);
    setTimeout(() => setShakingField(null), 500);
  };

  const showError = (title: string, message: string, fieldId?: string) => {
    if (fieldId) triggerShake(fieldId);
    toast.error(message, {
      description: title !== "Verification Error" ? title : undefined
    });
  };

  useEffect(() => {
    async function fetchDepartments() {
      // Fetch departments
      const { data: depts, error: deptsError } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (!deptsError && depts) {
        // Fetch profiles counts per department using secure RPC to bypass RLS
        const { data: countsData, error: pError } = await supabase
          .rpc("get_department_counts");

        if (!pError && countsData) {
          // Map counts back to departments
          const countsMap = (countsData as any[]).reduce((acc: any, item: any) => {
            acc[item.department_id] = item.employee_count;
            return acc;
          }, {});

          const deptsWithCounts = depts.map(d => ({
            ...d,
            count: Number(countsMap[d.id] || 0)
          }));
          setDepartments(deptsWithCounts);
        } else {
          setDepartments(depts.map(d => ({ ...d, count: 0 })));
        }
      }
    }
    fetchDepartments();
  }, []);

  // Redirect if already logged in (declarative — avoids blank screen from navigate() during render)
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!signInEmail) {
      showError("Missing Field", "Please enter your email address.", "signin-email");
      setIsLoading(false);
      return;
    }

    if (!signInPassword) {
      showError("Missing Field", "Please enter your password.", "signin-password");
      setIsLoading(false);
      return;
    }

    const isInternalEmail = (emailStr: string) => {
      const allowedDomains = ["lazeezevents.com", "gmail.com", "flosek.com", "orientsoftsolutios.com"];
      const domain = emailStr.split("@")[1]?.toLowerCase();
      return allowedDomains.includes(domain);
    };

    if (!isInternalEmail(signInEmail)) {
      showError("Access Denied", "This system is restricted to authorized personnel. Please use your @lazeezevents.com email.", "signin-email");
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(signInEmail, signInPassword);

    if (error) {
      showError("Login Failed", error.message || "Invalid credentials provided.", "signin-password");
      setIsLoading(false);
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const isInternalEmail = (emailStr: string) => {
      const allowedDomains = ["lazeezevents.com", "gmail.com", "flosek.com", "orientsoftsolutios.com"];
      const domain = emailStr.split("@")[1]?.toLowerCase();
      return allowedDomains.includes(domain);
    };

    if (!fullName.trim()) {
      showError("Incomplete Profile", "Full name is required.", "signup-name");
      setIsLoading(false);
      return;
    }

    if (!signUpEmail) {
      showError("Incomplete Profile", "Email address is required.", "signup-email");
      setIsLoading(false);
      return;
    }

    if (!departmentId) {
      showError("Incomplete Profile", "Please select your department.", "signup-dept");
      setIsLoading(false);
      return;
    }

    if (!isInternalEmail(signUpEmail)) {
      showError("Unauthorized Domain", "Please use an authorized enterprise email address (@lazeezevents.com).", "signup-email");
      setIsLoading(false);
      return;
    }

    if (signUpPassword !== confirmPassword) {
      showError("Security Mismatch", "Passwords do not match. Please verify your entries.", "signup-confirm");
      setIsLoading(false);
      return;
    }

    if (signUpPassword.length < 8) {
      showError("Weak Password", "Password must be at least 8 characters long.", "signup-password");
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(signUpEmail, signUpPassword, fullName, departmentId);

    if (error) {
      showError("Registration Failed", error.message || "Could not create your account at this time.");
      setIsLoading(false);
    } else {
      toast.success("Account created! Awaiting approval.");
      navigate("/approval-pending");
    }
  };

  return (
    <div className="min-h-screen flex bg-white overflow-hidden font-poppins">
      {/* Left Panel - Premium Branding */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden"
      >
        {/* Simplified Background */}
        <div className="absolute inset-0 bg-primary shadow-inner" />
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-center items-start w-full p-20 text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mb-12"
          >
            <img src={lazeezLogo} alt="Lazeez Events" className="h-20 brightness-0 invert drop-shadow-2xl" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="max-w-xl"
          >
            <h1 className="text-6xl font-bold mb-6 tracking-tight leading-[1.1] pb-2 text-white">
              <span className="block font-extrabold opacity-90 mb-1">Internal</span>
              <span className="block">
                <span className="text-white/60">Operations</span> System
              </span>
            </h1>
            <p className="text-xl text-white/70 font-light leading-relaxed mb-12">
              Lazeez Events internal platform for resource management, vendor tracking, and performance analytics.
            </p>
          </motion.div>

          {/* Feature List with Micro-animations */}
          <div className="space-y-6">
            {[
              { icon: ShieldCheck, text: "Security & Access" },
              { icon: Zap, text: "Fast Information" },
              { icon: Database, text: "Resource Database" },
              { icon: CheckCircle2, text: "Performance Tracking" }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
                className="flex items-center gap-4 group cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all duration-300">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-medium text-white/80 group-hover:text-white transition-colors">
                  {feature.text}
                </span>
              </motion.div>
            ))}
          </div>


        </div>
      </motion.div>

      {/* Right Panel - Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-12 relative overflow-hidden bg-slate-50/30">

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xl relative z-10"
        >
          {/* Header Mobile Only */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img src={lazeezLogo} alt="Lazeez Events" className="h-14 mb-4" />
            <h2 className="text-2xl font-medium text-primary">Welcome to Lazeez VORP</h2>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="flex justify-center mb-10">
              <TabsList className="grid w-full max-w-sm grid-cols-2 p-1.5 h-14 bg-slate-100/50 rounded-2xl">
                <TabsTrigger value="signin" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300">
                  Sign Up
                </TabsTrigger>
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "signin" ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-4xl font-bold text-foreground tracking-tight">Login</h2>
                    <p className="text-muted-foreground mt-3 text-lg font-light leading-relaxed">
                      Please enter your credentials to continue.
                    </p>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-6" noValidate>
                    <div className="space-y-3">
                      <Label htmlFor="signin-email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Email Address <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signin-email" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="Email"
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-base"
                        />
                      </motion.div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="signin-password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Password <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signin-password" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          className="pl-12 pr-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-base"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </motion.div>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-2">
                      <MotionButton
                        type="submit"
                        whileHover={{ scale: 1.02, backgroundColor: "hsl(342, 100%, 35%)" }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full max-w-[280px] h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 text-lg font-bold transition-all"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Login"
                        )}
                      </MotionButton>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="mb-8 text-center">
                    <h2 className="text-4xl font-bold text-foreground tracking-tight text-center">Sign Up</h2>
                    <p className="text-muted-foreground mt-2 text-lg font-light text-center">
                      Create your account below.
                    </p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Full Name <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signup-name" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="First and Last Name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-poppins"
                        />
                      </motion.div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-department" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Department <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signup-dept" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10 group-focus-within:text-primary transition-colors" />
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                          <SelectTrigger id="signup-department" className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-base font-poppins">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-100">
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id} className="rounded-lg py-2 cursor-pointer font-poppins">
                                {dept.name} <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-md font-bold">({dept.count || 0} employees)</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Email <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signup-email" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Email"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-poppins"
                        />
                      </motion.div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Password <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signup-password" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Choose Password"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          className="pl-12 pr-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-poppins"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </motion.div>

                      {/* Premium Password Strength Indicator */}
                      <PasswordStrengthIndicator password={signUpPassword} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground/80 pl-1 flex items-center group-focus-within:text-primary transition-colors">
                        Confirm Password <span className="text-primary ml-1.5 font-black">*</span>
                      </Label>
                      <motion.div
                        className="relative group"
                        animate={shakingField === "signup-confirm" ? "shake" : "idle"}
                        variants={shakeVariants}
                      >
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-12 pr-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-poppins"
                        />
                      </motion.div>
                    </div>

                    <div className="flex justify-center pt-6">
                      <MotionButton
                        type="submit"
                        whileHover={{ scale: 1.02, backgroundColor: "hsl(342, 100%, 35%)" }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full max-w-[280px] h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 text-lg font-bold transition-all"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </MotionButton>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>


        </motion.div>
      </div>
    </div >
  );
}
