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

export const FREEZE_TYPES: Record<number, string> = { 1: "提现冻结", 2: "单笔风控", 3: "账户冻结" };

/** 三种终态含义不同，不许合并成一个「已解冻」（spec WALLET_FREEZE_SPEC §3.1）。 */
export const FREEZE_STATUS: Record<number, string> = { 0: "冻结中", 1: "已解除", 2: "已扣除", 3: "已到期" };

/** null = 全额司法冻结：冻结额随余额浮动，没有一个固定数字可显示。 */
export const freezeMoney = (v: null | number) =>
  v == null ? "全额" : "¥" + (v / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 过了期限但还没被巡检翻状态。
 *
 * 到期的冻结在可用余额计算里**当场失效**，状态字段只是还没追上，所以这里显示
 * 「已到期（待巡检）」而不是继续说「冻结中」——后者会让运营以为钱还冻着。
 */
export const freezeExpired = (r: Freeze) => r.status === 0 && r.expiresAt > 0 && r.expiresAt < Date.now();

export const freezeStatusText = (r: Freeze) =>
  freezeExpired(r) ? "已到期（待巡检）" : (FREEZE_STATUS[r.status] ?? String(r.status));
