import {MarathonWorkspace} from '@/components/marathon/MarathonWorkspace';
export default async function MarathonSection({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 return <MarathonWorkspace section={section}/>;
}
