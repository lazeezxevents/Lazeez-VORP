import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Globe, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MultiCurrencyManager } from "@/services/MultiCurrencyManager";
import { cn } from "@/lib/utils";

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
  showRate?: boolean;
  baseCurrency?: string;
  className?: string;
}

export function CurrencySelector({
  value,
  onChange,
  disabled = false,
  showRate = false,
  baseCurrency = "PKR",
  className,
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const currencies = MultiCurrencyManager.SUPPORTED_CURRENCIES;
  const selectedCurrency = currencies.find((c) => c.code === value);

  // Filter currencies based on search
  const filteredCurrencies = currencies.filter(
    (currency) =>
      currency.code.toLowerCase().includes(search.toLowerCase()) ||
      currency.name.toLowerCase().includes(search.toLowerCase())
  );

  // Fetch exchange rate when currency changes
  useEffect(() => {
    if (showRate && value !== baseCurrency) {
      setRateLoading(true);
      MultiCurrencyManager.getExchangeRate(baseCurrency, value)
        .then((rate) => setExchangeRate(rate))
        .catch(() => setExchangeRate(null))
        .finally(() => setRateLoading(false));
    } else {
      setExchangeRate(null);
    }
  }, [value, baseCurrency, showRate]);

  const handleSelect = (currencyCode: string) => {
    onChange(currencyCode);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between hover-lift transition-all duration-200",
            className
          )}
        >
          <motion.div
            className="flex items-center gap-2"
            initial={false}
            animate={{ scale: open ? 0.98 : 1 }}
            transition={{ duration: 0.15 }}
          >
            {selectedCurrency ? (
              <>
                <motion.span
                  className="text-lg"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: open ? 5 : 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {selectedCurrency.flag}
                </motion.span>
                <span className="font-medium">{selectedCurrency.code}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {selectedCurrency.symbol}
                </span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Select currency</span>
              </>
            )}
          </motion.div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </motion.div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Search */}
          <div className="p-2 border-b">
            <Input
              placeholder="Search currencies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Currency List */}
          <div className="max-h-[300px] overflow-y-auto p-1">
            <AnimatePresence mode="popLayout">
              {filteredCurrencies.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No currency found
                </motion.div>
              ) : (
                filteredCurrencies.map((currency, index) => {
                  const isSelected = value === currency.code;
                  const isBase = currency.code === baseCurrency;

                  return (
                    <motion.div
                      key={currency.code}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: index * 0.03 }}
                      layout
                    >
                      <motion.button
                        onClick={() => handleSelect(currency.code)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                          "hover:bg-accent focus:bg-accent focus:outline-none",
                          isSelected && "bg-accent"
                        )}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                      >
                        <motion.span
                          className="text-xl"
                          whileHover={{ scale: 1.2, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {currency.flag}
                        </motion.span>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currency.code}</span>
                            {isBase && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0 h-5"
                              >
                                Base
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {currency.name}
                          </div>
                        </div>
                        <span className="text-muted-foreground">
                          {currency.symbol}
                        </span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500 }}
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </motion.div>
                        )}
                      </motion.button>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Exchange Rate Info */}
          {showRate && value !== baseCurrency && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t p-3 bg-muted/30"
            >
              {rateLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="shimmer h-3 w-20 rounded" />
                  <span>Loading rate...</span>
                </div>
              ) : exchangeRate ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    <span>
                      1 {baseCurrency} = {exchangeRate.toFixed(4)} {value}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Live rate
                  </Badge>
                </motion.div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No rate available
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
