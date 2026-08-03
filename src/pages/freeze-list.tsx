"use client";
import * as React from "react";
import { apiFetch,apiWrite } from "@neton/application-front-runtime/client";
import { useMutation,usePermission,useQuery,useQueryClient } from "@neton/application-front-runtime/client-context";
import type { PageResponse } from "@neton/application-front-runtime/types";
import { formatDateTime } from "@neton/application-front-runtime/types";
import { Button,DataTable,Drawer,Field,FilterPanel,Input,PageHeader,Pagination,RowActions,Select,type DataColumn } from "@neton/application-front-kit";

interface Freeze{id:number;walletId:number;userId:number;freezeType:number;amount:number|null;status:number;refType:number;refId:string;reasonCode?:string|null;reasonText?:string|null;operatorId:number;expiresAt:number;createdAt:number;releasedAt:number}
const TYPES:Record<number,string>={1:"提现冻结",2:"单笔风控",3:"账户冻结"};
// 三种终态含义不同，不许合并成一个「已解冻」（spec WALLET_FREEZE_SPEC §3.1）。
const STATUS:Record<number,string>={0:"冻结中",1:"已解除",2:"已扣除",3:"已到期"};
const money=(v:number|null)=>v==null?"全额":"¥"+(v/100).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});
const expired=(r:Freeze)=>r.status===0&&r.expiresAt>0&&r.expiresAt<Date.now();

export default function Page(){
 const client=useQueryClient();
 const perms={list:usePermission("pay:wallet-freeze:list"),place:usePermission("pay:wallet-freeze:place"),judicial:usePermission("pay:wallet-freeze:judicial"),release:usePermission("pay:wallet-freeze:release")};
 const [page,setPage]=React.useState(1);const[pageSize,setPageSize]=React.useState(20);
 const [draft,setDraft]=React.useState({userId:"",freezeType:"",status:""});const[filters,setFilters]=React.useState(draft);
 const [selected,setSelected]=React.useState<Freeze|null>(null);
 const [mode,setMode]=React.useState<"risk"|"judicial"|"release"|null>(null);
 const [risk,setRisk]=React.useState({userId:"",amount:0,refId:"",reasonText:""});
 const [jud,setJud]=React.useState({userId:"",targetAmount:"",legalDocNo:"",confirmDocNo:"",reasonText:"",expiresAt:""});
 const [error,setError]=React.useState<string|null>(null);

 const params=new URLSearchParams({pageNo:String(page),pageSize:String(pageSize)});
 if(filters.userId)params.set("userId",filters.userId);
 if(filters.freezeType)params.set("freezeType",filters.freezeType);
 if(filters.status)params.set("status",filters.status);
 const query=useQuery({queryKey:["pay-freeze",page,pageSize,filters],queryFn:()=>apiFetch<PageResponse<Freeze>>("/admin/wallet/freeze/page?"+params),enabled:perms.list});

 const done=async()=>{setMode(null);setSelected(null);setError(null);await client.invalidateQueries({queryKey:["pay-freeze"]});await client.invalidateQueries({queryKey:["pay-wallet"]})};
 const fail=(cause:Error)=>setError(cause.message);
 const placeRisk=useMutation({mutationFn:()=>apiWrite<Freeze>("/admin/wallet/freeze/risk-hold","POST",{userId:Number(risk.userId),amount:risk.amount,refId:risk.refId.trim(),reasonText:risk.reasonText.trim()||null}),onSuccess:async()=>{setRisk({userId:"",amount:0,refId:"",reasonText:""});await done()},onError:fail});
 const placeJudicial=useMutation({mutationFn:()=>apiWrite<Freeze>("/admin/wallet/freeze/judicial","POST",{userId:Number(jud.userId),targetAmount:jud.targetAmount?Number(jud.targetAmount):null,legalDocNo:jud.legalDocNo.trim(),reasonText:jud.reasonText.trim()||null,expiresAt:jud.expiresAt?Number(jud.expiresAt):0}),onSuccess:async()=>{setJud({userId:"",targetAmount:"",legalDocNo:"",confirmDocNo:"",reasonText:"",expiresAt:""});await done()},onError:fail});
 const release=useMutation({mutationFn:()=>{if(!selected)throw new Error("未选择冻结记录");return apiWrite<boolean>("/admin/wallet/freeze/release/"+selected.id,"POST",{})},onSuccess:done,onError:fail});
 // 到期本身不需要点这个：过期的冻结在可用余额计算里当场失效，这里只是把状态追上事实。
 const sweep=useMutation({mutationFn:()=>apiWrite<number>("/admin/wallet/freeze/sweep-expired","POST",{}),onSuccess:done,onError:fail});

 const open=(m:typeof mode,r?:Freeze)=>{setError(null);setSelected(r??null);setMode(m)};

 const columns:DataColumn<Freeze>[]=[
  {key:"id",header:"冻结",cell:r=><div><strong># {r.id}</strong><span className="block text-[10px] text-[var(--muted-foreground)]">用户 {r.userId}</span></div>},
  {key:"type",header:"类型",cell:r=>TYPES[r.freezeType]??r.freezeType},
  {key:"amount",header:"金额",cell:r=><span className="font-semibold">{money(r.amount)}</span>},
  {key:"status",header:"状态",cell:r=><span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs">{expired(r)?"已到期（待巡检）":STATUS[r.status]??r.status}</span>},
  {key:"ref",header:"关联",cell:r=><span className="break-all text-xs">{r.refId||"-"}</span>},
  {key:"expires",header:"到期",cell:r=>r.expiresAt>0?formatDateTime(r.expiresAt):"无期限"},
  {key:"created",header:"下达时间",cell:r=>formatDateTime(r.createdAt)},
  {key:"actions",header:"操作",headerClassName:"text-right",className:"text-right",cell:r=><RowActions
    primary={[{label:"详情",tone:"primary" as const,onClick:()=>{setSelected(r);setMode(null)}}]}
    // 提现冻结由提现状态机管，这里不给解除入口——两个地方都能解就会双写。
    more={r.status===0&&r.freezeType!==1&&perms.release?[{label:"解除冻结",danger:true,onClick:()=>open("release",r)}]:[]}/>}
 ];

 return <div className="space-y-4">
  <PageHeader eyebrow="FUND FREEZE" title="冻结管理" description="单笔风控冻结金额固定；账户冻结（司法）金额随余额浮动，到账即冻。提现冻结由提现状态机维护，此处只读。"
   actions={<>
    <Button variant="outline" onClick={()=>query.refetch()}>刷新</Button>
    {perms.release&&<Button variant="outline" disabled={sweep.isPending} onClick={()=>sweep.mutate()}>{sweep.isPending?"巡检中…":"巡检到期"}</Button>}
    {perms.place&&<Button variant="outline" onClick={()=>open("risk")}>单笔冻结</Button>}
    {perms.judicial&&<Button onClick={()=>open("judicial")}>账户冻结</Button>}
   </>}/>

  <FilterPanel onSubmit={e=>{e.preventDefault();setPage(1);setFilters({...draft})}}>
   <div className="flex flex-wrap items-end gap-3">
    <div className="min-w-52 flex-1"><Field label="用户 ID"><Input value={draft.userId} onChange={e=>setDraft({...draft,userId:e.target.value.replace(/\D/g,"")})}/></Field></div>
    <div className="w-44"><Field label="类型"><Select value={draft.freezeType} onChange={e=>setDraft({...draft,freezeType:e.target.value})}><option value="">全部类型</option>{Object.entries(TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field></div>
    <div className="w-44"><Field label="状态"><Select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="">全部状态</option>{Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field></div>
    <Button type="button" variant="ghost" onClick={()=>{const v={userId:"",freezeType:"",status:""};setDraft(v);setFilters(v)}}>重置</Button>
    <Button type="submit">查询</Button>
   </div>
  </FilterPanel>

  <section className="front-surface overflow-hidden rounded-2xl">
   <DataTable columns={columns} rows={query.data?.list??[]} rowKey={r=>r.id} loading={query.isPending} error={query.error?.message} minWidth={980}/>
   <Pagination page={page} pageSize={pageSize} total={query.data?.total??0} loading={query.isFetching} onPageChange={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/>
  </section>

  <Drawer open={Boolean(selected&&!mode)} onClose={()=>setSelected(null)} title="冻结详情" widthClassName="max-w-2xl">
   {selected&&<dl className="overflow-hidden rounded-xl border border-[var(--border)]">{([
     ["冻结 ID",selected.id],["用户 ID",selected.userId],["钱包 ID",selected.walletId],
     ["类型",TYPES[selected.freezeType]??selected.freezeType],
     ["金额",money(selected.amount)],
     ["状态",expired(selected)?"已到期（待巡检）":STATUS[selected.status]??selected.status],
     ["关联/文书号",selected.refId||"-"],["原因",selected.reasonText||selected.reasonCode||"-"],
     ["经办人",selected.operatorId],
     ["到期",selected.expiresAt>0?formatDateTime(selected.expiresAt):"无期限"],
     ["下达时间",formatDateTime(selected.createdAt)],
     ["结束时间",selected.releasedAt>0?formatDateTime(selected.releasedAt):"-"],
   ] as [string,React.ReactNode][]).map(([l,v])=><div key={l} className="grid grid-cols-[120px_1fr] gap-4 border-b border-[var(--border)] p-3 last:border-0"><dt className="text-xs text-[var(--muted-foreground)]">{l}</dt><dd className="break-all text-sm">{v}</dd></div>)}</dl>}
  </Drawer>

  <Drawer open={mode==="risk"} onClose={()=>setMode(null)} title="单笔风控冻结"
   description="金额固定。可用余额不足会直接失败，不会悄悄冻一个更小的数。"
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>取消</Button><Button disabled={placeRisk.isPending||!risk.userId||risk.amount<=0||!risk.refId.trim()} onClick={()=>placeRisk.mutate()}>{placeRisk.isPending?"处理中…":"确认冻结"}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   <div className="space-y-4">
    <Field label="用户 ID（必填）"><Input value={risk.userId} onChange={e=>setRisk({...risk,userId:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label="冻结金额（分，必填）"><Input type="number" min={1} value={risk.amount} onChange={e=>setRisk({...risk,amount:Number(e.target.value)})}/></Field>
    <Field label="业务单号（必填，幂等键）"><Input value={risk.refId} onChange={e=>setRisk({...risk,refId:e.target.value})} placeholder="触发冻结的账变流水 id，或唯一工单号"/></Field>
    <Field label="冻结原因（可选）"><Input value={risk.reasonText} onChange={e=>setRisk({...risk,reasonText:e.target.value})}/></Field>
   </div>
  </Drawer>

  <Drawer open={mode==="judicial"} onClose={()=>setMode(null)} title="账户冻结（司法）"
   description="对用户资产的强制处分。留空目标额 = 全额冻结，后续到账继续吸收。"
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>取消</Button><Button variant="destructive" disabled={placeJudicial.isPending||!jud.userId||!jud.legalDocNo.trim()||jud.confirmDocNo.trim()!==jud.legalDocNo.trim()} onClick={()=>placeJudicial.mutate()}>{placeJudicial.isPending?"处理中…":"确认冻结"}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   <div className="space-y-4">
    <Field label="用户 ID（必填）"><Input value={jud.userId} onChange={e=>setJud({...jud,userId:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label="目标冻结额（分，留空=全额）"><Input type="number" min={1} value={jud.targetAmount} onChange={e=>setJud({...jud,targetAmount:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label="法律文书号（必填，幂等键）"><Input value={jud.legalDocNo} onChange={e=>setJud({...jud,legalDocNo:e.target.value})}/></Field>
    <Field label="到期时间（epoch 毫秒，留空=无期限）"><Input value={jud.expiresAt} onChange={e=>setJud({...jud,expiresAt:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label="冻结依据（可选，不下发给用户）"><Input value={jud.reasonText} onChange={e=>setJud({...jud,reasonText:e.target.value})}/></Field>
    {/* 二次确认绑在文书号上而不是一个复选框：要求经办人再核对一遍写的是哪份文书。 */}
    <Field label="再次输入法律文书号以确认"><Input value={jud.confirmDocNo} onChange={e=>setJud({...jud,confirmDocNo:e.target.value})}/></Field>
   </div>
  </Drawer>

  <Drawer open={mode==="release"} onClose={()=>setMode(null)} title="解除冻结"
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>取消</Button><Button variant="destructive" disabled={release.isPending} onClick={()=>release.mutate()}>{release.isPending?"处理中…":"确认解除"}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   {selected&&<p className="text-sm">将解除 <strong># {selected.id}</strong>（用户 {selected.userId}，{TYPES[selected.freezeType]}，{money(selected.amount)}），这笔钱回到用户的可用余额。</p>}
  </Drawer>
 </div>;
}
