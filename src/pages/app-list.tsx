"use client";
import * as React from "react";
import { ResourcePage } from "@neton/application-front-resource";
import { useT } from "@neton/application-front-runtime/i18n";
export default function Page(){
 const t=useT("payment");
 const status=[{label:t("common.status.enabled"),value:1},{label:t("common.status.disabled"),value:0}];
 return <ResourcePage config={{
 resourceKey:"pay-app",errorNamespace:"payment",eyebrow:t("app.eyebrow"),title:t("app.title"),description:t("app.description"),
 endpoint:"/pay/app",permissions:{page:"pay:app:query",create:"pay:app:create",update:"pay:app:update",delete:"pay:app:delete"},
 rowActions:(row)=>({primary:[{label:t("app.action.channels"),kind:"settings",href:`/pay/app/${row.id}/channels?appId=${row.id}`}]}),
 detailFields:[{key:"id",label:t("common.field.appId"),format:"mono"},{key:"name",label:t("app.field.name")},{key:"status",label:t("common.field.status"),format:"status"},{key:"remark",label:t("common.field.remark")},{key:"createdAt",label:t("common.field.createdAt"),format:"date"}],
 fields:[{key:"name",label:t("app.field.name"),required:true},{key:"status",label:t("common.field.status"),type:"select",defaultValue:1,format:"status",options:status},{key:"remark",label:t("common.field.remark"),type:"textarea",table:false},{key:"createdAt",label:t("common.field.createdAt"),format:"date"},{key:"name",label:t("app.field.name"),filter:true,table:false},{key:"status",label:t("common.field.status"),filter:true,table:false,type:"select",options:status}]
}}/>}
