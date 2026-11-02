import {MarathonEventBudget} from '@/components/marathon/MarathonEventBudget';
import {MarathonRaceDay} from '@/components/marathon/MarathonRaceDay';
export default async function MarathonSection({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(section==='events'||section==='budget')return <MarathonEventBudget view={section}/>;
 if(section==='race-day')return <MarathonRaceDay/>;
 return null;
}
