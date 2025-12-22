import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { configApi } from "./api";
import { formatCurrency, formatCurrencySimple, getCurrencyByCode, CURRENCIES, type CurrencyConfig } from "./currency";

interface CurrencyContextValue {
  currencyCode: string;
  currency: CurrencyConfig;
  format: (amountInCents: number) => string;
  formatSimple: (amountInCents: number) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currencyCode: "USD",
  currency: CURRENCIES[0],
  format: (amount) => formatCurrency(amount, "USD"),
  formatSimple: (amount) => formatCurrencySimple(amount, "USD"),
  isLoading: false,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: configApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const currencyConfig = configs?.find(c => c.key === "currency");
  const currencyCode = currencyConfig?.value || "USD";
  const currency = getCurrencyByCode(currencyCode);

  const value: CurrencyContextValue = {
    currencyCode,
    currency,
    format: (amountInCents: number) => formatCurrency(amountInCents, currencyCode),
    formatSimple: (amountInCents: number) => formatCurrencySimple(amountInCents, currencyCode),
    isLoading,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
