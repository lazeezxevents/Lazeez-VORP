import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            y: [0, -60, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[15%] -right-[5%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[150px]" 
        />
      </div>

      <div className="relative z-10 max-w-2xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Animated 404 Illustration */}
          <div className="relative mb-12 flex justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 1, type: "spring" }}
              className="relative"
            >
              <div className="text-[180px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-white/5 select-none">
                404
              </div>
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div className="w-32 h-32 rounded-[40px] bg-card/40 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center">
                  <Search className="w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(237,0,79,0.5)]" />
                </div>
              </motion.div>
            </motion.div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 font-montserrat tracking-tight">
            Lost in operations?
          </h1>
          
          <p className="text-lg text-slate-400 mb-10 max-w-lg mx-auto font-poppins leading-relaxed">
            The page you are looking for has been moved or archived. 
            Don't worry, our tracking systems are still functional.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              variant="outline" 
              asChild 
              className="h-12 px-8 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all font-bold gap-2 group"
            >
              <Link to="/">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Return to home
              </Link>
            </Button>
            
            <Button 
              asChild 
              className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all font-bold gap-2 group"
            >
              <Link to="/dashboard">
                <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Go to dashboard
              </Link>
            </Button>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5">
            <p className="text-xs text-slate-600 uppercase tracking-[0.2em] font-medium">
              Lazeez Operational Intelligence Portal
            </p>
          </div>
        </motion.div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 pointer-events-none" />
    </div>
  );
};

export default NotFound;
