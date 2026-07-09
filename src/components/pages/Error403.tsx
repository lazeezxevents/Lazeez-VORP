import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Home, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import lazeezLogo from "@/assets/lazeez-logo.png";

export default function Error403() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleGoHome = () => {
    navigate("/dashboard");
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <motion.img
            src={lazeezLogo}
            alt="Lazeez Events"
            className="h-16"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          />
        </div>

        {/* Main Card */}
        <Card className="border-2 border-amber-200 shadow-2xl">
          <CardContent className="p-8">
            {/* Error Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6 relative"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full bg-amber-200"
              />
              <Shield className="w-12 h-12 text-amber-600 relative z-10" />
            </motion.div>

            {/* Error Code */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center mb-4"
            >
              <h1 className="text-6xl font-bold text-amber-600 mb-2">403</h1>
              <h2 className="text-2xl font-bold text-foreground">Access Forbidden</h2>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-muted-foreground text-base mb-8 max-w-md mx-auto leading-relaxed"
            >
              You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
            </motion.p>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                onClick={handleGoHome}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
              
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </motion.div>

            {/* Support Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-8 pt-6 border-t text-center"
            >
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                Need access?{" "}
                <a href="mailto:admin@lazeezevents.com" className="text-primary hover:underline font-medium">
                  admin@lazeezevents.com
                </a>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}