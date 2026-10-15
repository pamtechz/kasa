import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="INFORMATION AND SAFEGUARDS" title="Applicant privacy notice" description="How KASA handles information submitted to its enrollment and referral system."/><main className="container site-content"><InformationPage mode="privacy"/></main></SiteChrome>;
}
