"use client";

import * as React from "react";
import { Alert, Button, DataTable, Drawer, Field, FilterPanel, Input, PageHeader, Pagination, RowActions, type DataColumn } from "@neton/application-front-kit";
import { apiFetch, apiWrite } from "@neton/application-front-runtime/client";
import { useMutation, usePermission, useQuery, useQueryClient } from "@neton/application-front-runtime/client-context";
import { useDescribeError } from "@neton/application-front-runtime/errors";
import { useT } from "@neton/application-front-runtime/i18n";
import { formatDateTime, type PageResponse } from "@neton/application-front-runtime/types";

interface UserBalance {
  userId: string;
  username: string | null;
  balance: string;
  reservedBalance: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  ref: string | null;
  createdAt: number | null;
  operatorId: string | null;
  remark: string | null;
}

type Move = "manual-credit" | "gift" | "revoke";

const endpoint = "/admin/pay/consumption-balance";
const queryKey = "pay-consumption-balance";
const emptyFilters = { userId: "", username: "" };

function usd(micro: string | bigint): string {
  const value = BigInt(micro);
  const magnitude = value < 0n ? -value : value;
  const whole = (magnitude / 1_000_000n).toLocaleString("en-US");
  const fraction = (magnitude % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${value < 0n ? "-" : ""}$${whole}.${fraction}`;
}

function micro(value: string): string | null {
  const match = /^(\d{1,13})(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return null;
  const amount = BigInt(match[1] + (match[2] ?? "").padEnd(6, "0"));
  return amount > 0n && amount <= 9_223_372_036_854_775_807n ? amount.toString() : null;
}

function TransactionDrawer({ user, onClose }: { user: UserBalance; onClose(): void }) {
  const t = useT("payment");
  const describeError = useDescribeError("payment");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const params = new URLSearchParams({ userId: user.userId, pageNo: String(page), pageSize: String(pageSize) });
  const query = useQuery({
    queryKey: [queryKey, "transactions", user.userId, page, pageSize],
    queryFn: () => apiFetch<PageResponse<Transaction>>(`${endpoint}/transaction/page?${params}`),
  });
  const columns: DataColumn<Transaction>[] = [
    { key: "time", header: t("consumption.time"), cell: (row) => formatDateTime(row.createdAt) },
    { key: "type", header: t("consumption.type"), cell: (row) => {
      const key = `consumption.type.${row.type}`;
      const label = t(key);
      return label === key ? row.type : label;
    } },
    { key: "amount", header: t("consumption.change"), cell: (row) => usd(row.amount) },
    { key: "after", header: t("consumption.after"), cell: (row) => usd(row.balanceAfter) },
    { key: "ref", header: t("consumption.ref"), cell: (row) => row.ref ?? "—" },
    { key: "operator", header: t("consumption.operator"), cell: (row) => row.operatorId ?? "—" },
    { key: "remark", header: t("consumption.remark"), cell: (row) => row.remark ?? "—" },
  ];
  return <Drawer open onClose={onClose} title={t("consumption.transactions")} description={t("consumption.user", { userId: user.userId, username: user.username ?? "—" })} widthClassName="max-w-5xl">
    <DataTable columns={columns} rows={query.data?.list ?? []} rowKey={(row) => row.id}
      loading={query.isPending} error={query.error ? describeError(query.error) : null} />
    <Pagination page={page} pageSize={pageSize} total={query.data?.total ?? 0} loading={query.isFetching}
      onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
  </Drawer>;
}

function MoveDrawer({ user, move, onClose, onSaved }: { user: UserBalance; move: Move; onClose(): void; onSaved(): void }) {
  const t = useT("payment");
  const describeError = useDescribeError("payment");
  const [amount, setAmount] = React.useState("");
  const [ref, setRef] = React.useState<string>(() => crypto.randomUUID());
  const [remark, setRemark] = React.useState("");
  const value = micro(amount);
  const mutation = useMutation({
    mutationFn: (body: { userId: string; amount: string; ref: string; remark: string }) =>
      apiWrite<void>(`${endpoint}/${move}`, "POST", body),
    onSuccess: onSaved,
  });
  return <Drawer open onClose={() => { if (!mutation.isPending) onClose(); }} title={t(`consumption.action.${move}`)}
    description={t("consumption.user", { userId: user.userId, username: user.username ?? "—" })}
    footer={<>
      <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>{t("common.action.cancel")}</Button>
      <Button disabled={!value || !ref.trim() || !remark.trim() || mutation.isPending} onClick={() => {
        if (value) mutation.mutate({ userId: user.userId, amount: value, ref: ref.trim(), remark: remark.trim() });
      }}>{t("common.action.confirmSubmit")}</Button>
    </>}>
    <div className="space-y-4">
      {mutation.error && <Alert tone="error">{describeError(mutation.error)}</Alert>}
      {move === "revoke" && <Alert tone="warning">{t("consumption.revokeWarning")}</Alert>}
      <Field label={t("consumption.amount")} error={amount && !value ? t("consumption.invalidAmount") : undefined}>
        <Input inputMode="decimal" value={amount} disabled={mutation.isPending} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label={t("consumption.ref")}>
        <Input maxLength={122} value={ref} disabled={mutation.isPending} onChange={(event) => setRef(event.target.value)} />
      </Field>
      <Field label={t("consumption.remark")}>
        <Input maxLength={500} value={remark} disabled={mutation.isPending} onChange={(event) => setRemark(event.target.value)} />
      </Field>
    </div>
  </Drawer>;
}

export default function Page() {
  const t = useT("payment");
  const describeError = useDescribeError("payment");
  const client = useQueryClient();
  const canRead = usePermission("pay:consumption-balance:query");
  const canCredit = usePermission("pay:consumption-balance:credit");
  const canGift = usePermission("pay:consumption-balance:gift");
  const canRevoke = usePermission("pay:consumption-balance:revoke");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [draft, setDraft] = React.useState(emptyFilters);
  const [filters, setFilters] = React.useState(emptyFilters);
  const [selected, setSelected] = React.useState<{ user: UserBalance; mode: Move | "transactions" } | null>(null);
  const [saved, setSaved] = React.useState(false);
  const params = new URLSearchParams({ pageNo: String(page), pageSize: String(pageSize), ...filters });
  const query = useQuery({
    queryKey: [queryKey, "users", page, pageSize, filters],
    queryFn: () => apiFetch<PageResponse<UserBalance>>(`${endpoint}/page?${params}`),
    enabled: canRead,
  });

  function select(user: UserBalance, mode: Move | "transactions") {
    setSaved(false);
    setSelected({ user, mode });
  }

  const columns: DataColumn<UserBalance>[] = [
    { key: "id", header: t("consumption.userId"), cell: (row) => row.userId },
    { key: "username", header: t("consumption.username"), cell: (row) => row.username ?? "—" },
    { key: "balance", header: t("consumption.total"), cell: (row) => usd(row.balance) },
    { key: "reserved", header: t("consumption.reserved"), cell: (row) => usd(row.reservedBalance) },
    { key: "available", header: t("consumption.available"), cell: (row) => usd(BigInt(row.balance) - BigInt(row.reservedBalance)) },
    { key: "actions", header: t("common.field.actions"), cell: (row) => <RowActions
      primary={[
        { label: t("consumption.transactions"), kind: "view", onClick: () => select(row, "transactions") },
        ...(canCredit ? [{ label: t("consumption.action.manual-credit"), kind: "create" as const, onClick: () => select(row, "manual-credit") }] : []),
        ...(canGift ? [{ label: t("consumption.action.gift"), kind: "create" as const, onClick: () => select(row, "gift") }] : []),
      ]}
      more={canRevoke ? [{ label: t("consumption.action.revoke"), kind: "edit", danger: true, onClick: () => select(row, "revoke") }] : []}
    /> },
  ];

  if (!canRead) return <Alert tone="error">{t("consumption.forbidden")}</Alert>;
  return <div className="space-y-4">
    <PageHeader eyebrow={t("consumption.eyebrow")} title={t("consumption.title")} description={t("consumption.description")} />
    <FilterPanel onSubmit={(event) => { event.preventDefault(); setFilters(draft); setPage(1); }}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><Field label={t("consumption.userId")}>
          <Input inputMode="numeric" value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })} />
        </Field></div>
        <div className="min-w-48 flex-1"><Field label={t("consumption.username")}>
          <Input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
        </Field></div>
        <Button type="button" variant="ghost" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }}>
          {t("common.action.reset")}
        </Button>
        <Button type="submit">{t("common.action.search")}</Button>
      </div>
    </FilterPanel>
    {saved && <Alert tone="info">{t("consumption.saved")}</Alert>}
    <section className="front-surface overflow-hidden rounded-xl">
      <DataTable columns={columns} rows={query.data?.list ?? []} rowKey={(row) => row.userId}
        loading={query.isPending} error={query.error ? describeError(query.error) : null} />
      <Pagination page={page} pageSize={pageSize} total={query.data?.total ?? 0} loading={query.isFetching}
        onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    {selected?.mode === "transactions" && <TransactionDrawer key={selected.user.userId} user={selected.user} onClose={() => setSelected(null)} />}
    {selected && selected.mode !== "transactions" && <MoveDrawer key={`${selected.user.userId}:${selected.mode}`}
      user={selected.user} move={selected.mode} onClose={() => setSelected(null)} onSaved={() => {
        setSelected(null);
        setSaved(true);
        void client.invalidateQueries({ queryKey: [queryKey] });
      }} />}
  </div>;
}
