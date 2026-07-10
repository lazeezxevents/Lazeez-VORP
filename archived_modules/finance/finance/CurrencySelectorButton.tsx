import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, RefreshCw } from "lucide-react";
import { CurrencySelectorDialog } from "./CurrencySelectorDialog";
import { getDefaultCurrency, getUserCurrencyPreference, setUserCurrencyPreference, type Currency } from "./CurrencyService";
import { updateDailyExchangeRates } from "./ExchangeRateService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/contexts/AuthContext";

interface CurrencySelectorButtonProps {
  onCurrencyChange?: (currency: Currency) => void;
  showRefresh?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function CurrencySelectorButton({
  onCurrencyChange,
  showRefresh = true,
  variant = "outline",
  size = "default",
}: CurrencySelectorButtonProps) {
  const [open, setOpen] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadCurrentCurrency();
  }, [user]);

  const loadCurrentCurrency = async () => {
    setLoading(true);

    // Try to get user preference first
    if (user) {
      const { data: preference } = await getUserCurrencyPreference(user.id);
      if (preference) {
        const { data: currency } = await getDefaultCurrency();
        if (currency && currency.code === preference.currency_code) {
          setCurrentCurrency(currency);
          setLoading(false);
          return;
        }
      }
    }

    // Fall back to default currency
    const { data: defaultCurrency } = await getDefaultCurrency();
    if (defaultCurrency) {
      setCurrentCurrency(defaultCurrency);
    }

    setLoading(false);
  };

  const handleCurrencySelect = async (currency: Currency) => {
    setCurrentCurrency(currency);

    // Save user preference
    if (user) {
      const { error } = await setUserCurrencyPreference(user.id, currency.code);
      if (error) {
        toast({
          title: "Error saving preference",
          description: error,
          variant: "destructive",
        });
      }
    }

    // Notify parent
    onCurrencyChange?.(currency);

    toast({
      title: "Currency updated",
      description: `Switched to ${currency.name} (${currency.code})`,
    });
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);

    const { success, error, source, count } = await updateDailyExchangeRates();

    if (success) {
      toast({
        title: "Exchange rates updated",
        description: `Successfully updated ${count} rates from ${source}`,
      });
    } else {
      toast({
        title: "Failed to update rates",
        description: error,
        variant: "destructive",
      });
    }

    setRefreshing(false);
  };

  if (loading || !currentCurrency) {
    return (
      <Button variant={variant} size={size} disabled>
        <div className="shimmer h-4 w-16 rounded" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
          className="gap-2"
        >
          <motion.span
            className="font-bold"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {currentCurrency.symbol}
          </motion.span>
          <span>{currentCurrency.code}</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </Button>
      </motion.div>

      {showRefresh && (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshRates}
            disabled={refreshing}
            title="Refresh exchange rates"
          >
            <motion.div
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{
                duration: 1,
                repeat: refreshing ? Infinity : 0,
                ease: "linear",
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
          </Button>
        </motion.div>
      )}

      <CurrencySelectorDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={handleCurrencySelect}
        currentCurrency={currentCurrency}
      />
    </div>
  );
}
