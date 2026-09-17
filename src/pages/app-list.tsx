"use client";
import * as React from "react";
import { ResourcePage } from "@neton/application-front-resource";
const status=[{label:"启用",value:1},{label:"停用",value:0}];
export default function Page(){return <ResourcePage config={{
 resourceKey:"pay-app",eyebrow:"PAYMENT ROUTING",title:"支付应用",description:"维护支付业务入口；渠道参数在应用详情中独立配置。",
 endpoint:"/pay/app",permissions:{page:"pay:app:query",create:"pay:app:create",update:"pay:app:update",delete:"pay:app:delete"},
 rowActions:(row)=>({primary:[{label:"渠道配置",href:`/pay/app/${row.id}/channels?appId=${row.id}`}]}),
 detailFields:[{key:"id",label:"应用 ID",format:"mono"},{key:"name",label:"应用名称"},{key:"status",label:"状态",format:"status"},{key:"remark",label:"说明"},{key:"createdAt",label:"创建时间",format:"date"}],
 fields:[{key:"name",label:"应用名称",required:true},{key:"status",label:"状态",type:"select",defaultValue:1,format:"status",options:status},{key:"remark",label:"说明",type:"textarea",table:false},{key:"createdAt",label:"创建时间",format:"date"},{key:"name",label:"应用名称",filter:true,table:false},{key:"status",label:"状态",filter:true,table:false,type:"select",options:status}]
}}/>}
