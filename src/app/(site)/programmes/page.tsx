import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {CollectionView} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="STUDY AT KASA" title="Programmes and short courses" description="Explore independently listed KASA training programmes and practical short courses."/>
 <main className="container site-content"><CollectionView kind="programmes"/></main></SiteChrome>;
}
