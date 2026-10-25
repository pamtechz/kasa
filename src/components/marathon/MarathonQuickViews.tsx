import {marathonFocusViews} from '@/lib/marathon-categories';
import type {MarathonFocus} from '@/lib/marathon-categories';

export function MarathonQuickViews({focus,counts,onChange}:{focus:MarathonFocus;counts:Record<MarathonFocus,number>;onChange:(focus:MarathonFocus)=>void}){
 return <div className="ml-quick-views" role="group" aria-label="Checklist quick views">{marathonFocusViews.map(view=><button type="button" key={view.id} className={'ml-quick-view'+(focus===view.id?' selected':'')} aria-pressed={focus===view.id} onClick={()=>onChange(view.id)}><span>{view.label}</span><b>{counts[view.id]}</b></button>)}</div>;
}
