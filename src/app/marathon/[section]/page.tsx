import {redirect} from 'next/navigation';
export default async function MarathonSectionAlias({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 redirect('/marthon/'+encodeURIComponent(section));
}
