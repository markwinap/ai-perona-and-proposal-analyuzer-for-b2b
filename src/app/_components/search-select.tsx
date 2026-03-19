import type { ComponentProps } from "react";

import { Select } from "antd";

type SearchSelectProps = ComponentProps<typeof Select>;

export function SearchSelect({ showSearch, optionFilterProp, ...rest }: SearchSelectProps) {
    return <Select showSearch={showSearch ?? true} optionFilterProp={optionFilterProp ?? "label"} {...rest} />;
}
