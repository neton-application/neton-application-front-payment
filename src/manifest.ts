import { defineFrontModule } from "@neton/application-front-contract";
export default defineFrontModule({
  id:"payment",contractVersion:"1.0.0",
  locales:[{lang:"zh-CN",entry:"zh-CN"},{lang:"en-US",entry:"en-US"}],
  pages:[
    {key:"pay/app/index",path:"/pay/app",entry:"app-list",rendering:"client"},
    {key:"pay/channel/index",path:"/pay/channel",entry:"channel-list",rendering:"client"},
    {key:"pay/order/index",path:"/pay/order",entry:"order-list",rendering:"client"},
    {key:"pay/refund/index",path:"/pay/refund",entry:"refund-list",rendering:"client"},
    {key:"pay/notify/index",path:"/pay/notify",entry:"notify-list",rendering:"client"},
    {key:"pay/transfer/index",path:"/pay/transfer",entry:"transfer-list",rendering:"client"},
    {key:"pay/wallet/balance/index",path:"/pay/wallet/balance",entry:"wallet-list",rendering:"client"},
    {key:"pay/wallet/rechargePackage/index",path:"/pay/wallet/recharge-package",entry:"recharge-package-list",rendering:"client"},
    {key:"pay/withdraw/index",path:"/pay/withdraw",entry:"withdraw-list",rendering:"client"},
    {key:"pay/wallet/freeze/index",path:"/pay/wallet/freeze",entry:"freeze-list",rendering:"client"}
  ]
});
