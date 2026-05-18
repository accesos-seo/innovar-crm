import * as React from "react";
import { usePhoneInput, COUNTRY_FLAGS, Country, DEFAULT_COUNTRIES } from "@/hooks/usePhoneInput";
import { AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PhoneInputProps {
  countries?: Country[];
  onChange: (fullPhone: string) => void;
  value?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export function PhoneInput({ 
  countries = DEFAULT_COUNTRIES, 
  onChange, 
  value = "", 
  label = "WhatsApp (Móvil)", 
  required = false,
  className
}: PhoneInputProps) {
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
    onPhoneChange: onChange,
    initialValue: value
  });

  const isComplete = phoneNumberBody.length === 10;
  const hasError = phoneNumberBody.length > 0 && !isComplete;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-xs font-medium flex justify-between items-center text-muted-foreground uppercase tracking-wider">
        <span>
          {label} {required && <span className="text-destructive">*</span>}
        </span>
        <span className={cn(
          "text-[9px] font-mono px-1.5 py-0.5 rounded-sm border transition-colors", 
          isComplete 
            ? "text-primary border-primary/30 bg-primary/5" 
            : "text-zinc-600 border-zinc-800 bg-zinc-900/50"
        )}>
          {phoneNumberBody.length}/10
        </span>
      </label>

      <div className="flex gap-2 relative" ref={phoneDropdownRef}>
        {/* Selector de País */}
        <button
          type="button"
          onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
          className="flex items-center gap-2 px-3 bg-background border border-border/50 rounded-sm hover:border-primary/50 transition-all duration-200 group h-10"
        >
          <span className="text-lg group-hover:scale-110 transition-transform">{selectedCountryCode.flag}</span>
          <span className="text-xs font-bold font-mono text-muted-foreground group-hover:text-primary">{selectedCountryCode.code}</span>
        </button>

        {/* Dropdown de Países */}
        {isPhoneDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border/20 rounded-sm shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-border/10 bg-muted/30">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Seleccionar País</p>
            </div>
            {countries.map((country) => (
              <button
                key={country.id}
                type="button"
                onClick={() => handlePhoneCountrySelect(country)}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-primary/5 text-xs text-left transition-colors border-b border-border/5 last:border-0"
              >
                <span className="text-base">{country.flag || COUNTRY_FLAGS[country.iso2_code]}</span>
                <span className="flex-1 font-medium text-foreground">{country.name}</span>
                <span className="text-[10px] text-primary font-bold font-mono">+{country.phone_code}</span>
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
              "w-full bg-background border px-4 py-2 rounded-sm text-sm transition-all duration-300 focus:outline-none h-10 font-mono tracking-wider",
              isComplete 
                ? "border-primary/50 text-foreground shadow-[0_0_15px_rgba(68,221,193,0.1)]" 
                : "border-border/50 text-muted-foreground focus:border-primary/30",
              hasError && "border-destructive/50 focus:border-destructive"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            <Zap className={cn(
              "w-4 h-4 transition-all duration-500",
              isComplete ? "text-primary fill-primary drop-shadow-[0_0_8px_rgba(68,221,193,0.5)] scale-110" : "text-muted-foreground/20"
            )} />
          </div>
        </div>
      </div>

      {/* Error Feedback */}
      {hasError && (
        <motion.span 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-destructive font-bold uppercase tracking-tighter flex items-center gap-1.5 mt-1"
        >
          <AlertCircle className="w-3.5 h-3.5" /> 
          Formato incompleto. Se requieren 10 dígitos.
        </motion.span>
      )}
    </div>
  );
}
