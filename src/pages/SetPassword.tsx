import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lazeezLogo from "@/assets/lazeez-logo.png";
import { notifyDesignationAssigned } from "@/components/utils/notifications";

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
    <div className="space-y-2 mt-3">
      <div className="flex justify-end items-center px-1">
        <span className={`text-[10px] font-bold ${label === "Weak" ? "text-red-500" : label === "Fair" ? "text-amber-500" : label === "Good" ? "text-blue-500" : "text-emerald-500"}`}>
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

export default function SetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [isValidating, setIsValidating] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError("Invalid invitation link. Please check your email or contact HR.");
      setIsValidating(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("employee_invitations")
        .select(`
          *,
          designation:role_id(display_name),
          department:department_id(name)
        `)
        .eq("invitation_token", token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError("Invalid invitation link. Please check your email or contact HR.");
        setIsValidating(false);
        return;
      }

      if (data.status === 'accepted') {
        setError("This invitation has already been used. Please contact HR if you need assistance.");
        setIsValidating(false);
        return;
      }

      if (data.status === 'revoked') {
        setError("This invitation has been revoked. Please contact HR for a new invitation.");
        setIsValidating(false);
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError("This invitation has expired. Please contact HR for a new invitation.");
        setIsValidating(false);
        return;
      }

      setTokenData(data);
      setIsValidating(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("An error occurred while validating your invitation. Please try again.");
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: tokenData.email,
        password: password,
        options: {
          data: {
            full_name: tokenData.full_name || tokenData.email.split('@')[0],
            department_id: tokenData.department_id,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create account");
      }

      // Update the invitation status
      const { error: updateError } = await supabase
        .from("employee_invitations")
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq("id", tokenData.id);

      if (updateError) console.error("Failed to update invitation:", updateError);

      // Assign the designation
      if (tokenData.role_id) {
        const { error: assignError } = await supabase
          .from("role_assignments")
          .insert({
            user_id: authData.user.id,
            role_id: tokenData.role_id,
            assigned_by: tokenData.invited_by,
          });

        if (assignError) console.error("Failed to assign role:", assignError);
      }

      // Update profile with HR approval (but still needs admin approval)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          hr_approved_by: tokenData.invited_by,
          hr_approved_at: new Date().toISOString(),
          designation: tokenData.designation?.display_name,
          onboarding_type: 'hr_invitation',
          approval_status: 'admin_approved', // HR pre-approved, waiting for admin
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Failed to update profile:", profileError);

      // Send notifications to user
      // NOTE: HR notification system has been removed

      // Notify employee about their designation
      if (tokenData.designation?.display_name) {
        await notifyDesignationAssigned(authData.user.id, tokenData.designation.display_name);
      }

      toast.success("Account created successfully! Your account is pending admin approval.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Account creation error:", err);
      toast.error(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <img src={lazeezLogo} alt="Lazeez Events" className="h-16" />
          </div>
          
          <Card className="border-2 border-red-200">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Invalid Invitation</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => navigate("/")} className="w-full">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <img src={lazeezLogo} alt="Lazeez Events" className="h-16" />
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2">Set Your Password</h1>
              <p className="text-muted-foreground">
                Complete your account setup for Lazeez VORP
              </p>
            </div>

            {/* Invitation Info */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{tokenData?.email}</p>
              </div>
              {tokenData?.designation && (
                <div>
                  <p className="text-xs text-muted-foreground">Designation</p>
                  <p className="font-medium">{tokenData.designation.display_name}</p>
                </div>
              )}
              {tokenData?.department && (
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{tokenData.department.name}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choose a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 h-12"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
