"use client";
import * as React from "react";
import { ResourcePage } from "@neton/application-front-resource";

const status = [{ label: "启用", value: 1 }, { label: "停用", value: 0 }];
const displayModes = [
  { label: "跳转收银台（REDIRECT_URL）", value: "REDIRECT_URL" },
  { label: "二维码（QR_CODE）", value: "QR_CODE" },
  { label: "SDK 参数（SDK_PARAMS）", value: "SDK_PARAMS" },
];

/**
 * 支付渠道。
 *
 * 这一页原先挂在 `/pay/app/:id/channels`，表单第一项是必填的「应用 ID」—— 但 `pay_channels`
 * 表根本没有 app_id 列，`pay_apps` 表也不存在。带上 appId 提交会被后端的严格 body 解码判成
 * Validation failed（实测 400），也就是说这一页从来就建不出渠道。
 * 后端模型是扁平的（code 业务唯一），所以这里也改成扁平页，字段与 PayChannel 逐个对齐。
 */
export default function Page() {
  return <ResourcePage config={{
    resourceKey: "pay-channel",
    eyebrow: "PAYMENT",
    title: "支付渠道",
    description: "收款通道：编码、所属平台、呈现方式与商户凭据。凭据是敏感信息，只在编辑时填写。",
    endpoint: "/pay/channel",
    permissions: { page: "pay:channel:query", create: "pay:channel:create", update: "pay:channel:update", delete: "pay:channel:delete" },
    detailFields: [
      { key: "id", label: "渠道 ID", format: "mono" },
      { key: "code", label: "渠道编码", format: "mono" },
      { key: "platformCode", label: "所属平台", format: "mono" },
      { key: "method", label: "支付方式", format: "mono" },
      { key: "displayMode", label: "呈现方式" },
      { key: "platformChannelId", label: "平台侧通道号", format: "mono" },
      { key: "feeRate", label: "费率(万分比)" },
      { key: "status", label: "状态", format: "status" },
      { key: "remark", label: "说明" },
      { key: "createdAt", label: "创建时间", format: "date" },
    ],
    fields: [
      { key: "code", label: "渠道编码", required: true, format: "mono", placeholder: "业务侧唯一，用户下单时传它，如 alipay_1" },
      { key: "platformCode", label: "所属平台", required: true, format: "mono", placeholder: "alipay / sandbox / 四方平台自定义编码" },
      { key: "method", label: "支付方式", required: true, format: "mono", placeholder: "alipay / wechat / stripe —— 决定用户端的图标与分组" },
      { key: "displayMode", label: "呈现方式", type: "select", defaultValue: "REDIRECT_URL", options: displayModes, table: false },
      { key: "platformChannelId", label: "平台侧通道号", table: false, placeholder: "平台自己的编号，下单时透传；没有就留空" },
      { key: "config", label: "商户凭据(JSON)", type: "textarea", required: true, table: false, placeholder: '{"appId":"...","privateKey":"..."}' },
      { key: "feeRate", label: "费率(万分比)", type: "number", defaultValue: 0 },
      { key: "status", label: "状态", type: "select", defaultValue: 1, format: "status", options: status },
      { key: "remark", label: "说明", type: "textarea", table: false },
      { key: "createdAt", label: "创建时间", format: "date" },
      { key: "code", label: "渠道编码", filter: true, table: false },
      { key: "status", label: "状态", filter: true, table: false, type: "select", options: status },
    ],
  }} />;
}
