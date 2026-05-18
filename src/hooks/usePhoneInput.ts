import * as React from "react";

export const COUNTRY_FLAGS: Record<string, string> = {
  CO: "🇨🇴",
  US: "🇺🇸",
  MX: "🇲🇽",
  ES: "🇪🇸",
  AR: "🇦🇷",
  CL: "🇨🇱",
  PE: "🇵🇪",
  EC: "🇪🇨",
  VE: "🇻🇪",
  BR: "🇧🇷",
  PA: "🇵🇦",
};

export interface Country {
  id: string;
  name: string;
  iso2_code: string;
  phone_code: string;
  flag?: string;
}

export const DEFAULT_COUNTRIES: Country[] = [
  { id: "1", name: "Colombia", iso2_code: "CO", phone_code: "57" },
  { id: "2", name: "Estados Unidos", iso2_code: "US", phone_code: "1" },
  { id: "3", name: "México", iso2_code: "MX", phone_code: "52" },
  { id: "4", name: "España", iso2_code: "ES", phone_code: "34" },
  { id: "5", name: "Argentina", iso2_code: "AR", phone_code: "54" },
  { id: "6", name: "Chile", iso2_code: "CL", phone_code: "56" },
  { id: "7", name: "Perú", iso2_code: "PE", phone_code: "51" },
  { id: "8", name: "Ecuador", iso2_code: "EC", phone_code: "593" },
  { id: "9", name: "Venezuela", iso2_code: "VE", phone_code: "58" },
  { id: "10", name: "Panamá", iso2_code: "PA", phone_code: "507" },
];

interface UsePhoneInputProps {
  countries: Country[];
  onPhoneChange: (fullPhone: string) => void;
  initialValue?: string;
}

export function usePhoneInput({ countries, onPhoneChange, initialValue = "" }: UsePhoneInputProps) {
  // Parse initial value if exists (e.g., "+573001234567")
  const parseInitial = () => {
    if (!initialValue.startsWith("+")) return { country: countries[0], body: "" };
    
    // Try to find matching country code
    for (const country of countries) {
      const prefix = `+${country.phone_code}`;
      if (initialValue.startsWith(prefix)) {
        return {
          country,
          body: initialValue.slice(prefix.length).replace(/\D/g, "").slice(0, 10)
        };
      }
    }
    return { country: countries[0], body: "" };
  };

  const initial = parseInitial();
  
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(initial.country || countries[0]);
  const [phoneNumberBody, setPhoneNumberBody] = React.useState(initial.body);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = React.useState(false);
  const phoneDropdownRef = React.useRef<HTMLDivElement>(null);

  const handlePhoneBodyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumberBody(value);
    onPhoneChange(`+${selectedCountry.phone_code}${value}`);
  };

  const handlePhoneCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsPhoneDropdownOpen(false);
    onPhoneChange(`+${country.phone_code}${phoneNumberBody}`);
  };

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(event.target as Node)) {
        setIsPhoneDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    selectedCountryCode: {
      flag: selectedCountry.flag || COUNTRY_FLAGS[selectedCountry.iso2_code] || "🏳️",
      code: `+${selectedCountry.phone_code}`
    },
    phoneNumberBody,
    isPhoneDropdownOpen,
    setIsPhoneDropdownOpen,
    phoneDropdownRef,
    handlePhoneBodyChange,
    handlePhoneCountrySelect
  };
}
