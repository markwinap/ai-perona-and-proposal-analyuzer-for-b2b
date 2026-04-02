import "~/styles/globals.css";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { Space_Grotesk } from "next/font/google";

import { auth } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";
import { AuthSessionProvider } from "./auth-session-provider";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Persona Intelligence Portal",
  description:
    "Analyze personas, companies, and proposal outcomes to generate targeted business communications.",
  icons: [
    { rel: "icon", type: "image/svg+xml", url: "/favicon.svg" },
    { rel: "shortcut icon", url: "/favicon.ico" },
  ],
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=%2F");
  }

  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <AntdRegistry>
          <AuthSessionProvider>
            <ThemeProvider>
              <TRPCReactProvider>{children}</TRPCReactProvider>
            </ThemeProvider>
          </AuthSessionProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
