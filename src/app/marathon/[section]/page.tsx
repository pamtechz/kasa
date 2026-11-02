import {MarathonEventBudget} from '@/components/marathon/MarathonEventBudget';
export default async function MarathonSection({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(section==='events'||section==='budget')return <MarathonEventBudget view={section}/>;
 return null;
}
