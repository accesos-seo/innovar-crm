import * as React from "react";
import { usePhoneInput, COUNTRY_FLAGS, type Country } from "@/hooks/usePhoneInput";
import { AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppFieldProps {
  countries: Country[];
  onChange: (fullPhone: string) => void;
  initialValue?: string;
  label?: string;
}

export function WhatsAppField({ countries, onChange, initialValue, label = "WhatsApp (Móvil) *" }: WhatsAppFieldProps) {
  const {
    selectedCountryCode,
    phoneNumberBody,
    isPhoneDropdownOpen,
    setIsPhoneDropdownOpen,
    phoneDropdownRef,
    handlePhoneBodyChange,
    handlePhoneCountrySelect
  } = usePhoneInput({
    countries,
    onPhoneChange: (full) => onChange(full),
    initialValue
  });

  const isComplete = phoneNumberBody.length === 10;
  const hasError = phoneNumberBody.length > 0 && !isComplete;

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-primary uppercase tracking-widest flex justify-between items-center">
        {label}
        <span className={cn(
          "text-[9px] font-mono font-bold", 
          isComplete ? "text-primary" : "text-muted-foreground"
        )}>
          {phoneNumberBody.length}/10
        </span>
      </label>

      <div className="flex gap-2 relative" ref={phoneDropdownRef}>
        {/* Selector de País */}
        <button
          type="button"
          onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
          className="flex items-center gap-1.5 px-3 bg-background border border-border/40 rounded-sm hover:border-primary/40 transition-colors h-14"
        >
          <span className="text-xl">{selectedCountryCode.flag}</span>
          <span className="text-xs font-mono font-bold text-muted-foreground">{selectedCountryCode.code}</span>
        </button>

        {/* Dropdown de Países */}
        {isPhoneDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-[#1C1B1B] border border-border/20 rounded-sm shadow-2xl z-[100] max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
            {countries.map((country) => (
              <button
                key={country.id}
                onClick={() => handlePhoneCountrySelect(country)}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-primary/10 text-xs text-left transition-colors border-b border-border/5"
              >
                <span className="text-lg">{country.flag || COUNTRY_FLAGS[country.iso2_code]}</span>
                <span className="flex-1 text-foreground font-medium">{country.name}</span>
                <span className="text-[9px] text-primary font-mono font-bold">+{country.phone_code}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Numérico */}
        <div className="relative flex-1">
          <input
            type="text"
            value={phoneNumberBody}
            onChange={handlePhoneBodyChange}
            placeholder="300 123 4567"
            maxLength={10}
            className={cn(
              "w-full bg-background border px-4 h-14 rounded-sm text-base font-bold transition-all focus:outline-none placeholder:text-muted-foreground placeholder:font-normal",
              isComplete ? "border-primary text-foreground shadow-[0_0_15px_rgba(68,221,193,0.1)]" : "border-border/40 text-foreground",
              hasError && "border-red-500/50 bg-red-500/5 focus:border-red-500 transition-colors"
            )}
          />
          <Zap className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-all duration-500",
            isComplete ? "text-primary fill-primary scale-110 drop-shadow-[0_0_8px_rgba(68,221,193,0.5)]" : "text-muted-foreground/20"
          )} />
        </div>
      </div>

      {/* Error Feedback */}
      {hasError && (
        <span className="text-[10px] text-red-500/80 font-bold uppercase tracking-widest flex items-center gap-1 animate-pulse">
          <AlertCircle className="w-3 h-3" /> Formato incompleto (Requerido: 10 dígitos)
        </span>
      )}
    </div>
  );
}
