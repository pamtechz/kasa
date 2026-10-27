import {notFound} from 'next/navigation';
import {ContentEditor} from '@/components/ContentEditor';
export default async function ContentEditorPage({params}:{params:Promise<{kind:string;id:string}>}){
 const {kind,id}=await params;
 if(kind!=='programmes'&&kind!=='announcements')notFound();
 return <ContentEditor kind={kind} editorId={id}/>;
}
