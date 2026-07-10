import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { CurrencySelectorButton } from "./CurrencySelectorButton";
import { useCurrencyConverter, useExchangeRates, useHistoricalRates } from "./useExchangeRates";
import { type Currency } from "./CurrencyService";

/**
 * Exchange Rate Demo Component
 * 
 * Demonstrates the exchange rate API integration with:
 * - Real-time currency conversion
 * - Currency selector with micro-interactions
 * - Exchange rate updates
 * - Historical rate display
 */
export function ExchangeRateDemo() {
  const [fromCurrency, setFromCurrency] = useState<Currency | null>(null);
  const [toCurrency, setToCurrency] = useState<Currency | null>(null);
  const [amount, setAmount] = useState<string>("1000");
  
  const { updateRates, isUpdating } = useExchangeRates();
  const converter = useCurrencyConverter();

  // Historical rates for the last 7 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const { data: historicalRates } = useHistoricalRates(
    fromCurrency?.code || "PKR",
    toCurrency?.code || "USD",
    startDate,
    new Date()
  );

  const handleConvert = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && fromCurrency && toCurrency) {
      converter.setAmount(numAmount);
      converter.setFromCurrency(fromCurrency.code);
      converter.setToCurrency(toCurrency.code);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </motion.div>
                  Exchange rate integration
                </CardTitle>
                <CardDescription>
                  Real-time currency conversion with automatic daily updates
                </CardDescription>
              </div>
              <CurrencySelectorButton showRefresh />
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Currency Converter */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Currency converter</CardTitle>
            <CardDescription>
              Convert between currencies using live exchange rates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From Currency */}
            <div className="space-y-2">
              <Label>From</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    // Trigger currency selector
                  }}
                  className="min-w-[120px]"
                >
                  {fromCurrency ? (
                    <span className="flex items-center gap-2">
                      <span className="font-bold">{fromCurrency.symbol}</span>
                      {fromCurrency.code}
                    </span>
                  ) : (
                    "Select currency"
                  )}
                </Button>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <motion.div
                whileHover={{ scale: 1.2, rotate: 90 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
              </motion.div>
            </div>

            {/* To Currency */}
            <div className="space-y-2">
              <Label>To</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={converter.convertedAmount.toFixed(2)}
                  readOnly
                  className="flex-1 bg-muted"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    // Trigger currency selector
                  }}
                  className="min-w-[120px]"
                >
                  {toCurrency ? (
                    <span className="flex items-center gap-2">
                      <span className="font-bold">{toCurrency.symbol}</span>
                      {toCurrency.code}
                    </span>
                  ) : (
                    "Select currency"
                  )}
                </Button>
              </div>
            </div>

            {/* Convert Button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleConvert}
                className="w-full"
                disabled={!fromCurrency || !toCurrency || !amount}
              >
                Convert
              </Button>
            </motion.div>

            {/* Exchange Rate Display */}
            {converter.rate && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-accent rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Exchange rate</span>
                  <Badge variant="secondary">
                    1 {converter.fromCurrency} = {converter.rate.toFixed(6)}{" "}
                    {converter.toCurrency}
                  </Badge>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Historical Rates */}
      {historicalRates && historicalRates.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Historical rates (Last 7 days)
              </CardTitle>
              <CardDescription>
                {fromCurrency?.code || "PKR"} to {toCurrency?.code || "USD"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historicalRates.map((rate, index) => (
                  <motion.div
                    key={rate.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {new Date(rate.rate_date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{rate.rate.toFixed(6)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {rate.source}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Update Rates */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Exchange rate management</CardTitle>
            <CardDescription>
              Manually trigger exchange rate updates from external APIs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => updateRates()}
                disabled={isUpdating}
                className="w-full"
                variant="outline"
              >
                <motion.div
                  animate={{ rotate: isUpdating ? 360 : 0 }}
                  transition={{
                    duration: 1,
                    repeat: isUpdating ? Infinity : 0,
                    ease: "linear",
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                </motion.div>
                {isUpdating ? "Updating rates..." : "Update exchange rates"}
              </Button>
            </motion.div>

            <Separator className="my-4" />

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Rates are fetched from multiple providers with automatic fallback</p>
              <p>• Primary: ExchangeRate-API (1,500 requests/month)</p>
              <p>• Fallback: Frankfurter API (Free, unlimited)</p>
              <p>• Rates are stored with historical tracking</p>
              <p>• Automatic daily updates via Supabase Edge Function</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
