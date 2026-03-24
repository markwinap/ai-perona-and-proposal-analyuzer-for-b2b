import "~/styles/globals.css";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { type Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Persona Intelligence Portal",
  description:
    "Analyze personas, companies, and proposal outcomes to generate targeted business communications.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <AntdRegistry>
          <ThemeProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
