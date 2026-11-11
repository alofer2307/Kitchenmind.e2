import type { Metadata } from "next";
import { PiraDemo } from "./pira-demo";

export const metadata: Metadata = {
  title: "KitchenMind | Demostración PIRA",
  description: "Demostración del tablero de Dirección y el flujo de Calidad en Maxion Wheels.",
  robots: { index: false, follow: false },
};

export default function PiraDemoPage() {
  return <PiraDemo />;
}
