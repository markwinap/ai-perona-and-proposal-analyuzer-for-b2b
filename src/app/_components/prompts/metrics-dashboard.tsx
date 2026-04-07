"use client";

import { Alert, Card, Col, Divider, Row, Spin, Statistic, Table, Typography } from "antd";

import { api } from "~/trpc/react";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function MetricsDashboard() {
  const dashboardQuery = api.metrics.getDashboard.useQuery({ limit: 1000 });

  if (dashboardQuery.isLoading) {
    return (
      <Card title="AI Optimization Dashboard">
        <Spin />
      </Card>
    );
  }

  if (dashboardQuery.error) {
    return (
      <Alert
        type="error"
        showIcon
        title="Failed to load metrics dashboard"
        description={dashboardQuery.error.message}
      />
    );
  }

  const data = dashboardQuery.data;
  if (!data) {
    return <Alert type="warning" showIcon title="No metrics available yet." />;
  }

  const cacheRows = data.cache.persisted.map((item) => ({
    key: `${item.service}:${item.inputHash}`,
    service: item.service,
    hash: item.inputHash.slice(0, 12),
    hits: item.hitCount,
    misses: item.missCount,
    lastAccessedAt: item.lastAccessedAt
      ? new Date(item.lastAccessedAt).toLocaleString()
      : "-",
  }));

  const promptVersionRows = data.promptVersions.map((item) => ({
    key: item.id,
    promptId: item.promptId,
    version: item.version,
    active: item.isActive ? "Yes" : "No",
    changeNotes: item.changeNotes ?? "-",
    createdAt: new Date(item.createdAt).toLocaleString(),
  }));

  return (
    <Card title="AI Optimization Dashboard">
      <Typography.Paragraph type="secondary">
        Live summary of cache performance, API reliability, and prompt version history.
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Statistic title="Total Calls" value={data.savings.totalCalls} />
        </Col>
        <Col xs={24} md={8}>
          <Statistic title="Cached Calls" value={data.savings.cachedCalls} />
        </Col>
        <Col xs={24} md={8}>
          <Statistic title="Cache Hit Rate" value={percent(data.savings.hitRate)} />
        </Col>
        <Col xs={24} md={8}>
          <Statistic title="Error Rate" value={percent(data.api.errorRate)} />
        </Col>
        <Col xs={24} md={8}>
          <Statistic
            title="In-Memory Cache Size"
            value={data.cache.inMemory.size}
          />
        </Col>
        <Col xs={24} md={8}>
          <Statistic
            title="Estimated Savings"
            prefix="$"
            value={Number(data.savings.estimatedSavings.toFixed(2))}
          />
        </Col>
      </Row>

      <Divider />
      <Typography.Title level={5}>Cache Hit/Miss Samples</Typography.Title>
      <Table
        size="small"
        pagination={{ pageSize: 8 }}
        dataSource={cacheRows}
        columns={[
          { title: "Service", dataIndex: "service" },
          { title: "Input Hash", dataIndex: "hash" },
          { title: "Hits", dataIndex: "hits" },
          { title: "Misses", dataIndex: "misses" },
          { title: "Last Access", dataIndex: "lastAccessedAt" },
        ]}
      />

      <Divider />
      <Typography.Title level={5}>Prompt Version History</Typography.Title>
      <Table
        size="small"
        pagination={{ pageSize: 8 }}
        dataSource={promptVersionRows}
        columns={[
          { title: "Prompt ID", dataIndex: "promptId" },
          { title: "Version", dataIndex: "version" },
          { title: "Active", dataIndex: "active" },
          { title: "Change Notes", dataIndex: "changeNotes" },
          { title: "Created At", dataIndex: "createdAt" },
        ]}
      />
    </Card>
  );
}
