import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="OUR PROCESS" title="How KASA works" description="Follow admissions, documentation, funding verification and referral processes clearly."/>
 <main className="container site-content"><InformationPage mode="how"/></main></SiteChrome>;
}
