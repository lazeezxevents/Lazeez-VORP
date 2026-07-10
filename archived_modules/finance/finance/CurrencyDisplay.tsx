import { useMemo } from "react";
import { useDefaultCurrency, useUserCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/components/finance/CurrencyService";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currencyCode?: string; // If not provided, uses user preference or default
  showSymbol?: boolean;
  showCode?: boolean;
  precision?: number;
  className?: string;
  useUserPreference?: boolean; // If true, uses user's preferred currency
}

export function CurrencyDisplay({
  amount,
  currencyCode,
  showSymbol = true,
  showCode = false,
  precision = 2,
  className,
  useUserPreference = false,
}: CurrencyDisplayProps) {
  const { data: defaultCurrency, isLoading: defaultLoading } = useDefaultCurrency();
  const { currency: userCurrency, isLoading: userLoading } = useUserCurrency();

  const currency = useMemo(() => {
    if (currencyCode) {
      // If specific currency code provided, we'd need to fetch it
      // For now, use default if code matches, otherwise show code
      return defaultCurrency;
    }
    if (useUserPreference && userCurrency) {
      return userCurrency;
    }
    return defaultCurrency;
  }, [currencyCode, useUserPreference, userCurrency, defaultCurrency]);

  const isLoading = defaultLoading || (useUserPreference && userLoading);

  const formattedValue = useMemo(() => {
    if (!currency) return "";
    return formatCurrency(amount, currency, {
      showSymbol,
      showCode,
      precision,
    });
  }, [amount, currency, showSymbol, showCode, precision]);

  if (isLoading) {
    return <Skeleton className={cn("h-4 w-20 inline-block", className)} />;
  }

  if (!currency) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {amount.toFixed(precision)}
      </span>
    );
  }

  return (
    <span className={cn("font-mono", className)}>
      {formattedValue}
    </span>
  );
}

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currencyCode?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  currencyCode,
  placeholder = "0.00",
  className,
  disabled = false,
}: CurrencyInputProps) {
  const { data: defaultCurrency } = useDefaultCurrency();
  const currency = defaultCurrency; // Could be enhanced to support specific currency

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "");
    const numValue = parseFloat(rawValue) || 0;
    onChange(numValue);
  };

  return (
    <div className="relative">
      {currency && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {currency.symbol}
        </span>
      )}
      <input
        type="text"
        value={value === 0 ? "" : value.toFixed(2)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2 border rounded-md",
          currency && "pl-8",
          "font-mono text-right",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      />
    </div>
  );
}
