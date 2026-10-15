import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="WHO WE ARE" title="About KASA" description="Learn about Kamaila Academics, Sports and Apprenticeship, our approach and our programmes."/>
 <main className="container site-content"><InformationPage mode="about"/></main></SiteChrome>;
}
