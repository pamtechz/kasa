import {SiteChrome} from '@/components/SiteChrome';
import {NewsArticleDetail} from '@/components/NewsArticleDetail';

export default async function Page({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  return (
    <SiteChrome>
      <main className="container site-content" style={{paddingTop: 36, paddingBottom: 64}}>
        <NewsArticleDetail id={slug} />
      </main>
    </SiteChrome>
  );
}
