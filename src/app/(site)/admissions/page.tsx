import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {InformationPage} from '@/components/PublicPages';
export default function Page(){
 return <SiteChrome><PageIntro eyebrow="ADMISSIONS" title="Applications and funding" description="Find the application status, enrollment process and student payment pathways."/>
 <main className="container site-content"><InformationPage mode="admissions"/></main></SiteChrome>;
}
