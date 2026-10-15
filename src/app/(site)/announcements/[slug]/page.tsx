import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {PublicDetail} from '@/components/PublicPages';
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 return <SiteChrome><PageIntro eyebrow="ANNOUNCEMENT" title="Announcement details" description="Official KASA information"/><main className="container site-content"><PublicDetail kind="announcements" id={slug}/></main></SiteChrome>;
}
