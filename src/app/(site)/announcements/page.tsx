import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {CollectionView} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="LATEST FROM KASA" title="Announcements" description="Official news, intake windows, application guidance and training notices."/>
 <main className="container site-content"><CollectionView kind="announcements"/></main></SiteChrome>;
}
