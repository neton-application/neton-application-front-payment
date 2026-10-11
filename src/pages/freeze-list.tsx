"use client";
import * as React from "react";
import { apiFetch,apiWrite } from "@neton/application-front-runtime/client";
import { useMutation,usePermission,useQuery,useQueryClient } from "@neton/application-front-runtime/client-context";
import type { PageResponse } from "@neton/application-front-runtime/types";
import { formatDateTime } from "@neton/application-front-runtime/types";
import { useT } from "@neton/application-front-runtime/i18n";
import { useDescribeError } from "@neton/application-front-runtime/errors";
import { Button,DataTable,Drawer,Field,FilterPanel,Input,PageHeader,Pagination,RowActions,Select,type DataColumn } from "@neton/application-front-kit";

// 模型与文案共享给钱包页（钱包页的「冻结记录」抽屉读同一批状态）。
import type { Freeze } from "../lib/freeze";
import { freezeMoney, freezeStatuses, freezeStatusText, freezeTypes } from "../lib/freeze";

/** 句子整体由词条决定语序，只把冻结号这一段加粗：词条里的 {id} 先替换成占位符，再切开渲染。 */
const SLOT="\u0000";
function ReleaseSummary({text,id}:{text:string;id:number}){
 const [before,after=""]=text.split(SLOT);
 return <p className="text-sm">{before}<strong># {id}</strong>{after}</p>;
}

export default function Page(){
 const t=useT("payment"); const describeError=useDescribeError();
 const TYPES=freezeTypes(t); const STATUS=freezeStatuses(t); const money=(v:null|number)=>freezeMoney(t,v);
 const client=useQueryClient();
 const perms={list:usePermission("pay:wallet-freeze:query"),place:usePermission("pay:wallet-freeze:place"),judicial:usePermission("pay:wallet-freeze:judicial"),release:usePermission("pay:wallet-freeze:release")};
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
 const fail=(cause:Error)=>setError(describeError(cause));
 const placeRisk=useMutation({mutationFn:()=>apiWrite<Freeze>("/admin/wallet/freeze/risk-hold","POST",{userId:Number(risk.userId),amount:risk.amount,refId:risk.refId.trim(),reasonText:risk.reasonText.trim()||null}),onSuccess:async()=>{setRisk({userId:"",amount:0,refId:"",reasonText:""});await done()},onError:fail});
 const placeJudicial=useMutation({mutationFn:()=>apiWrite<Freeze>("/admin/wallet/freeze/judicial","POST",{userId:Number(jud.userId),targetAmount:null,legalDocNo:jud.legalDocNo.trim()||null,reasonText:jud.reasonText.trim()||null,expiresAt:jud.expiresAt?Number(jud.expiresAt):0}),onSuccess:async()=>{setJud({userId:"",targetAmount:"",legalDocNo:"",confirmDocNo:"",reasonText:"",expiresAt:""});await done()},onError:fail});
 const release=useMutation({mutationFn:()=>{if(!selected)throw new Error(t("freeze.error.noSelection"));return apiWrite<boolean>("/admin/wallet/freeze/release/"+selected.id,"POST",{})},onSuccess:done,onError:fail});
 // 到期本身不需要点这个：过期的冻结在可用余额计算里当场失效，这里只是把状态追上事实。
 const sweep=useMutation({mutationFn:()=>apiWrite<number>("/admin/wallet/freeze/sweep-expired","POST",{}),onSuccess:done,onError:fail});

 const open=(m:typeof mode,r?:Freeze)=>{setError(null);setSelected(r??null);setMode(m)};

 const columns:DataColumn<Freeze>[]=[
  {key:"id",header:t("freeze.column.freeze"),cell:r=><div><strong># {r.id}</strong><span className="block text-[10px] text-[var(--muted-foreground)]">{t("common.userLabel",{userId:r.userId})}</span></div>},
  {key:"type",header:t("common.field.type"),cell:r=>TYPES[r.freezeType]??r.freezeType},
  {key:"amount",header:t("common.field.amount"),cell:r=><span className="font-semibold">{money(r.amount)}</span>},
  {key:"status",header:t("common.field.status"),cell:r=><span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs">{freezeStatusText(t,r)}</span>},
  {key:"ref",header:t("freeze.field.ref"),cell:r=><span className="break-all text-xs">{r.refId||"-"}</span>},
  {key:"expires",header:t("freeze.field.expires"),cell:r=>r.expiresAt>0?formatDateTime(r.expiresAt):t("freeze.field.noExpiry")},
  {key:"created",header:t("freeze.field.placedAt"),cell:r=>formatDateTime(r.createdAt)},
  {key:"actions",header:t("common.field.actions"),headerClassName:"text-right",className:"text-right",cell:r=><RowActions
    primary={[{label:t("common.action.detail"),kind:"view" as const,tone:"primary" as const,onClick:()=>{setSelected(r);setMode(null)}}]}
    // 提现冻结由提现状态机管：两处都能解就会双写——钱回到用户手上，提现单还停在
    // PENDING 等打款。禁用而不是隐藏，隐藏会让人以为系统没有解冻能力。
    more={r.status===0&&perms.release?[r.freezeType===1
      ?{label:t("freeze.action.releaseViaWithdraw"),kind:"enable" as const,danger:true,disabled:true}
      :{label:t("freeze.action.release"),kind:"enable" as const,danger:true,onClick:()=>open("release",r)}]:[]}/>}
 ];

 return <div className="space-y-4">
  <PageHeader eyebrow={t("freeze.eyebrow")} title={t("freeze.title")} description={t("freeze.description")}
   actions={<>
    <Button variant="outline" onClick={()=>query.refetch()}>{t("common.action.refresh")}</Button>
    {perms.release&&<Button variant="outline" disabled={sweep.isPending} onClick={()=>sweep.mutate()}>{sweep.isPending?t("freeze.action.sweeping"):t("freeze.action.sweep")}</Button>}
    {perms.place&&<Button variant="outline" onClick={()=>open("risk")}>{t("freeze.action.placeRisk")}</Button>}
    {perms.judicial&&<Button onClick={()=>open("judicial")}>{t("freeze.action.placeJudicial")}</Button>}
   </>}/>

  <FilterPanel onSubmit={e=>{e.preventDefault();setPage(1);setFilters({...draft})}}>
   <div className="flex flex-wrap items-end gap-3">
    <div className="min-w-52 flex-1"><Field label={t("common.field.userId")}><Input value={draft.userId} onChange={e=>setDraft({...draft,userId:e.target.value.replace(/\D/g,"")})}/></Field></div>
    <div className="w-44"><Field label={t("common.field.type")}><Select value={draft.freezeType} onChange={e=>setDraft({...draft,freezeType:e.target.value})}><option value="">{t("freeze.filter.allTypes")}</option>{Object.entries(TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field></div>
    <div className="w-44"><Field label={t("common.field.status")}><Select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="">{t("common.filter.allStatus")}</option>{Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field></div>
    <Button type="button" variant="ghost" onClick={()=>{const v={userId:"",freezeType:"",status:""};setDraft(v);setFilters(v)}}>{t("common.action.reset")}</Button>
    <Button type="submit">{t("common.action.search")}</Button>
   </div>
  </FilterPanel>

  <section className="front-surface overflow-hidden rounded-2xl">
   <DataTable columns={columns} rows={query.data?.list??[]} rowKey={r=>r.id} loading={query.isPending} error={query.error?describeError(query.error):null} minWidth={980}/>
   <Pagination page={page} pageSize={pageSize} total={query.data?.total??0} loading={query.isFetching} onPageChange={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/>
  </section>

  <Drawer open={Boolean(selected&&!mode)} onClose={()=>setSelected(null)} title={t("freeze.detail.title")} widthClassName="max-w-2xl"
   footer={selected?<div className="flex w-full items-center justify-between gap-3">
    <span className="text-[11px] text-[var(--muted-foreground)]">{selected.status!==0?t("freeze.detail.ended"):selected.freezeType===1?t("freeze.detail.withdrawManaged"):""}</span>
    <div className="flex items-center gap-2">
     <Button variant="ghost" onClick={()=>setSelected(null)}>{t("common.action.close")}</Button>
     {selected.status===0&&selected.freezeType!==1&&perms.release&&<Button variant="destructive" onClick={()=>open("release",selected)}>{t("freeze.action.release")}</Button>}
    </div>
   </div>:undefined}>
   {selected&&<dl className="overflow-hidden rounded-xl border border-[var(--border)]">{([
     [t("freeze.field.id"),selected.id],[t("common.field.userId"),selected.userId],[t("common.field.walletId"),selected.walletId],
     [t("common.field.type"),TYPES[selected.freezeType]??selected.freezeType],
     [t("common.field.amount"),money(selected.amount)],
     [t("common.field.status"),freezeStatusText(t,selected)],
     [t("freeze.field.refDoc"),selected.refId||"-"],[t("freeze.field.reason"),selected.reasonText||selected.reasonCode||"-"],
     [t("freeze.field.operator"),selected.operatorId],
     [t("freeze.field.expires"),selected.expiresAt>0?formatDateTime(selected.expiresAt):t("freeze.field.noExpiry")],
     [t("freeze.field.placedAt"),formatDateTime(selected.createdAt)],
     [t("freeze.field.endedAt"),selected.releasedAt>0?formatDateTime(selected.releasedAt):"-"],
   ] as [string,React.ReactNode][]).map(([l,v])=><div key={l} className="grid grid-cols-[120px_1fr] gap-4 border-b border-[var(--border)] p-3 last:border-0"><dt className="text-xs text-[var(--muted-foreground)]">{l}</dt><dd className="break-all text-sm">{v}</dd></div>)}</dl>}
  </Drawer>

  <Drawer open={mode==="risk"} onClose={()=>setMode(null)} title={t("freeze.risk.title")}
   description={t("freeze.risk.description")}
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>{t("common.action.cancel")}</Button><Button disabled={placeRisk.isPending||!risk.userId||risk.amount<=0} onClick={()=>placeRisk.mutate()}>{placeRisk.isPending?t("common.action.processing"):t("freeze.action.confirmFreeze")}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   <div className="space-y-4">
    <Field label={t("freeze.field.userIdRequired")}><Input value={risk.userId} onChange={e=>setRisk({...risk,userId:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label={t("freeze.risk.field.amount")}><Input type="number" min={1} value={risk.amount} onChange={e=>setRisk({...risk,amount:Number(e.target.value)})}/></Field>
    <Field label={t("freeze.risk.field.refId")}><Input value={risk.refId} onChange={e=>setRisk({...risk,refId:e.target.value})} placeholder={t("freeze.risk.placeholder.refId")}/></Field>
    <Field label={t("freeze.risk.field.reason")}><Input value={risk.reasonText} onChange={e=>setRisk({...risk,reasonText:e.target.value})} placeholder={t("freeze.risk.placeholder.reason")}/></Field>
   </div>
  </Drawer>

  <Drawer open={mode==="judicial"} onClose={()=>setMode(null)} title={t("freeze.judicial.title")}
   description={t("freeze.judicial.description")}
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>{t("common.action.cancel")}</Button><Button variant="destructive" disabled={placeJudicial.isPending||!jud.userId||(jud.legalDocNo.trim()!==""&&jud.confirmDocNo.trim()!==jud.legalDocNo.trim())} onClick={()=>placeJudicial.mutate()}>{placeJudicial.isPending?t("common.action.processing"):t("freeze.action.confirmFreeze")}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   <div className="space-y-4">
    <Field label={t("freeze.field.userIdRequired")}><Input value={jud.userId} onChange={e=>setJud({...jud,userId:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label={t("freeze.judicial.field.legalDocNo")}><Input value={jud.legalDocNo} onChange={e=>setJud({...jud,legalDocNo:e.target.value})}/></Field>
    <Field label={t("freeze.judicial.field.expiresAt")}><Input value={jud.expiresAt} onChange={e=>setJud({...jud,expiresAt:e.target.value.replace(/\D/g,"")})}/></Field>
    <Field label={t("freeze.judicial.field.reason")}><Input value={jud.reasonText} onChange={e=>setJud({...jud,reasonText:e.target.value})} placeholder={t("freeze.judicial.placeholder.reason")}/></Field>
    {/* 二次确认绑在文书号上而不是一个复选框：要求经办人再核对一遍写的是哪份文书。 */}
    <Field label={t("freeze.judicial.field.confirmDocNo")}><Input value={jud.confirmDocNo} onChange={e=>setJud({...jud,confirmDocNo:e.target.value})}/></Field>
   </div>
  </Drawer>

  <Drawer open={mode==="release"} onClose={()=>setMode(null)} title={t("freeze.action.release")}
   footer={<><Button variant="ghost" onClick={()=>setMode(null)}>{t("common.action.cancel")}</Button><Button variant="destructive" disabled={release.isPending} onClick={()=>release.mutate()}>{release.isPending?t("common.action.processing"):t("freeze.action.confirmRelease")}</Button></>}>
   {error&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
   {selected&&<ReleaseSummary text={t("freeze.release.body",{id:SLOT,userId:selected.userId,type:TYPES[selected.freezeType]??selected.freezeType,amount:money(selected.amount)})} id={selected.id}/>}
  </Drawer>
 </div>;
}
