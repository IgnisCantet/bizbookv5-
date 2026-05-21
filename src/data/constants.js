// © 2026 ТОО «NOVA Comp». BizBook KZ v5.
export const MRP = 4325, MZP = 85000;

export function calcSalary(gross, type = 'standard') {
  const isPens = type === 'pensioner', isStu = type === 'student';
  const isDis = type === 'disabled', isNR = type === 'nonresident';
  const opv = (isPens || isNR) ? 0 : Math.round(Math.min(gross, 50 * MZP) * 0.10);
  const vosms = (isPens || isStu) ? 0 : Math.round(gross * 0.02);
  const ded = 30 * MRP + (isDis ? 882 * MRP : 0);
  const ipnB = isNR ? gross : Math.max(0, gross - opv - vosms - ded);
  const ipn = Math.round(ipnB * (isNR ? 0.20 : 0.10));
  const net = gross - opv - vosms - ipn;
  const opvr = isPens ? 0 : Math.round(Math.min(gross, 50 * MZP) * 0.035);
  const so = isPens ? 0 : Math.round(Math.min(Math.max(gross - opv, MZP), 7 * MZP) * 0.05);
  const sn = Math.max(0, Math.round(gross * 0.06) - so);
  const vemp = Math.round(gross * 0.02);
  return { gross, opv, vosms, ipn, net, opvr, so, sn, vemp, total: gross + opvr + so + sn + vemp };
}
