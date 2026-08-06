"use client";
import * as React from "react";
import { apiFetch, apiWrite } from "@neton/application-front-runtime/client";
import { useMutation, usePermission, useQuery, useQueryClient } from "@neton/application-front-runtime/client-context";
import type { PageResponse } from "@neton/application-front-runtime/types";
import { formatDateTime } from "@neton/application-front-runtime/types";
import { Button, DataTable, Drawer, Field, FilterPanel, Input, PageHeader, Pagination, RowActions, type DataColumn } from "@neton/application-front-kit";

interface Wallet { id:number; userId:number; balance:number; freezePrice:number; totalRecharge:number; totalExpense:number; createdAt:number; updatedAt:number }
interface Tx { id:number; walletId:number; bizType:number; bizId:number; title:string; price:number; balance:number; createdAt:number }
import type { Freeze } from "../lib/freeze";
import { FREEZE_TYPES, freezeMoney, freezeStatusText } from "../lib/freeze";

/** 银行卡对外视图：只有掩码，完整卡号要单独换（见 revealCard）。 */
interface BankCard { id:number; userId:number; holderName:string; bankName:string; bankCode?:string|null; cardNoMasked:string; status:number; createdAt?:number|null }
interface Overview { walletCount:number; totalBalance:number; totalFrozen:number; totalAvailable:number; totalRecharge:number; totalExpense:number; withdrawPendingCount:number; withdrawPendingAmount:number; withdrawApprovedCount:number; withdrawApprovedAmount:number; withdrawPaidCount:number; withdrawPaidAmount:number }
const money=(value:number)=>"¥"+(value/100).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Page(){
 const client=useQueryClient(); const canUpdate=usePermission("pay:wallet:update"); const canOverview=usePermission("pay:wallet:overview"); const canTx=usePermission("pay:wallet-transaction:page");
 // 看掩码卡（客服/风控日常）和解密完整卡号（打款）是两个权限点，故意不合并。
 const canCards=usePermission("pay:bank-card:list"); const canReveal=usePermission("pay:bank-card:reveal");
 const canFreezes=usePermission("pay:wallet-freeze:list");
 const [page,setPage]=React.useState(1); const [pageSize,setPageSize]=React.useState(20); const [draft,setDraft]=React.useState(""); const [userId,setUserId]=React.useState("");
 const [selected,setSelected]=React.useState<Wallet|null>(null); const [mode,setMode]=React.useState<"recharge"|"balance"|null>(null);
 const [cardsOf,setCardsOf]=React.useState<Wallet|null>(null);
 const [freezesOf,setFreezesOf]=React.useState<Wallet|null>(null);
 // 解出来的明文只活在这个抽屉里：关掉就丢，下次要看得再解一次、再写一条审计。
 const [revealed,setRevealed]=React.useState<Record<number,string>>({}); const [amount,setAmount]=React.useState(0); const [remark,setRemark]=React.useState(""); const [error,setError]=React.useState<string|null>(null);
 const params=new URLSearchParams({pageNo:String(page),pageSize:String(pageSize)}); if(userId)params.set("userId",userId);
 const wallets=useQuery({queryKey:["pay-wallet",page,pageSize,userId],queryFn:()=>apiFetch<PageResponse<Wallet>>("/admin/pay/wallet/page?"+params)});
 const overview=useQuery({queryKey:["pay-wallet-overview"],queryFn:()=>apiFetch<Overview>("/admin/pay/wallet/overview"),enabled:canOverview});
 const tx=useQuery({queryKey:["pay-wallet-tx",selected?.id],queryFn:()=>apiFetch<PageResponse<Tx>>("/admin/pay/wallet-transaction/page-by-wallet?pageNo=1&pageSize=50&walletId="+selected?.id),enabled:Boolean(selected&&canTx)});
 const cards=useQuery({queryKey:["pay-bank-cards",cardsOf?.userId],queryFn:()=>apiFetch<BankCard[]>("/admin/wallet/bank-cards/user/"+cardsOf?.userId),enabled:Boolean(cardsOf&&canCards)});
 const reveal=useMutation({mutationFn:(id:number)=>apiWrite<string>("/admin/wallet/bank-cards/reveal/"+id,"POST",{}),onSuccess:(full:string,id:number)=>setRevealed(prev=>({...prev,[id]:full}))});
 // 「冻结金额」这列只说冻了多少，说不出**是什么冻的**——归因得看冻结记录
 // （spec：freeze_price 是缓存，不许从这个数反推）。这里按 userId 直接拉这个人的记录。
 const freezes=useQuery({queryKey:["pay-wallet-freezes",freezesOf?.userId],queryFn:()=>apiFetch<PageResponse<Freeze>>("/admin/wallet/freeze/page?pageNo=1&pageSize=50&userId="+freezesOf?.userId),enabled:Boolean(freezesOf&&canFreezes)});
 const mutate=useMutation({mutationFn:()=>{if(!selected||!mode)throw new Error("请选择钱包"); return mode==="recharge"?apiWrite<void>("/admin/pay/wallet/manual-recharge","POST",{userId:selected.userId,amount,remark:remark.trim()}):apiWrite<void>("/admin/pay/wallet/update-balance","PUT",{userId:selected.userId,balance:amount})},onSuccess:async()=>{setMode(null);setAmount(0);setRemark("");await client.invalidateQueries({queryKey:["pay-wallet"]});await client.invalidateQueries({queryKey:["pay-wallet-overview"]})},onError:(cause:Error)=>setError(cause.message)});
 const columns:DataColumn<Wallet>[]=[
  {key:"user",header:"用户 / 钱包",cell:r=><div><strong className="block text-[var(--foreground)]">用户 {r.userId}</strong><code className="text-[10px] text-[var(--muted-foreground)]">Wallet #{r.id}</code></div>},
  {key:"balance",header:"余额",cell:r=><span className="font-semibold tabular-nums">{money(r.balance)}</span>},
  {key:"available",header:"可用余额",cell:r=>money(r.balance-r.freezePrice)},
  {key:"freeze",header:"冻结",cell:r=>money(r.freezePrice)},
  {key:"recharge",header:"累计充值",cell:r=>money(r.totalRecharge)},
  {key:"expense",header:"累计支出",cell:r=>money(r.totalExpense)},
  {key:"updated",header:"更新时间",cell:r=>formatDateTime(r.updatedAt)},
  {key:"actions",header:"操作",headerClassName:"text-right",className:"text-right",cell:r=><RowActions primary={[{label:"详情流水",tone:"primary",onClick:()=>setSelected(r)},...(canUpdate?[{label:"手工充值",tone:"positive" as const,onClick:()=>{setSelected(r);setMode("recharge");setAmount(0);setRemark("");setError(null)}}]:[])]} more={[...(canCards?[{label:"银行卡",onClick:()=>{setRevealed({});setCardsOf(r)}}]:[]),...(canFreezes&&r.freezePrice>0?[{label:"冻结记录",onClick:()=>setFreezesOf(r)}]:[]),...(canUpdate?[{label:"余额校正",onClick:()=>{setSelected(r);setMode("balance");setAmount(r.balance);setError(null)}}]:[])]}/>}
 ];
 return <div className="space-y-4">
  <PageHeader eyebrow="FINANCE CONTROL" title="钱包管理" description="统一查看资金聚合、钱包余额和可审计流水；资金修改必须填写业务依据。" actions={<Button variant="outline" onClick={()=>wallets.refetch()}>刷新</Button>}/>
  {overview.data&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["钱包数量",String(overview.data.walletCount)],["可用资金",money(overview.data.totalAvailable)],["冻结资金",money(overview.data.totalFrozen)],["待审提现",overview.data.withdrawPendingCount+" 笔 · "+money(overview.data.withdrawPendingAmount)]].map(([label,value])=><div key={label} className="front-surface rounded-xl px-4 py-3"><div className="text-[11px] text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div></div>)}</div>}
  <FilterPanel onSubmit={e=>{e.preventDefault();setPage(1);setUserId(draft.trim())}}><div className="flex items-end gap-3"><div className="max-w-sm flex-1"><Field label="用户 ID"><Input value={draft} onChange={e=>setDraft(e.target.value.replace(/\D/g,""))} placeholder="输入用户 ID"/></Field></div><Button type="button" variant="ghost" onClick={()=>{setDraft("");setUserId("");setPage(1)}}>重置</Button><Button type="submit">查询</Button></div></FilterPanel>
  <section className="front-surface overflow-hidden rounded-2xl"><DataTable columns={columns} rows={wallets.data?.list??[]} rowKey={r=>r.id} loading={wallets.isPending} error={wallets.error?.message} minWidth={1100}/><Pagination page={page} pageSize={pageSize} total={wallets.data?.total??0} loading={wallets.isFetching} onPageChange={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/></section>
  <Drawer open={Boolean(selected&&!mode)} onClose={()=>setSelected(null)} title="钱包详情与流水" description={selected?"用户 "+selected.userId+" · Wallet #"+selected.id:undefined} widthClassName="max-w-3xl">{selected&&<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[["余额",money(selected.balance)],["冻结",money(selected.freezePrice)],["累计充值",money(selected.totalRecharge)],["累计支出",money(selected.totalExpense)]].map(([l,v])=><div key={l} className="rounded-xl border border-[var(--border)] p-3"><div className="text-[11px] text-[var(--muted-foreground)]">{l}</div><div className="mt-1 font-semibold">{v}</div></div>)}</div><DataTable columns={[{key:"title",header:"流水标题",cell:(r:Tx)=>r.title},{key:"biz",header:"业务",cell:(r:Tx)=><code>{r.bizType}/{r.bizId}</code>},{key:"price",header:"变动",cell:(r:Tx)=><span className={r.price>=0?"text-emerald-600":"text-red-600"}>{money(r.price)}</span>},{key:"balance",header:"变动后",cell:(r:Tx)=>money(r.balance)},{key:"time",header:"时间",cell:(r:Tx)=>formatDateTime(r.createdAt)}]} rows={tx.data?.list??[]} rowKey={(r:Tx)=>r.id} loading={tx.isPending} error={tx.error?.message} minWidth={680}/></div>}</Drawer>
  <Drawer open={Boolean(freezesOf)} onClose={()=>setFreezesOf(null)} title="冻结记录" description={freezesOf?"用户 "+freezesOf.userId+" · 当前冻结 "+money(freezesOf.freezePrice):undefined} widthClassName="max-w-3xl">{freezesOf&&<DataTable columns={[
   {key:"type",header:"类型",cell:(r:Freeze)=>FREEZE_TYPES[r.freezeType]??String(r.freezeType)},
   {key:"amount",header:"冻结金额",cell:(r:Freeze)=>freezeMoney(r.amount)},
   {key:"status",header:"状态",cell:(r:Freeze)=>freezeStatusText(r)},
   {key:"ref",header:"关联/文书号",cell:(r:Freeze)=>r.refId||"-"},
   // 0 = 无期限；有值时和「下达时间」用同一个格式化器，否则同一行两种日期写法。
   {key:"expires",header:"到期",cell:(r:Freeze)=>r.expiresAt>0?formatDateTime(r.expiresAt):"无期限"},
   {key:"created",header:"下达时间",cell:(r:Freeze)=>formatDateTime(r.createdAt)},
  ]} rows={freezes.data?.list??[]} rowKey={(r:Freeze)=>r.id} loading={freezes.isPending} error={freezes.error?.message} minWidth={820}/>}
  <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">解除冻结在「冻结管理」页操作；提现冻结由提现状态机维护，不在这里解。</p></Drawer>
  <Drawer open={Boolean(cardsOf)} onClose={()=>{setCardsOf(null);setRevealed({})}} title="绑定的银行卡" description={cardsOf?"用户 "+cardsOf.userId:undefined} widthClassName="max-w-3xl">{cardsOf&&<DataTable columns={[
   {key:"holder",header:"持卡人",cell:(r:BankCard)=>r.holderName},
   {key:"bank",header:"开户行",cell:(r:BankCard)=>r.bankName},
   // 解过就显示明文，否则一律掩码：列表接口本身永远不返回完整卡号。
   {key:"no",header:"卡号",cell:(r:BankCard)=><code>{revealed[r.id]??r.cardNoMasked}</code>},
   {key:"status",header:"状态",cell:(r:BankCard)=>r.status===0?"正常":"停用"},
   {key:"time",header:"绑定时间",cell:(r:BankCard)=>r.createdAt?formatDateTime(r.createdAt):"-"},
   {key:"actions",header:"操作",headerClassName:"text-right",className:"text-right",cell:(r:BankCard)=>canReveal&&!revealed[r.id]?<Button variant="ghost" disabled={reveal.isPending} onClick={()=>reveal.mutate(r.id)}>查看完整卡号</Button>:null},
  ]} rows={cards.data??[]} rowKey={(r:BankCard)=>r.id} loading={cards.isPending} error={cards.error?.message} minWidth={760}/>}
  {canReveal&&<p className="mt-3 text-[11px] text-[var(--muted-foreground)]">解密完整卡号会记入敏感操作审计（经办人 / IP / 时间）。</p>}</Drawer>
  <Drawer open={Boolean(selected&&mode)} onClose={()=>setMode(null)} title={mode==="recharge"?"手工充值":"余额校正"} description={selected?"用户 "+selected.userId:undefined} footer={<><Button variant="ghost" onClick={()=>setMode(null)}>取消</Button><Button variant={mode==="recharge"?"default":"destructive"} disabled={mutate.isPending||!selected||amount<0||(mode==="recharge"&&(!remark.trim()||amount<=0))} onClick={()=>mutate.mutate()}>{mutate.isPending?"处理中…":"确认提交"}</Button></>}>{error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}<div className="space-y-4"><Field label={mode==="recharge"?"充值金额（分）":"目标余额（分）"}><Input type="number" min={0} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field>{mode==="recharge"&&<Field label="充值备注（必填）"><Input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="银行汇款、异常补单等业务依据"/></Field>}</div></Drawer>
 </div>
}
