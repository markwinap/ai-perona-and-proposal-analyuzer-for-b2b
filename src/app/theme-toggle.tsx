"use client";

import { Button } from "antd";
import { BgColorsOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      type="text"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      icon={theme === "light" ? <MoonOutlined /> : <SunOutlined />}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    />
  );
}
