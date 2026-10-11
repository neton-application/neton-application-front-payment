import type { Translate } from "@neton/application-front-runtime/i18n";
import { formatMoney } from "@neton/application-front-runtime/types";

/**
 * 冻结记录的共享模型与文案。
 *
 * 钱包页和冻结管理页都要显示同一批状态，各写一份迟早会漂——「已解除 / 已扣除」
 * 这种钱的去向不同的措辞，一旦两页说法不一致，运营就会按错的那一页做判断。
 */
export interface Freeze {
  id: number;
  walletId: number;
  userId: number;
  freezeType: number;
  amount: null | number;
  status: number;
  refType: number;
  refId: string;
  reasonCode?: null | string;
  reasonText?: null | string;
  operatorId: number;
  expiresAt: number;
  createdAt: number;
  releasedAt: number;
}

export const freezeTypes = (t: Translate): Record<number, string> => ({
  1: t("freeze.type.withdraw"),
  2: t("freeze.type.risk"),
  3: t("freeze.type.account"),
});

/** 三种终态含义不同，不许合并成一个「已解冻」（spec WALLET_FREEZE_SPEC §3.1）。 */
export const freezeStatuses = (t: Translate): Record<number, string> => ({
  0: t("freeze.status.active"),
  1: t("freeze.status.released"),
  2: t("freeze.status.deducted"),
  3: t("freeze.status.expired"),
});

/** null = 全额司法冻结：冻结额随余额浮动，没有一个固定数字可显示。冻结记录不带币种，走部署默认币种。 */
export const freezeMoney = (t: Translate, v: null | number) => (v == null ? t("freeze.amount.full") : formatMoney(v));

/**
 * 过了期限但还没被巡检翻状态。
 *
 * 到期的冻结在可用余额计算里**当场失效**，状态字段只是还没追上，所以这里显示
 * 「已到期（待巡检）」而不是继续说「冻结中」——后者会让运营以为钱还冻着。
 */
export const freezeExpired = (r: Freeze) => r.status === 0 && r.expiresAt > 0 && r.expiresAt < Date.now();

export const freezeStatusText = (t: Translate, r: Freeze) =>
  freezeExpired(r) ? t("freeze.status.expiredPending") : (freezeStatuses(t)[r.status] ?? String(r.status));
