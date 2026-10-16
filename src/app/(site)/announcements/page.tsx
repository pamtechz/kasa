import {SiteChrome, PageIntro} from '@/components/SiteChrome';
import {NewsBlogView} from '@/components/NewsBlogView';

export const metadata = {
  title: 'News & Blog | KASA — Kamaila Academics, Sports & Apprenticeship',
  description: 'Stay updated with official KASA news, admissions announcements, CDF sponsorship guidelines, training updates and campus life in Chisamba.'
};

export default function Page() {
  return (
    <SiteChrome>
      <PageIntro
        eyebrow="OFFICIAL KASA NEWSROOM & BLOG"
        title="News & Latest Information"
        description="Official notices, academic frameworks, CDF sponsorship guidelines and student life at Kamaila Campus, Chisamba."
      />
      <main className="container site-content" style={{paddingTop: 36, paddingBottom: 64}}>
        <NewsBlogView />
      </main>
    </SiteChrome>
  );
}
