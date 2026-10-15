import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {PublicDetail} from '@/components/PublicPages';
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 return <SiteChrome><PageIntro eyebrow="PROGRAMME" title="Programme details" description="Official KASA information"/><main className="container site-content"><PublicDetail kind="programmes" id={slug}/></main></SiteChrome>;
}
