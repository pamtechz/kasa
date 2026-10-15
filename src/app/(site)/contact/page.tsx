import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="GET IN TOUCH" title="Contact KASA" description="Reach the admissions team through the institution's official contact details."/>
 <main className="container site-content"><InformationPage mode="contact"/></main></SiteChrome>;
}
