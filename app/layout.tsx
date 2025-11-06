import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title:
    "Ökobilanzierung: MAS BFH-AHB Digitales Bauen | Master Wood Technology BIM",
  description: "Ökobilanzierung-Tool für BFH-AHB: Berechnung von CO₂-eq, UBP und nicht erneuerbarer Primärenergie für Bauprojekte. Master Wood Technology BIM | Building Information Modelling.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-gradient-mesh dark:bg-gradient-mesh-dark selection:bg-[#7aa2f7]/20 dark:selection:bg-[#7aa2f7]/30"
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="relative">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
