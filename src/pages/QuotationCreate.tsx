import * as React from "react";
import { QuotationBuilder } from "@/components/quotations/QuotationBuilder";
import { motion } from "framer-motion";

export default function QuotationCreatePage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <QuotationBuilder />
    </motion.div>
  );
}
