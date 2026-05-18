import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Forzamos el scroll al inicio de la página de forma instantánea
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
