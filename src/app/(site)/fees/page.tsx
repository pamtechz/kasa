import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {FeesView} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="2027 PROPOSED PRICING" title="Course fees" description="View the KASA fee proposals and understand optional food and accommodation costs."/>
 <main className="container site-content"><FeesView/></main></SiteChrome>;
}
