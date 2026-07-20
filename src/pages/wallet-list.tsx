"use client";
import * as React from "react";
import { apiFetch, apiWrite } from "@neton/application-front-runtime/client";
import { useMutation, usePermission, useQuery, useQueryClient } from "@neton/application-front-runtime/client-context";
import type { PageResponse } from "@neton/application-front-runtime/types";
import { formatDateTime } from "@neton/application-front-runtime/types";
import { Button, DataTable, Drawer, Field, FilterPanel, Input, PageHeader, Pagination, RowActions, type DataColumn } from "@neton/application-front-kit";

interface Wallet { id:number; userId:number; balance:number; freezePrice:number; totalRecharge:number; totalExpense:number; createdAt:number; updatedAt:number }
interface Tx { id:number; walletId:number; bizType:number; bizId:number; title:string; price:number; balance:number; createdAt:number }
interface Overview { walletCount:number; totalBalance:number; totalFrozen:number; totalAvailable:number; totalRecharge:number; totalExpense:number; withdrawPendingCount:number; withdrawPendingAmount:number; withdrawApprovedCount:number; withdrawApprovedAmount:number; withdrawPaidCount:number; withdrawPaidAmount:number }
const money=(value:number)=>"¥"+(value/100).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Page(){
 const client=useQueryClient(); const canUpdate=usePermission("pay:wallet:update"); const canOverview=usePermission("pay:wallet:overview"); const canTx=usePermission("pay:wallet-transaction:page");
 const [page,setPage]=React.useState(1); const [pageSize,setPageSize]=React.useState(20); const [draft,setDraft]=React.useState(""); const [userId,setUserId]=React.useState("");
 const [selected,setSelected]=React.useState<Wallet|null>(null); const [mode,setMode]=React.useState<"recharge"|"balance"|null>(null); const [amount,setAmount]=React.useState(0); const [remark,setRemark]=React.useState(""); const [error,setError]=React.useState<string|null>(null);
 const params=new URLSearchParams({pageNo:String(page),pageSize:String(pageSize)}); if(userId)params.set("userId",userId);
 const wallets=useQuery({queryKey:["pay-wallet",page,pageSize,userId],queryFn:()=>apiFetch<PageResponse<Wallet>>("/admin/pay/wallet/page?"+params)});
 const overview=useQuery({queryKey:["pay-wallet-overview"],queryFn:()=>apiFetch<Overview>("/admin/pay/wallet/overview"),enabled:canOverview});
 const tx=useQuery({queryKey:["pay-wallet-tx",selected?.id],queryFn:()=>apiFetch<PageResponse<Tx>>("/admin/pay/wallet-transaction/page-by-wallet?pageNo=1&pageSize=50&walletId="+selected?.id),enabled:Boolean(selected&&canTx)});
 const mutate=useMutation({mutationFn:()=>{if(!selected||!mode)throw new Error("请选择钱包"); return mode==="recharge"?apiWrite<void>("/admin/pay/wallet/manual-recharge","POST",{userId:selected.userId,amount,remark:remark.trim()}):apiWrite<void>("/admin/pay/wallet/update-balance","PUT",{userId:selected.userId,balance:amount})},onSuccess:async()=>{setMode(null);setAmount(0);setRemark("");await client.invalidateQueries({queryKey:["pay-wallet"]});await client.invalidateQueries({queryKey:["pay-wallet-overview"]})},onError:(cause:Error)=>setError(cause.message)});
 const columns:DataColumn<Wallet>[]=[
  {key:"user",header:"用户 / 钱包",cell:r=><div><strong className="block text-[var(--foreground)]">用户 {r.userId}</strong><code className="text-[10px] text-[var(--muted-foreground)]">Wallet #{r.id}</code></div>},
  {key:"balance",header:"余额",cell:r=><span className="font-semibold tabular-nums">{money(r.balance)}</span>},
  {key:"available",header:"可用余额",cell:r=>money(r.balance-r.freezePrice)},
  {key:"freeze",header:"冻结",cell:r=>money(r.freezePrice)},
  {key:"recharge",header:"累计充值",cell:r=>money(r.totalRecharge)},
  {key:"expense",header:"累计支出",cell:r=>money(r.totalExpense)},
  {key:"updated",header:"更新时间",cell:r=>formatDateTime(r.updatedAt)},
  {key:"actions",header:"操作",headerClassName:"text-right",className:"text-right",cell:r=><RowActions primary={[{label:"详情流水",tone:"primary",onClick:()=>setSelected(r)},...(canUpdate?[{label:"手工充值",tone:"positive" as const,onClick:()=>{setSelected(r);setMode("recharge");setAmount(0);setRemark("");setError(null)}}]:[])]} more={canUpdate?[{label:"余额校正",onClick:()=>{setSelected(r);setMode("balance");setAmount(r.balance);setError(null)}}]:[]}/>}
 ];
 return <div className="space-y-4">
  <PageHeader eyebrow="FINANCE CONTROL" title="钱包管理" description="统一查看资金聚合、钱包余额和可审计流水；资金修改必须填写业务依据。" actions={<Button variant="outline" onClick={()=>wallets.refetch()}>刷新</Button>}/>
  {overview.data&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["钱包数量",String(overview.data.walletCount)],["可用资金",money(overview.data.totalAvailable)],["冻结资金",money(overview.data.totalFrozen)],["待审提现",overview.data.withdrawPendingCount+" 笔 · "+money(overview.data.withdrawPendingAmount)]].map(([label,value])=><div key={label} className="front-surface rounded-xl px-4 py-3"><div className="text-[11px] text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div></div>)}</div>}
  <FilterPanel onSubmit={e=>{e.preventDefault();setPage(1);setUserId(draft.trim())}}><div className="flex items-end gap-3"><div className="max-w-sm flex-1"><Field label="用户 ID"><Input value={draft} onChange={e=>setDraft(e.target.value.replace(/\D/g,""))} placeholder="输入用户 ID"/></Field></div><Button type="button" variant="ghost" onClick={()=>{setDraft("");setUserId("");setPage(1)}}>重置</Button><Button type="submit">查询</Button></div></FilterPanel>
  <section className="front-surface overflow-hidden rounded-2xl"><DataTable columns={columns} rows={wallets.data?.list??[]} rowKey={r=>r.id} loading={wallets.isPending} error={wallets.error?.message} minWidth={1100}/><Pagination page={page} pageSize={pageSize} total={wallets.data?.total??0} loading={wallets.isFetching} onPageChange={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/></section>
  <Drawer open={Boolean(selected&&!mode)} onClose={()=>setSelected(null)} title="钱包详情与流水" description={selected?"用户 "+selected.userId+" · Wallet #"+selected.id:undefined} widthClassName="max-w-3xl">{selected&&<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[["余额",money(selected.balance)],["冻结",money(selected.freezePrice)],["累计充值",money(selected.totalRecharge)],["累计支出",money(selected.totalExpense)]].map(([l,v])=><div key={l} className="rounded-xl border border-[var(--border)] p-3"><div className="text-[11px] text-[var(--muted-foreground)]">{l}</div><div className="mt-1 font-semibold">{v}</div></div>)}</div><DataTable columns={[{key:"title",header:"流水标题",cell:(r:Tx)=>r.title},{key:"biz",header:"业务",cell:(r:Tx)=><code>{r.bizType}/{r.bizId}</code>},{key:"price",header:"变动",cell:(r:Tx)=><span className={r.price>=0?"text-emerald-600":"text-red-600"}>{money(r.price)}</span>},{key:"balance",header:"变动后",cell:(r:Tx)=>money(r.balance)},{key:"time",header:"时间",cell:(r:Tx)=>formatDateTime(r.createdAt)}]} rows={tx.data?.list??[]} rowKey={(r:Tx)=>r.id} loading={tx.isPending} error={tx.error?.message} minWidth={680}/></div>}</Drawer>
  <Drawer open={Boolean(selected&&mode)} onClose={()=>setMode(null)} title={mode==="recharge"?"手工充值":"余额校正"} description={selected?"用户 "+selected.userId:undefined} footer={<><Button variant="ghost" onClick={()=>setMode(null)}>取消</Button><Button variant={mode==="recharge"?"default":"destructive"} disabled={mutate.isPending||!selected||amount<0||(mode==="recharge"&&(!remark.trim()||amount<=0))} onClick={()=>mutate.mutate()}>{mutate.isPending?"处理中…":"确认提交"}</Button></>}>{error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}<div className="space-y-4"><Field label={mode==="recharge"?"充值金额（分）":"目标余额（分）"}><Input type="number" min={0} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field>{mode==="recharge"&&<Field label="充值备注（必填）"><Input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="银行汇款、异常补单等业务依据"/></Field>}</div></Drawer>
 </div>
}
