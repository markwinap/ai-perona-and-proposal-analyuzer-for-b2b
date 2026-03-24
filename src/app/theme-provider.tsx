"use client";

import { ConfigProvider } from "antd";
import { useEffect, useState, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
});

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

// Default context value to prevent errors
const defaultThemeContext: ThemeContextType = {
  theme: "light",
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export const useTheme = () => {
  return useContext(ThemeContext);
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const themeConfig = {
    token: {
      colorPrimary: "#1890ff",
      colorInfo: "#1890ff",
      colorSuccess: "#18794e",
      colorWarning: "#b7791f",
      colorError: "#c2413b",
      colorTextBase: theme === "light" ? "#12263a" : "#e6ecf1",
      colorBgBase: theme === "light" ? "#f5f7fb" : "#0f1419",
      colorBorderSecondary: theme === "light" ? "#d9e2ec" : "#434d56",
      borderRadius: 14,
      fontFamily: spaceGrotesk.style.fontFamily,
      boxShadowSecondary: theme === "light" 
        ? "0 20px 50px rgba(15, 23, 42, 0.10)" 
        : "0 20px 50px rgba(0, 0, 0, 0.45)",
    },
    components: {
      Button: {
        controlHeight: 40,
        fontWeight: 600,
        colorTextLightSolid: "#ffffff",
        primaryColor: "#1890ff",
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
        headerBg: theme === "light" ? "#f7fafc" : "#141824",
        headerColor: theme === "light" ? "#486581" : "#b0b8bf",
        rowHoverBg: theme === "light" ? "#f8fbff" : "#141824",
        borderColor: theme === "light" ? "#e6edf5" : "#434d56",
      },
      Tabs: {
        itemColor: theme === "light" ? "#5b7083" : "#8895a1",
        itemSelectedColor: "#1890ff",
        itemHoverColor: "#40a9ff",
        inkBarColor: "#1890ff",
      },
    },
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ConfigProvider theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
