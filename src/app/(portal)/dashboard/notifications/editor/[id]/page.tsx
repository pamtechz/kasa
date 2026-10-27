import Notifications from '../../page';
export default async function NotificationEditorPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <Notifications editorId={id}/>;
}
