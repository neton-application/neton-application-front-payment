"use client";
import * as React from "react";
import { ResourcePage } from "@neton/application-front-resource";
import { useT } from "@neton/application-front-runtime/i18n";

/**
 * 支付渠道。
 *
 * 这一页原先挂在 `/pay/app/:id/channels`，表单第一项是必填的「应用 ID」—— 但 `pay_channels`
 * 表根本没有 app_id 列，`pay_apps` 表也不存在。带上 appId 提交会被后端的严格 body 解码判成
 * Validation failed（实测 400），也就是说这一页从来就建不出渠道。
 * 后端模型是扁平的（code 业务唯一），所以这里也改成扁平页，字段与 PayChannel 逐个对齐。
 */
export default function Page() {
  const t = useT("payment");
  const status = [{ label: t("common.status.enabled"), value: 1 }, { label: t("common.status.disabled"), value: 0 }];
  const displayModes = [
    { label: t("channel.displayMode.redirect"), value: "REDIRECT_URL" },
    { label: t("channel.displayMode.qrCode"), value: "QR_CODE" },
    { label: t("channel.displayMode.sdkParams"), value: "SDK_PARAMS" },
  ];
  return <ResourcePage config={{
    resourceKey: "pay-channel",
    errorNamespace: "payment",
    eyebrow: t("channel.eyebrow"),
    title: t("channel.title"),
    description: t("channel.description"),
    endpoint: "/pay/channel",
    permissions: { page: "pay:channel:query", create: "pay:channel:create", update: "pay:channel:update", delete: "pay:channel:delete" },
    detailFields: [
      { key: "id", label: t("channel.field.id"), format: "mono" },
      { key: "code", label: t("common.field.channelCode"), format: "mono" },
      { key: "platformCode", label: t("channel.field.platformCode"), format: "mono" },
      { key: "method", label: t("channel.field.method"), format: "mono" },
      { key: "displayMode", label: t("channel.field.displayMode") },
      { key: "platformChannelId", label: t("channel.field.platformChannelId"), format: "mono" },
      { key: "feeRate", label: t("channel.field.feeRate") },
      { key: "status", label: t("common.field.status"), format: "status" },
      { key: "remark", label: t("common.field.remark") },
      { key: "createdAt", label: t("common.field.createdAt"), format: "date" },
    ],
    fields: [
      { key: "code", label: t("common.field.channelCode"), required: true, format: "mono", placeholder: t("channel.placeholder.code") },
      { key: "platformCode", label: t("channel.field.platformCode"), required: true, format: "mono", placeholder: t("channel.placeholder.platformCode") },
      { key: "method", label: t("channel.field.method"), required: true, format: "mono", placeholder: t("channel.placeholder.method") },
      { key: "displayMode", label: t("channel.field.displayMode"), type: "select", defaultValue: "REDIRECT_URL", options: displayModes, table: false },
      { key: "platformChannelId", label: t("channel.field.platformChannelId"), table: false, placeholder: t("channel.placeholder.platformChannelId") },
      { key: "config", label: t("channel.field.config"), type: "textarea", required: true, table: false, placeholder: '{"appId":"...","privateKey":"..."}' },
      { key: "feeRate", label: t("channel.field.feeRate"), type: "number", defaultValue: 0 },
      { key: "status", label: t("common.field.status"), type: "select", defaultValue: 1, format: "status", options: status },
      { key: "remark", label: t("common.field.remark"), type: "textarea", table: false },
      { key: "createdAt", label: t("common.field.createdAt"), format: "date" },
      { key: "code", label: t("common.field.channelCode"), filter: true, table: false },
      { key: "status", label: t("common.field.status"), filter: true, table: false, type: "select", options: status },
    ],
  }} />;
}
