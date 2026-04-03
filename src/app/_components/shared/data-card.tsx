"use client";

import { Card, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import { TABLE_PAGE_SIZE } from "~/app/_components/shared/persona-portal.constants";

interface DataCardProps<T> {
    title: string;
    dataSource: T[];
    columns: ColumnsType<T>;
    loading?: boolean;
    pageSize?: number;
    rowKey?: string | ((record: T) => string | number);
}

export function DataCard<T extends Record<string, any>>({
    title,
    dataSource,
    columns,
    loading,
    pageSize = TABLE_PAGE_SIZE,
    rowKey = "id",
}: DataCardProps<T>) {
    return (
        <Card title={title} className="data-card">
            <Table<T>
                className="portal-table"
                rowKey={rowKey}
                size="middle"
                pagination={{ pageSize }}
                dataSource={dataSource}
                columns={columns}
                loading={loading}
            />
        </Card>
    );
}
