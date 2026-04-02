"use client";

import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { signIn, signOut, useSession } from "next-auth/react";

export function AuthIconButton() {
  const { status } = useSession();

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const handleClick = () => {
    if (isAuthenticated) {
      void signOut({ callbackUrl: "/" });
      return;
    }

    void signIn("github", { callbackUrl: "/" });
  };

  return (
    <Tooltip title={isAuthenticated ? "Sign out" : "Sign in with GitHub"}>
      <Button
        aria-label={isAuthenticated ? "Sign out" : "Sign in"}
        disabled={isLoading}
        icon={isAuthenticated ? <LogoutOutlined /> : <LoginOutlined />}
        onClick={handleClick}
        shape="circle"
      />
    </Tooltip>
  );
}