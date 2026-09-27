import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Sınıfları birleştirir; çakışan Tailwind sınıflarında sonraki kazanır
 *  (shadcn/ui deseni). components/ui bileşenleri className'i bununla alır. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
