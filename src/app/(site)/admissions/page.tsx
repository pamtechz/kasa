import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="ADMISSIONS" title="Applications and funding" description="Understand application, admission, the offer stage, and full payment through self-funded or government CDF sponsorship."/>
 <main className="container site-content"><InformationPage mode="admissions"/></main></SiteChrome>;
}
