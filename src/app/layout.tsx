import "~/styles/globals.css";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { type Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

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
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#144a6c",
                colorInfo: "#144a6c",
                colorSuccess: "#18794e",
                colorWarning: "#b7791f",
                colorError: "#c2413b",
                colorTextBase: "#12263a",
                colorBgBase: "#f5f7fb",
                colorBorderSecondary: "#d9e2ec",
                borderRadius: 14,
                fontFamily: spaceGrotesk.style.fontFamily,
                boxShadowSecondary: "0 20px 50px rgba(15, 23, 42, 0.10)",
              },
              components: {
                Button: {
                  controlHeight: 40,
                  fontWeight: 600,
                  defaultShadow: "none",
                  primaryShadow: "0 12px 30px rgba(20, 74, 108, 0.18)",
                },
                Card: {
                  borderRadiusLG: 20,
                  headerFontSize: 18,
                },
                Input: {
                  controlHeight: 42,
                },
                InputNumber: {
                  controlHeight: 42,
                },
                Modal: {
                  borderRadiusLG: 24,
                },
                Select: {
                  controlHeight: 42,
                },
                Table: {
                  headerBg: "#f7fafc",
                  headerColor: "#486581",
                  rowHoverBg: "#f8fbff",
                  borderColor: "#e6edf5",
                },
                Tabs: {
                  itemColor: "#5b7083",
                  itemSelectedColor: "#12263a",
                  itemHoverColor: "#144a6c",
                  inkBarColor: "#144a6c",
                },
              },
            }}
          >
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
