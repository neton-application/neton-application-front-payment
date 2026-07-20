"use client";
import * as React from "react";
import { ResourcePage } from "@neton/application-front-resource";
const status=[{label:"启用",value:1},{label:"停用",value:0}];
export default function Page(){const[initialAppId,setInitialAppId]=React.useState<string|null>(null);React.useEffect(()=>setInitialAppId(new URLSearchParams(window.location.search).get("appId")??""),[]);if(initialAppId===null)return null;return <ResourcePage config={{
 resourceKey:"pay-channel",eyebrow:"PAYMENT ROUTING",title:"支付渠道",description:"按应用维护支付渠道、费率和通道配置。敏感配置只在授权人员编辑时处理。",
 endpoint:"/pay/channel",permissions:{page:"pay:channel:page",create:"pay:channel:create",update:"pay:channel:update",delete:"pay:channel:delete"},
 initialFilters:{appId:initialAppId},
 detailFields:[{key:"id",label:"渠道 ID",format:"mono"},{key:"appId",label:"应用 ID",format:"mono"},{key:"code",label:"渠道编码",format:"mono"},{key:"feeRate",label:"费率(万分比)"},{key:"status",label:"状态",format:"status"},{key:"remark",label:"说明"},{key:"createdAt",label:"创建时间",format:"date"}],
 fields:[{key:"appId",label:"应用 ID",type:"number",required:true,format:"mono"},{key:"code",label:"渠道编码",required:true,format:"mono"},{key:"config",label:"渠道配置(JSON)",type:"textarea",required:true,table:false},{key:"feeRate",label:"费率(万分比)",type:"number",defaultValue:0},{key:"status",label:"状态",type:"select",defaultValue:1,format:"status",options:status},{key:"remark",label:"说明",type:"textarea",table:false},{key:"createdAt",label:"创建时间",format:"date"},{key:"appId",label:"应用 ID",filter:true,table:false},{key:"code",label:"渠道编码",filter:true,table:false},{key:"status",label:"状态",filter:true,table:false,type:"select",options:status}]
}}/>}
