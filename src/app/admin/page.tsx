import { Space } from "antd";

import { MetricsDashboard } from "~/app/_components/prompts/metrics-dashboard";
import { PromptAdmin } from "~/app/_components/prompts/prompt-admin";

export default function AdminPage() {
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <PromptAdmin />
      <MetricsDashboard />
    </Space>
  );
}
