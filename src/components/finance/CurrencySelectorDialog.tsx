import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  Globe,
  DollarSign,
} from "lucide-react";
import { getCurrencies, type Currency } from "./CurrencyService";
import { getLatestExchangeRate } from "./ExchangeRateService";
import { useToast } from "@/hooks/use-toast";

interface CurrencySelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (currency: Currency) => void;
  currentCurrency?: Currency;
  baseCurrency?: string;
}

export function CurrencySelectorDialog({
  open,
  onOpenChange,
  onSelect,
  currentCurrency,
  baseCurrency = "PKR",
}: CurrencySelectorDialogProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Currency[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCurrencies();
    }
  }, [open]);

  useEffect(() => {
    filterCurrencies();
  }, [searchQuery, currencies]);

  const loadCurrencies = async () => {
    setLoading(true);
    const { data, error } = await getCurrencies();

    if (error) {
      toast({
        title: "Error loading currencies",
        description: error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setCurrencies(data);
    setFilteredCurrencies(data);

    // Load exchange rates for display
    const rates: Record<string, number> = {};
    for (const currency of data) {
      if (currency.code !== baseCurrency) {
        const { data: rateData } = await getLatestExchangeRate(
          baseCurrency,
          currency.code
        );
        if (rateData) {
          rates[currency.code] = rateData.rate;
        }
      }
    }
    setExchangeRates(rates);
    setLoading(false);
  };

  const filterCurrencies = () => {
    if (!searchQuery.trim()) {
      setFilteredCurrencies(currencies);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = currencies.filter(
      (currency) =>
        currency.code.toLowerCase().includes(query) ||
        currency.name.toLowerCase().includes(query) ||
        currency.symbol.includes(query)
    );
    setFilteredCurrencies(filtered);
  };

  const handleSelect = (currency: Currency) => {
    onSelect(currency);
    onOpenChange(false);
    setSearchQuery("");
  };

  const getTrendIcon = (code: string) => {
    const rate = exchangeRates[code];
    if (!rate) return <Minus className="w-3 h-3" />;

    // Simple trend logic based on rate comparison
    if (rate > 1) return <TrendingUp className="w-3 h-3 text-success" />;
    if (rate < 1) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="w-5 h-5 text-primary" />
            </motion.div>
            Select currency
          </DialogTitle>
          <DialogDescription>
            Choose a currency for your transactions. Exchange rates are updated daily.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, name, or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Currency List */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredCurrencies.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No currencies found</p>
              <p className="text-sm">Try adjusting your search</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-1"
            >
              {filteredCurrencies.map((currency) => {
                const isSelected = currentCurrency?.code === currency.code;
                const rate = exchangeRates[currency.code];

                return (
                  <motion.div
                    key={currency.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.01, x: 4 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full justify-start h-auto p-4 ${
                        isSelected ? "bg-accent border-2 border-primary" : ""
                      }`}
                      onClick={() => handleSelect(currency)}
                    >
                      <div className="flex items-center gap-4 w-full">
                        {/* Currency Symbol */}
                        <motion.div
                          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold"
                          whileHover={{ rotate: 5, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {currency.symbol}
                        </motion.div>

                        {/* Currency Info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{currency.code}</span>
                            {currency.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500 }}
                              >
                                <Check className="w-4 h-4 text-primary" />
                              </motion.div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {currency.name}
                          </p>
                        </div>

                        {/* Exchange Rate */}
                        {rate && currency.code !== baseCurrency && (
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              {getTrendIcon(currency.code)}
                              <span>{rate.toFixed(4)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              1 {baseCurrency}
                            </p>
                          </div>
                        )}
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Footer Info */}
        <div className="border-t pt-4 text-xs text-muted-foreground text-center">
          Exchange rates are updated daily from multiple providers
        </div>
      </DialogContent>
    </Dialog>
  );
}
