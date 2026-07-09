import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw, Mail } from "lucide-react";
import lazeezLogo from "@/assets/lazeez-logo.png";

export default function Error500() {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
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
        <Card className="border-2 border-red-200 shadow-2xl">
          <CardContent className="p-8">
            {/* Error Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 relative"
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full bg-red-200"
              />
              <AlertTriangle className="w-12 h-12 text-red-600 relative z-10" />
            </motion.div>

            {/* Error Code */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center mb-4"
            >
              <h1 className="text-6xl font-bold text-red-600 mb-2">500</h1>
              <h2 className="text-2xl font-bold text-foreground">Internal Server Error</h2>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-muted-foreground text-base mb-8 max-w-md mx-auto leading-relaxed"
            >
              Something went wrong on our end. Our team has been notified and is working to fix the issue. Please try again in a few moments.
            </motion.p>

            {/* Error Details (Optional) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-xl bg-red-50 border border-red-200 mb-8"
            >
              <p className="text-xs text-red-800 font-medium text-center">
                If this problem persists, please contact our support team with error code: <span className="font-bold">ERR_500_{new Date().getTime()}</span>
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                onClick={handleRefresh}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              
              <Button
                variant="outline"
                onClick={handleGoHome}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </motion.div>

            {/* Support Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 pt-6 border-t text-center"
            >
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                Need help?{" "}
                <a href="mailto:support@lazeezevents.com" className="text-primary hover:underline font-medium">
                  support@lazeezevents.com
                </a>
              </p>
            </motion.div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          Error occurred at {new Date().toLocaleString()}
        </motion.p>
      </motion.div>
    </div>
  );
}
