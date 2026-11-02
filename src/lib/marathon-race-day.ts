/** Event-scoped operations records, not individual runner registration or medical records. */
export type RaceDayKind='bib_station'|'volunteers'|'medical_team'|'route_safety'|'water_station'|'timing_desk'|'other';
export type RaceDayStatus='planned'|'ready'|'active'|'blocked'|'resolved';
export type RaceDayEntry={id:string;eventId:string;kind:RaceDayKind;title:string;zone:string;note:string;
 status:RaceDayStatus;revision:number;createdAt:string;createdBy:string;updatedAt:string;updatedBy:string};
export const raceDayKinds:Record<RaceDayKind,string>={
 bib_station:'Bib collection station',volunteers:'Volunteer team',medical_team:'Medical team readiness',
 route_safety:'Route safety checkpoint',water_station:'Water station',timing_desk:'Timing desk',other:'Other operations'
};
export function raceDaySummary(entries:Pick<RaceDayEntry,'kind'|'status'>[]){
 return {total:entries.length,ready:entries.filter(x=>x.status==='ready').length,
  active:entries.filter(x=>x.status==='active').length,
  blocked:entries.filter(x=>x.status==='blocked').length,
  resolved:entries.filter(x=>x.status==='resolved').length};
}
