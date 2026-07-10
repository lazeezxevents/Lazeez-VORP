import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencySelector } from "./CurrencySelector";
import { MultiCurrencyManager } from "@/services/MultiCurrencyManager";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  label?: string;
  value: number;
  currency: string;
  onValueChange: (value: number) => void;
  onCurrencyChange: (currency: string) => void;
  showConversion?: boolean;
  baseCurrency?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function CurrencyInput({
  label,
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  showConversion = true,
  baseCurrency = "PKR",
  disabled = false,
  required = false,
  className,
}: CurrencyInputProps) {
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  const showConversionInfo = showConversion && currency !== baseCurrency && value > 0;

  // Update converted amount when value or currency changes
  useEffect(() => {
    if (showConversionInfo) {
      setConverting(true);
      MultiCurrencyManager.convertToBaseCurrency(value, currency)
        .then((result) => setConvertedAmount(result.converted_amount))
        .catch(() => setConvertedAmount(null))
        .finally(() => setConverting(false));
    } else {
      setConvertedAmount(null);
    }
  }, [value, currency, baseCurrency, showConversionInfo]);

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Parse and validate number
    const parsed = parseFloat(newValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onValueChange(parsed);
    } else if (newValue === "" || newValue === "0") {
      onValueChange(0);
    }
  };

  const handleInputBlur = () => {
    // Format on blur
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      setInputValue(parsed.toFixed(2));
    } else {
      setInputValue("0.00");
      onValueChange(0);
    }
  };

  const currencyInfo = MultiCurrencyManager.getCurrencyInfo(currency);
  const baseCurrencyInfo = MultiCurrencyManager.getCurrencyInfo(baseCurrency);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="flex gap-2">
        {/* Amount Input */}
        <motion.div
          className="flex-1 relative"
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.15 }}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              {currencyInfo?.symbol || currency}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              disabled={disabled}
              required={required}
              className="pl-12 pr-4 font-mono text-base"
              placeholder="0.00"
            />
          </div>
        </motion.div>

        {/* Currency Selector */}
        <CurrencySelector
          value={currency}
          onChange={onCurrencyChange}
          disabled={disabled}
          showRate={showConversion}
          baseCurrency={baseCurrency}
          className="w-[140px]"
        />
      </div>

      {/* Conversion Display */}
      <AnimatePresence>
        {showConversionInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50"
              whileHover={{ backgroundColor: "hsl(var(--muted))" }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                animate={{ rotate: [0, 180, 360] }}
                transition={{
                  duration: 2,
                  repeat: converting ? Infinity : 0,
                  ease: "linear",
                }}
              >
                {converting ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                )}
              </motion.div>

              <div className="flex-1 text-sm">
                {converting ? (
                  <div className="flex items-center gap-2">
                    <div className="shimmer h-4 w-24 rounded" />
                    <span className="text-muted-foreground">Converting...</span>
                  </div>
                ) : convertedAmount !== null ? (
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="font-medium">
                      {baseCurrencyInfo?.symbol || baseCurrency}{" "}
                      {convertedAmount.toLocaleString("en-PK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      in {baseCurrency}
                    </span>
                  </motion.div>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Conversion unavailable
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
