import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="INFORMATION AND SAFEGUARDS" title="Application terms" description="Important conditions for applications, sponsorship and commissioned referrals."/><main className="container site-content"><InformationPage mode="terms"/></main></SiteChrome>;
}
