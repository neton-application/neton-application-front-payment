"use client";
import * as React from "react";
import { apiFetch, apiWrite } from "@neton/application-front-runtime/client";
import { useMutation, usePermission, useQuery, useQueryClient } from "@neton/application-front-runtime/client-context";
import type { PageResponse } from "@neton/application-front-runtime/types";
import { formatDateTime, formatMoney } from "@neton/application-front-runtime/types";
import { useT } from "@neton/application-front-runtime/i18n";
import { useDescribeError, useDescribeFieldErrors } from "@neton/application-front-runtime/errors";
import { Button, DataTable, Drawer, Field, FilterPanel, Input, PageHeader, Pagination, RowActions, type DataColumn } from "@neton/application-front-kit";

/** accountFrozen：账户冻结没有金额，freezePrice 反映不出来，由后端单独带下来。 */
interface Wallet { id:number; userId:number; balance:number; freezePrice:number; totalRecharge:number; totalExpense:number; createdAt:number; updatedAt:number; accountFrozen?:boolean }
interface Tx { id:number; walletId:number; bizType:number; bizId:number; title:string; price:number; balance:number; createdAt:number }
import type { Freeze } from "../lib/freeze";
import { freezeMoney, freezeStatusText, freezeTypes } from "../lib/freeze";

/** 银行卡对外视图：只有掩码，完整卡号要单独换（见 revealCard）。 */
interface BankCard { id:number; userId:number; holderName:string; bankName:string; bankCode?:string|null; cardNoMasked:string; status:number; createdAt?:number|null }
interface Overview { walletCount:number; totalBalance:number; totalFrozen:number; totalAvailable:number; totalRecharge:number; totalExpense:number; withdrawPendingCount:number; withdrawPendingAmount:number; withdrawApprovedCount:number; withdrawApprovedAmount:number; withdrawPaidCount:number; withdrawPaidAmount:number }
/** 钱包不带币种，金额（分）按部署配置的默认币种展示。 */
const money=(value:number)=>formatMoney(value);

export default function Page(){
 const t=useT("payment"); const describeError=useDescribeError("payment"); const describeFieldErrors=useDescribeFieldErrors("payment"); const FREEZE_TYPES=freezeTypes(t);
 const client=useQueryClient(); const canUpdate=usePermission("pay:wallet:update"); const canOverview=usePermission("pay:wallet:query"); const canTx=usePermission("pay:wallet-transaction:query");
 // 看掩码卡（客服/风控日常）和解密完整卡号（打款）是两个权限点，故意不合并。
 const canCards=usePermission("pay:bank-card:query"); const canReveal=usePermission("pay:bank-card:reveal"); const canUnbind=usePermission("pay:bank-card:unbind");
 const canFreezes=usePermission("pay:wallet-freeze:query"); const canRelease=usePermission("pay:wallet-freeze:release");
 const [page,setPage]=React.useState(1); const [pageSize,setPageSize]=React.useState(20);
 // 处理投诉的人手上通常只有昵称或手机号，不会有 user id
 const emptyFilters={userId:"",username:"",nickname:"",mobile:""};
 const [draft,setDraft]=React.useState(emptyFilters); const [filters,setFilters]=React.useState(emptyFilters);
 const [selected,setSelected]=React.useState<Wallet|null>(null); const [mode,setMode]=React.useState<"recharge"|"balance"|null>(null);
 const [cardsOf,setCardsOf]=React.useState<Wallet|null>(null);
 const [freezesOf,setFreezesOf]=React.useState<Wallet|null>(null);
 // 解出来的明文只活在这个抽屉里：关掉就丢，下次要看得再解一次、再写一条审计。
 const [revealed,setRevealed]=React.useState<Record<number,string>>({}); const [amount,setAmount]=React.useState(0); const [remark,setRemark]=React.useState(""); const [error,setError]=React.useState<string|null>(null); const [fieldErrors,setFieldErrors]=React.useState<Record<string,string>>({});
 const params=new URLSearchParams({pageNo:String(page),pageSize:String(pageSize)});
 for(const [k,v] of Object.entries(filters)) if(v) params.set(k,v);
 const wallets=useQuery({queryKey:["pay-wallet",page,pageSize,filters],queryFn:()=>apiFetch<PageResponse<Wallet>>("/admin/pay/wallet/page?"+params)});
 const overview=useQuery({queryKey:["pay-wallet-overview"],queryFn:()=>apiFetch<Overview>("/admin/pay/wallet/overview"),enabled:canOverview});
 const tx=useQuery({queryKey:["pay-wallet-tx",selected?.id],queryFn:()=>apiFetch<PageResponse<Tx>>("/admin/pay/wallet-transaction/page-by-wallet?pageNo=1&pageSize=50&walletId="+selected?.id),enabled:Boolean(selected&&canTx)});
 const cards=useQuery({queryKey:["pay-bank-cards",cardsOf?.userId],queryFn:()=>apiFetch<BankCard[]>("/admin/wallet/bank-cards/user/"+cardsOf?.userId),enabled:Boolean(cardsOf&&canCards)});
 // 解绑：有未打款的提现单占着这张卡时服务端会拒绝并说明是哪几笔，原样透出。
 const unbindCard=useMutation({mutationFn:(id:number)=>apiWrite<boolean>("/admin/wallet/bank-cards/unbind/"+id,"POST",{}),onSuccess:async()=>{await client.invalidateQueries({queryKey:["pay-bank-cards"]})},onError:(cause:Error)=>setError(describeError(cause))});
 const reveal=useMutation({mutationFn:(id:number)=>apiWrite<string>("/admin/wallet/bank-cards/reveal/"+id,"POST",{}),onSuccess:(full:string,id:number)=>setRevealed(prev=>({...prev,[id]:full}))});
 // 「冻结金额」这列只说冻了多少，说不出**是什么冻的**——归因得看冻结记录
 // （spec：freeze_price 是缓存，不许从这个数反推）。这里按 userId 直接拉这个人的记录。
 const freezes=useQuery({queryKey:["pay-wallet-freezes",freezesOf?.userId],queryFn:()=>apiFetch<PageResponse<Freeze>>("/admin/wallet/freeze/page?pageNo=1&pageSize=50&userId="+freezesOf?.userId),enabled:Boolean(freezesOf&&canFreezes)});
 // 账户解冻：这里只有钱包，没有冻结记录 id，所以走按钱包解除的端点。
 // 它只认账户冻结，不会顺手把在途提现的占用一起放了。
 const unfreeze=useMutation({mutationFn:(walletId:number)=>apiWrite<boolean>("/admin/wallet/freeze/release-account/"+walletId,"POST",{}),onSuccess:async()=>{await client.invalidateQueries({queryKey:["pay-wallet"]});await client.invalidateQueries({queryKey:["pay-freeze"]})},onError:(cause:Error)=>setError(describeError(cause))});
 const mutate=useMutation({mutationFn:()=>{if(!selected||!mode)throw new Error(t("wallet.error.noSelection")); return mode==="recharge"?apiWrite<void>("/admin/pay/wallet/manual-recharge","POST",{userId:selected.userId,amount,remark:remark.trim()}):apiWrite<void>("/admin/pay/wallet/update-balance","PUT",{userId:selected.userId,balance:amount})},onSuccess:async()=>{setMode(null);setAmount(0);setRemark("");setFieldErrors({});await client.invalidateQueries({queryKey:["pay-wallet"]});await client.invalidateQueries({queryKey:["pay-wallet-overview"]})},onError:(cause:Error)=>{setError(describeError(cause));setFieldErrors(describeFieldErrors(cause))}});
 const columns:DataColumn<Wallet>[]=[
  {key:"user",header:t("wallet.column.userWallet"),cell:r=><div><strong className="block text-[var(--foreground)]">{t("common.userLabel",{userId:r.userId})}</strong><code className="text-[10px] text-[var(--muted-foreground)]">Wallet #{r.id}</code></div>},
  {key:"balance",header:t("wallet.field.balance"),cell:r=><span className="font-semibold tabular-nums">{money(r.balance)}</span>},
  {key:"available",header:t("wallet.field.available"),cell:r=>money(r.balance-r.freezePrice)},
  {key:"freeze",header:t("wallet.field.frozen"),cell:r=>money(r.freezePrice)},
  // 账户冻结没有金额，上一列一直是 0.00 —— 不单独标出来，被冻的账户看起来和正常的一模一样
  {key:"status",header:t("common.field.status"),cell:r=><span className={"rounded-full px-2.5 py-1 text-xs "+(r.accountFrozen?"bg-red-50 text-red-700":"bg-emerald-50 text-emerald-700")}>{r.accountFrozen?t("wallet.status.frozen"):t("wallet.status.normal")}</span>},
  {key:"recharge",header:t("wallet.field.totalRecharge"),cell:r=>money(r.totalRecharge)},
  {key:"expense",header:t("wallet.field.totalExpense"),cell:r=>money(r.totalExpense)},
  {key:"updated",header:t("wallet.field.updatedAt"),cell:r=>formatDateTime(r.updatedAt)},
  {key:"actions",header:t("common.field.actions"),headerClassName:"text-right",className:"text-right",cell:r=><RowActions primary={[{label:t("wallet.action.detail"),kind:"view",tone:"primary",onClick:()=>setSelected(r)},...(canUpdate?[{label:t("wallet.action.manualRecharge"),kind:"create" as const,tone:"positive" as const,onClick:()=>{setSelected(r);setMode("recharge");setAmount(0);setRemark("");setError(null)}}]:[])]} more={[...(canCards?[{label:t("wallet.action.bankCards"),kind:"list" as const,onClick:()=>{setRevealed({});setCardsOf(r)}}]:[]),...(canFreezes&&(r.freezePrice>0||r.accountFrozen)?[{label:t("wallet.freezes.title"),kind:"list" as const,onClick:()=>setFreezesOf(r)}]:[]),...(canUpdate?[{label:t("wallet.action.adjustBalance"),kind:"edit" as const,onClick:()=>{setSelected(r);setMode("balance");setAmount(r.balance);setError(null)}}]:[]),...(canRelease&&r.accountFrozen?[{label:t("wallet.action.unfreezeAccount"),kind:"enable" as const,danger:true,onClick:()=>unfreeze.mutate(r.id)}]:[])]}/>}
 ];
 return <div className="space-y-4">
  <PageHeader eyebrow={t("wallet.eyebrow")} title={t("wallet.title")} description={t("wallet.description")} actions={<Button variant="outline" onClick={()=>wallets.refetch()}>{t("common.action.refresh")}</Button>}/>
  {overview.data&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[t("wallet.overview.walletCount"),String(overview.data.walletCount)],[t("wallet.overview.available"),money(overview.data.totalAvailable)],[t("wallet.overview.frozen"),money(overview.data.totalFrozen)],[t("wallet.overview.pendingWithdraw"),t("wallet.overview.pendingWithdrawValue",{count:overview.data.withdrawPendingCount,amount:money(overview.data.withdrawPendingAmount)})]].map(([label,value])=><div key={label} className="front-surface rounded-xl px-4 py-3"><div className="text-[11px] text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div></div>)}</div>}
  <FilterPanel onSubmit={e=>{e.preventDefault();setPage(1);setFilters({...draft})}}>
   <div className="flex flex-wrap items-end gap-3">
    <div className="min-w-48 flex-1"><Field label={t("common.field.userId")}><Input value={draft.userId} onChange={e=>setDraft({...draft,userId:e.target.value.replace(/\D/g,"")})} placeholder={t("wallet.filter.userIdPlaceholder")}/></Field></div>
    <div className="min-w-48 flex-1"><Field label={t("wallet.filter.username")}><Input value={draft.username} onChange={e=>setDraft({...draft,username:e.target.value})} placeholder={t("wallet.filter.fuzzy")}/></Field></div>
    <div className="min-w-48 flex-1"><Field label={t("wallet.filter.nickname")}><Input value={draft.nickname} onChange={e=>setDraft({...draft,nickname:e.target.value})} placeholder={t("wallet.filter.fuzzy")}/></Field></div>
    <div className="min-w-48 flex-1"><Field label={t("wallet.filter.mobile")}><Input value={draft.mobile} onChange={e=>setDraft({...draft,mobile:e.target.value})} placeholder={t("wallet.filter.fuzzy")}/></Field></div>
    <Button type="button" variant="ghost" onClick={()=>{setDraft(emptyFilters);setFilters(emptyFilters);setPage(1)}}>{t("common.action.reset")}</Button>
    <Button type="submit">{t("common.action.search")}</Button>
   </div>
  </FilterPanel>
  <section className="front-surface overflow-hidden rounded-2xl"><DataTable columns={columns} rows={wallets.data?.list??[]} rowKey={r=>r.id} loading={wallets.isPending} error={wallets.error?describeError(wallets.error):null} minWidth={1100}/><Pagination page={page} pageSize={pageSize} total={wallets.data?.total??0} loading={wallets.isFetching} onPageChange={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/></section>
  <Drawer open={Boolean(selected&&!mode)} onClose={()=>setSelected(null)} title={t("wallet.detail.title")} description={selected?t("wallet.detail.subtitle",{userId:selected.userId,id:selected.id}):undefined} widthClassName="max-w-3xl">{selected&&<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[[t("wallet.field.balance"),money(selected.balance)],[t("wallet.field.frozen"),money(selected.freezePrice)],[t("wallet.field.totalRecharge"),money(selected.totalRecharge)],[t("wallet.field.totalExpense"),money(selected.totalExpense)]].map(([l,v])=><div key={l} className="rounded-xl border border-[var(--border)] p-3"><div className="text-[11px] text-[var(--muted-foreground)]">{l}</div><div className="mt-1 font-semibold">{v}</div></div>)}</div><DataTable columns={[{key:"title",header:t("wallet.tx.title"),cell:(r:Tx)=>r.title},{key:"biz",header:t("wallet.tx.biz"),cell:(r:Tx)=><code>{r.bizType}/{r.bizId}</code>},{key:"price",header:t("wallet.tx.change"),cell:(r:Tx)=><span className={r.price>=0?"text-emerald-600":"text-red-600"}>{money(r.price)}</span>},{key:"balance",header:t("wallet.tx.balanceAfter"),cell:(r:Tx)=>money(r.balance)},{key:"time",header:t("wallet.tx.time"),cell:(r:Tx)=>formatDateTime(r.createdAt)}]} rows={tx.data?.list??[]} rowKey={(r:Tx)=>r.id} loading={tx.isPending} error={tx.error?describeError(tx.error):null} minWidth={680}/></div>}</Drawer>
  <Drawer open={Boolean(freezesOf)} onClose={()=>setFreezesOf(null)} title={t("wallet.freezes.title")} description={freezesOf?t("wallet.freezes.subtitle",{userId:freezesOf.userId,amount:money(freezesOf.freezePrice)}):undefined} widthClassName="max-w-3xl">{freezesOf&&<DataTable columns={[
   {key:"type",header:t("common.field.type"),cell:(r:Freeze)=>FREEZE_TYPES[r.freezeType]??String(r.freezeType)},
   {key:"amount",header:t("wallet.freezes.amount"),cell:(r:Freeze)=>freezeMoney(t,r.amount)},
   {key:"status",header:t("common.field.status"),cell:(r:Freeze)=>freezeStatusText(t,r)},
   {key:"ref",header:t("freeze.field.refDoc"),cell:(r:Freeze)=>r.refId||"-"},
   // 0 = 无期限；有值时和「下达时间」用同一个格式化器，否则同一行两种日期写法。
   {key:"expires",header:t("freeze.field.expires"),cell:(r:Freeze)=>r.expiresAt>0?formatDateTime(r.expiresAt):t("freeze.field.noExpiry")},
   {key:"created",header:t("freeze.field.placedAt"),cell:(r:Freeze)=>formatDateTime(r.createdAt)},
  ]} rows={freezes.data?.list??[]} rowKey={(r:Freeze)=>r.id} loading={freezes.isPending} error={freezes.error?describeError(freezes.error):null} minWidth={820}/>}
  <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">{t("wallet.freezes.note")}</p></Drawer>
  <Drawer open={Boolean(cardsOf)} onClose={()=>{setCardsOf(null);setRevealed({})}} title={t("wallet.cards.title")} description={cardsOf?t("common.userLabel",{userId:cardsOf.userId}):undefined} widthClassName="max-w-3xl">{cardsOf&&<DataTable columns={[
   {key:"holder",header:t("wallet.cards.holder"),cell:(r:BankCard)=>r.holderName},
   {key:"bank",header:t("wallet.cards.bank"),cell:(r:BankCard)=>r.bankName},
   // 解过就显示明文，否则一律掩码：列表接口本身永远不返回完整卡号。
   {key:"no",header:t("wallet.cards.cardNo"),cell:(r:BankCard)=><code>{revealed[r.id]??r.cardNoMasked}</code>},
   {key:"status",header:t("common.field.status"),cell:(r:BankCard)=>r.status===0?t("wallet.cards.status.active"):t("common.status.disabled")},
   {key:"time",header:t("wallet.cards.boundAt"),cell:(r:BankCard)=>r.createdAt?formatDateTime(r.createdAt):"-"},
   {key:"actions",header:t("common.field.actions"),headerClassName:"text-right",className:"text-right",cell:(r:BankCard)=><div className="flex items-center justify-end gap-1">
    {canReveal&&!revealed[r.id]&&<Button variant="ghost" disabled={reveal.isPending} onClick={()=>reveal.mutate(r.id)}>{t("wallet.cards.reveal")}</Button>}
    {canUnbind&&<Button variant="ghost" className="text-red-600" disabled={unbindCard.isPending} onClick={()=>{if(confirm(t("wallet.cards.unbindConfirm")))unbindCard.mutate(r.id)}}>{t("wallet.cards.unbind")}</Button>}
   </div>},
  ]} rows={cards.data??[]} rowKey={(r:BankCard)=>r.id} loading={cards.isPending} error={cards.error?describeError(cards.error):null} minWidth={760}/>}
  {canReveal&&<p className="mt-3 text-[11px] text-[var(--muted-foreground)]">{t("wallet.cards.revealNote")}</p>}</Drawer>
  <Drawer open={Boolean(selected&&mode)} onClose={()=>setMode(null)} title={mode==="recharge"?t("wallet.action.manualRecharge"):t("wallet.action.adjustBalance")} description={selected?t("common.userLabel",{userId:selected.userId}):undefined} footer={<><Button variant="ghost" onClick={()=>setMode(null)}>{t("common.action.cancel")}</Button><Button variant={mode==="recharge"?"default":"destructive"} disabled={mutate.isPending||!selected||amount<0||(mode==="recharge"&&(!remark.trim()||amount<=0))} onClick={()=>mutate.mutate()}>{mutate.isPending?t("common.action.processing"):t("common.action.confirmSubmit")}</Button></>}>{error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}<div className="space-y-4"><Field label={mode==="recharge"?t("wallet.adjust.rechargeAmount"):t("wallet.adjust.targetBalance")} error={fieldErrors.amount??fieldErrors.balance}><Input type="number" min={0} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field>{mode==="recharge"&&<Field label={t("wallet.adjust.remark")} error={fieldErrors.remark}><Input value={remark} onChange={e=>setRemark(e.target.value)} placeholder={t("wallet.adjust.remarkPlaceholder")}/></Field>}</div></Drawer>
 </div>
}
