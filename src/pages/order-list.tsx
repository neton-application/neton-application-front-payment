"use client";
import * as React from "react"; import { ResourcePage } from "@neton/application-front-resource";
import { apiWrite } from "@neton/application-front-runtime/client";
import { usePermission, useQueryClient } from "@neton/application-front-runtime/client-context";
import { useDescribeError } from "@neton/application-front-runtime/errors";
import { useT } from "@neton/application-front-runtime/i18n";

interface SyncResult { id: number; status: string; orderStatus: number; message?: string | null }

/**
 * 支付订单。待支付的订单可「同步支付状态」：向支付平台查单，平台确认已付且金额相符才置为已支付并入账。
 * 用来处理「用户付了钱但回调没到」；没有「手动标记已支付」—— 无平台凭证改状态等于凭空发钱。
 */
export default function Page(){
 const t=useT("payment");
 const describeError=useDescribeError("payment");
 const canSync=usePermission("pay:order:sync");
 const queryClient=useQueryClient();
 async function sync(id:number){
  try{
   const r=await apiWrite<SyncResult>(`/admin/pay/order/sync/${id}`,"POST",{});
   window.alert(t(`order.sync.result.${r.status}`,{message:r.message??""}));
   if(r.status==="PAID") void queryClient.invalidateQueries({queryKey:["pay-order"]});
  }catch(cause){ window.alert(t("order.sync.failed",{error:describeError(cause)})); }
 }
 const details=[{key:"id",label:t("order.field.id"),format:"mono" as const},{key:"appId",label:t("common.field.appId"),format:"mono" as const},{key:"merchantOrderId",label:t("order.field.merchantOrderId"),format:"mono" as const},{key:"subject",label:t("order.field.subject")},{key:"body",label:t("order.field.body")},{key:"price",label:t("common.field.amount"),format:"money" as const},{key:"channelCode",label:t("order.field.channel"),format:"mono" as const},{key:"channelOrderNo",label:t("order.field.channelOrderNo"),format:"mono" as const},{key:"status",label:t("common.field.status")},{key:"userIp",label:t("order.field.userIp"),format:"mono" as const},{key:"expireTime",label:t("order.field.expireTime"),format:"date" as const},{key:"successTime",label:t("order.field.successTime"),format:"date" as const},{key:"createdAt",label:t("common.field.createdAt"),format:"date" as const}];
 return <ResourcePage config={{resourceKey:"pay-order",errorNamespace:"payment",eyebrow:t("order.eyebrow"),title:t("order.title"),description:t("order.description"),endpoint:"/pay/order",readOnly:true,permissions:{page:"pay:order:query"},detailFields:details,detailPath:(r)=>"get-detail/"+r.id,
  rowActions:(row)=>({primary:canSync&&Number(row.status)===0?[{label:t("order.sync.action"),onClick:()=>{void sync(Number(row.id));}}]:[],more:[]}),
  fields:[{key:"id",label:t("order.field.id"),format:"mono"},{key:"merchantOrderId",label:t("order.field.merchantOrderId"),format:"mono"},{key:"subject",label:t("common.field.title")},{key:"price",label:t("common.field.amount"),format:"money"},{key:"channelCode",label:t("common.field.channel"),format:"mono"},{key:"status",label:t("common.field.status")},{key:"createdAt",label:t("common.field.createdAt"),format:"date"},{key:"appId",label:t("common.field.appId"),filter:true,table:false},{key:"merchantOrderId",label:t("order.field.merchantOrderId"),filter:true,table:false},{key:"channelCode",label:t("common.field.channelCode"),filter:true,table:false},{key:"status",label:t("common.field.status"),filter:true,table:false}]}}/>}
