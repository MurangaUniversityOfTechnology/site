// Seasonal theme window. Halloween runs every year from 21 Oct to 1 Nov
// (month is 0-based, matching Date.getMonth), judged in the visitor's own
// clock. It switches itself on and off — nothing to remember to revert.
const START = { month: 9, day: 21 };
const END = { month: 10, day: 1 };

export function isHalloween(date: Date = new Date()): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return (month === START.month && day >= START.day) || (month === END.month && day <= END.day);
}

// Runs in <head> before first paint, so the page never flashes the normal
// palette first. Same rule as isHalloween, built from the same constants.
export const SEASON_SCRIPT = `(function(){try{var d=new Date(),m=d.getMonth(),n=d.getDate();if((m===${START.month}&&n>=${START.day})||(m===${END.month}&&n<=${END.day}))document.documentElement.dataset.season="halloween"}catch(e){}})()`;
