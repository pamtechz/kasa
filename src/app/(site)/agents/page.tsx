import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="DISTRICT NETWORK" title="Become a KASA agent" description="Approved representatives can share official application forms and track referral outcomes."/>
 <main className="container site-content"><InformationPage mode="agents"/></main></SiteChrome>;
}
