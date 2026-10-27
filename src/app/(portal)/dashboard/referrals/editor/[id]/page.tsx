import MyReferrals from '../../page';
export default async function ReferralEditorPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <MyReferrals editorId={id}/>;
}
